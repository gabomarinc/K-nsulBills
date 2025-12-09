import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import InvoiceWizard from './components/InvoiceWizard';
import SupportWidget from './components/SupportWidget';
import OnboardingWizard from './components/OnboardingWizard';
import LoginScreen from './components/LoginScreen'; 
import InvoiceDetail from './components/InvoiceDetail'; 
import UserProfileSettings from './components/UserProfileSettings'; 
import DocumentList from './components/DocumentList'; 
import ReportsDashboard from './components/ReportsDashboard'; 
import CatalogDashboard from './components/CatalogDashboard'; 
import ClientList from './components/ClientList'; 
import ClientDetail from './components/ClientDetail'; // Import new component
import ExpenseTracker from './components/ExpenseTracker'; 
import ExpenseWizard from './components/ExpenseWizard'; 
import { AppView, ProfileType, UserProfile, Invoice, CatalogItem } from './types';
import { fetchInvoicesFromDb, saveInvoiceToDb, deleteInvoiceFromDb, createUserInDb, updateUserProfileInDb, saveClientToDb } from './services/neon'; 
import { sendWelcomeEmail } from './services/resendService';
import { Plus, X, FileText, FileBadge, UserPlus, TrendingDown } from 'lucide-react';

const DEFAULT_PROFILE: UserProfile = {
  id: '',
  name: '',
  type: ProfileType.FREELANCE,
  taxId: '',
  avatar: '',
  isOnboardingComplete: false, 
  defaultServices: [],
  branding: { primaryColor: '#27bea5', templateStyle: 'Modern' },
  defaultCurrency: 'USD',
  plan: 'Free',
  country: 'Panamá',
};

const App: React.FC = () => {
  // --- AUTH STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [showRegister, setShowRegister] = useState(false);

  // --- APP STATE ---
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [isOffline, setIsOffline] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isDbConnected, setIsDbConnected] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // EDIT & CLIENT STATE
  const [selectedClientName, setSelectedClientName] = useState<string | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null); // State for invoice being edited

  // MOBILE MENU STATE
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // ... (Session and Data Loading logic remains same)
  useEffect(() => {
    const storedUser = localStorage.getItem('konsul_bills_user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setCurrentProfile(user);
        setIsAuthenticated(true);
      } catch (e) {
        console.error("Failed to parse stored session", e);
        localStorage.removeItem('konsul_bills_user');
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('konsul_bills_user');
    setIsAuthenticated(false);
    setInvoices([]);
    setCurrentProfile(DEFAULT_PROFILE);
    setCurrentView(AppView.DASHBOARD);
  };

  const refreshData = async () => {
    if (!currentProfile.id) return;
    setIsLoadingData(true);
    const dbData = await fetchInvoicesFromDb(currentProfile.id);
    if (dbData) {
      setInvoices(dbData);
      setIsDbConnected(true);
    } else {
      setInvoices([]); 
      setIsDbConnected(false);
    }
    setIsLoadingData(false);
  };

  useEffect(() => {
    if (isAuthenticated && currentProfile.id) {
      refreshData();
    }
  }, [isAuthenticated, currentProfile.id]);

  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentProfile(user);
    setIsAuthenticated(true);
    localStorage.setItem('konsul_bills_user', JSON.stringify(user));
  };

  // --- ACTIONS ---

  const handleEditInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setCurrentView(AppView.WIZARD);
  };

  const handleSaveInvoice = async (newInvoice: Invoice) => {
    // Check if we are UPDATING an existing invoice
    const isUpdate = invoices.some(i => i.id === newInvoice.id);
    
    let invoiceWithMetadata: Invoice;

    if (isUpdate) {
        // Find original to preserve some data if needed, but mostly overwrite
        const original = invoices.find(i => i.id === newInvoice.id);
        invoiceWithMetadata = {
            ...newInvoice,
            userId: currentProfile.id,
            timeline: [
                ...(original?.timeline || []),
                {
                    id: Date.now().toString(),
                    type: 'EDITED',
                    title: 'Documento Editado',
                    timestamp: new Date().toISOString()
                }
            ]
        };
        // Update local state by mapping
        setInvoices(invoices.map(i => i.id === newInvoice.id ? invoiceWithMetadata : i));
    } else {
        // Create New logic (existing)
        invoiceWithMetadata = {
            ...newInvoice,
            userId: currentProfile.id,
            timeline: newInvoice.timeline || [
                { 
                id: Date.now().toString(), 
                type: 'CREATED', 
                title: 'Documento Creado', 
                description: 'Generado exitosamente', 
                timestamp: new Date().toISOString() 
                }
            ],
            successProbability: newInvoice.type === 'Quote' ? Math.floor(Math.random() * 30) + 60 : undefined
        };
        setInvoices([invoiceWithMetadata, ...invoices]);
        
        // Sequence update logic
        if (newInvoice.type === 'Invoice') {
            const updatedProfile = { ...currentProfile, documentSequences: { ...currentProfile.documentSequences!, invoiceNextNumber: (currentProfile.documentSequences?.invoiceNextNumber || 0) + 1 } };
            setCurrentProfile(updatedProfile);
            localStorage.setItem('konsul_bills_user', JSON.stringify(updatedProfile));
            updateUserProfileInDb(updatedProfile);
        } else if (newInvoice.type === 'Quote') {
            const updatedProfile = { ...currentProfile, documentSequences: { ...currentProfile.documentSequences!, quoteNextNumber: (currentProfile.documentSequences?.quoteNextNumber || 0) + 1 } };
            setCurrentProfile(updatedProfile);
            localStorage.setItem('konsul_bills_user', JSON.stringify(updatedProfile));
            updateUserProfileInDb(updatedProfile);
        }
    }
    
    setSelectedInvoice(invoiceWithMetadata);
    setEditingInvoice(null); // Clear edit state

    // DB Save (Upsert handles both insert and update)
    await saveInvoiceToDb(invoiceWithMetadata);

    // ALSO SAVE CLIENT TO DB
    if (invoiceWithMetadata.type === 'Invoice' || invoiceWithMetadata.type === 'Quote') {
        const clientStatus = invoiceWithMetadata.type === 'Invoice' ? 'CLIENT' : 'PROSPECT';
        await saveClientToDb(
            { 
                name: invoiceWithMetadata.clientName, 
                taxId: invoiceWithMetadata.clientTaxId, 
                email: invoiceWithMetadata.clientEmail,
                address: invoiceWithMetadata.clientAddress
            },
            currentProfile.id,
            clientStatus
        );
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    if (window.confirm("¿Estás seguro de que quieres eliminar este documento? Esta acción no se puede deshacer.")) {
      const newInvoices = invoices.filter(i => i.id !== id);
      setInvoices(newInvoices);
      if (selectedInvoice?.id === id) setSelectedInvoice(null);
      await deleteInvoiceFromDb(id);
    }
  };

  const handleUpdateClientContact = async (clientName: string, newContact: { email: string, address: string, taxId: string }) => {
    // Since we don't have a clients table, we update the metadata on the invoices for this client
    // In a real app, we'd update a `clients` table. Here, we update the `invoices` where clientName matches.
    
    const updatedInvoices = invoices.map(inv => {
        if (inv.clientName === clientName) {
            return {
                ...inv,
                clientEmail: newContact.email,
                clientAddress: newContact.address, // We added this field to Invoice type
                clientTaxId: newContact.taxId
            };
        }
        return inv;
    });

    setInvoices(updatedInvoices);
    
    // Persist changes for this client to DB (Update all their docs)
    const clientDocs = updatedInvoices.filter(i => i.clientName === clientName);
    for (const doc of clientDocs) {
        await saveInvoiceToDb(doc);
    }

    // UPDATE CLIENT IN DB TABLE
    await saveClientToDb(
        { 
            name: clientName, 
            email: newContact.email, 
            address: newContact.address, 
            taxId: newContact.taxId 
        },
        currentProfile.id,
        'CLIENT' // Defaulting to Client, database logic will handle if they were prospect
    );

    alert("Datos del cliente actualizados en sus documentos.");
  };

  const handleSelectClient = (name: string) => {
    setSelectedClientName(name);
    setCurrentView(AppView.CLIENT_DETAIL);
  };

  // ... (Other handlers like markPaid, convertQuote remain same)
  const handleMarkAsPaid = async (id: string) => { 
    const updatedInvoices = invoices.map(inv => {
      if (inv.id === id) {
        return {
          ...inv,
          status: 'Aceptada' as const,
          timeline: [
            ...(inv.timeline || []),
            {
              id: Date.now().toString(),
              type: 'PAID' as const,
              title: 'Pago Registrado',
              timestamp: new Date().toISOString(),
              description: 'Pago registrado manualmente'
            }
          ]
        };
      }
      return inv;
    });
    setInvoices(updatedInvoices);
    const updatedInv = updatedInvoices.find(i => i.id === id);
    if (updatedInv) {
        await saveInvoiceToDb(updatedInv);
        // Ensure client status becomes CLIENT if they paid
        await saveClientToDb(
            { 
                name: updatedInv.clientName, 
                taxId: updatedInv.clientTaxId, 
                email: updatedInv.clientEmail 
            },
            currentProfile.id,
            'CLIENT'
        );
    }
  };

  const handleConvertQuote = async (quoteId: string) => { 
    const quote = invoices.find(i => i.id === quoteId);
    if (!quote) return;

    const updatedInvoices = invoices.map(inv => 
      inv.id === quoteId ? { ...inv, status: 'Aceptada' as const } : inv
    );

    const nextInvId = `${currentProfile.documentSequences?.invoicePrefix || 'FAC'}-${String(currentProfile.documentSequences?.invoiceNextNumber || 1).padStart(4, '0')}`;
    
    const newInvoice: Invoice = {
      ...quote,
      id: nextInvId,
      userId: currentProfile.id,
      type: 'Invoice',
      status: 'Creada',
      date: new Date().toISOString(),
      timeline: [
        {
          id: Date.now().toString(),
          type: 'CREATED',
          title: 'Factura Generada',
          description: `Convertida desde cotización ${quote.id}`,
          timestamp: new Date().toISOString()
        }
      ]
    };

    setInvoices([newInvoice, ...updatedInvoices]);
    
    const updatedProfile = {
      ...currentProfile,
      documentSequences: {
        ...currentProfile.documentSequences!,
        invoiceNextNumber: (currentProfile.documentSequences?.invoiceNextNumber || 0) + 1
      }
    };
    setCurrentProfile(updatedProfile);
    localStorage.setItem('konsul_bills_user', JSON.stringify(updatedProfile));
    
    await saveInvoiceToDb({...quote, status: 'Aceptada'});
    await saveInvoiceToDb(newInvoice);
    await handleProfileUpdate(updatedProfile);

    // Update Client Status to CLIENT
    await saveClientToDb(
        { 
            name: quote.clientName, 
            taxId: quote.clientTaxId, 
            email: quote.clientEmail,
            address: quote.clientAddress
        },
        currentProfile.id,
        'CLIENT'
    );
  };

  const handleInvoiceSelect = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setCurrentView(AppView.INVOICE_DETAIL);
  };

  const handleOnboardingComplete = async (data: any) => { 
    const newProfile = {
      ...currentProfile,
      ...data,
      isOnboardingComplete: true,
      documentSequences: currentProfile.documentSequences || {
        invoicePrefix: 'FAC', invoiceNextNumber: 1,
        quotePrefix: 'COT', quoteNextNumber: 1
      }
    };

    // Create user in DB
    if (data.password && data.email) {
       try {
         const success = await createUserInDb(newProfile, data.password, data.email);
         if (success) {
            await sendWelcomeEmail(newProfile as UserProfile);
            alert("Cuenta creada con éxito. Por favor inicia sesión.");
            setShowRegister(false);
            return; 
         }
       } catch (e) {
         console.error("Failed to create user in DB", e);
         alert("Error al crear usuario. Intenta nuevamente.");
         return;
       }
    }
    setCurrentProfile(newProfile);
    setIsAuthenticated(true);
    setShowRegister(false);
  };

  const handleProfileUpdate = async (updatedProfile: UserProfile) => { 
    setCurrentProfile(updatedProfile);
    localStorage.setItem('konsul_bills_user', JSON.stringify(updatedProfile));
    try {
      await updateUserProfileInDb(updatedProfile);
    } catch (e) {
      console.error("DB Sync Error:", e);
    }
  };

  const handleCatalogUpdate = (newItems: CatalogItem[]) => { 
    const updatedProfile = { ...currentProfile, defaultServices: newItems };
    handleProfileUpdate(updatedProfile);
  };

  const toggleProfile = () => { console.log("Switch profile requested"); };

  const pendingCount = invoices.filter(i => i.status === 'PendingSync').length;
  
  const handleMenuAction = (view: AppView) => {
    setCurrentView(view);
    setShowMobileMenu(false);
  };

  if (isLoadingData) return <div className="h-screen flex items-center justify-center bg-slate-50 flex-col gap-4"><div className="w-12 h-12 bg-[#27bea5] rounded-xl animate-spin"></div><p className="text-slate-500 font-medium animate-pulse">Sincronizando oficina virtual...</p></div>;

  if (showRegister || (isAuthenticated && !currentProfile.isOnboardingComplete && currentProfile.id)) {
    return <OnboardingWizard onComplete={handleOnboardingComplete} />;
  }

  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} onRegisterClick={() => setShowRegister(true)} />;
  }

  return (
    <div className="antialiased text-[#1c2938] font-sans">
      <Layout
        activeView={currentView}
        onNavigate={setCurrentView}
        currentProfile={currentProfile}
        onSwitchProfile={toggleProfile}
        isOffline={isOffline}
        onToggleOffline={() => setIsOffline(!isOffline)}
        pendingInvoicesCount={pendingCount}
        onLogout={handleLogout}
      >
        {currentView === AppView.DASHBOARD && (
          <Dashboard 
            recentInvoices={invoices} 
            isOffline={isOffline}
            pendingCount={pendingCount}
            onNewAction={() => setCurrentView(AppView.WIZARD)}
            onSelectInvoice={handleInvoiceSelect}
            onNavigate={setCurrentView} 
          />
        )}
        
        {currentView === AppView.WIZARD && (
          <InvoiceWizard
            currentUser={currentProfile}
            isOffline={isOffline}
            onSave={handleSaveInvoice}
            onCancel={() => {
                setEditingInvoice(null);
                setCurrentView(AppView.DASHBOARD);
            }}
            initialData={editingInvoice} // Pass data if editing
            onViewDetail={() => {
              if (selectedInvoice) setCurrentView(AppView.INVOICE_DETAIL);
              else setCurrentView(AppView.DASHBOARD);
            }}
          />
        )}

        {currentView === AppView.INVOICE_DETAIL && selectedInvoice && (
          <InvoiceDetail 
            invoice={selectedInvoice}
            issuer={currentProfile}
            onBack={() => setCurrentView(AppView.INVOICES)} 
            onEdit={handleEditInvoice} // Pass Edit Handler
          />
        )}
        
        {currentView === AppView.INVOICES && (
          <DocumentList 
            invoices={invoices} 
            onSelectInvoice={(inv) => { setSelectedInvoice(inv); setCurrentView(AppView.INVOICE_DETAIL); }}
            onCreateNew={() => { setEditingInvoice(null); setCurrentView(AppView.WIZARD); }}
            onMarkPaid={handleMarkAsPaid}
            onConvertQuote={handleConvertQuote}
            onDeleteInvoice={handleDeleteInvoice} 
            onEditInvoice={handleEditInvoice} // Pass Edit Handler
            currencySymbol={currentProfile.defaultCurrency === 'EUR' ? '€' : '$'}
            currentUser={currentProfile}
          />
        )}

        {currentView === AppView.CLIENTS && (
          <ClientList 
            invoices={invoices} 
            onCreateDocument={() => { setEditingInvoice(null); setCurrentView(AppView.WIZARD); }}
            onSelectClient={handleSelectClient} // Pass Select Handler
            currencySymbol={currentProfile.defaultCurrency === 'EUR' ? '€' : '$'}
            currentUser={currentProfile} 
          />
        )}

        {/* NEW CLIENT DETAIL VIEW */}
        {currentView === AppView.CLIENT_DETAIL && selectedClientName && (
            <ClientDetail 
                clientName={selectedClientName}
                invoices={invoices}
                currencySymbol={currentProfile.defaultCurrency === 'EUR' ? '€' : '$'}
                onBack={() => setCurrentView(AppView.CLIENTS)}
                onSelectInvoice={(inv) => { setSelectedInvoice(inv); setCurrentView(AppView.INVOICE_DETAIL); }}
                onUpdateClientContact={handleUpdateClientContact}
            />
        )}

        {currentView === AppView.CATALOG && (
          <CatalogDashboard 
            items={currentProfile.defaultServices || []}
            userCountry={currentProfile.country || 'Global'}
            apiKey={currentProfile.apiKeys} 
            onUpdate={handleCatalogUpdate}
            referenceHourlyRate={currentProfile.hourlyRateConfig?.calculatedRate} 
          />
        )}

        {currentView === AppView.REPORTS && (
          <ReportsDashboard 
            invoices={invoices}
            currencySymbol={currentProfile.defaultCurrency === 'EUR' ? '€' : '$'}
            apiKey={currentProfile.apiKeys}
            currentUser={currentProfile}
          />
        )}

        {currentView === AppView.EXPENSES && (
          <ExpenseTracker 
            invoices={invoices}
            currencySymbol={currentProfile.defaultCurrency === 'EUR' ? '€' : '$'}
            onCreateExpense={() => setCurrentView(AppView.EXPENSE_WIZARD)}
            currentProfile={currentProfile}
            onUpdateProfile={handleProfileUpdate}
          />
        )}
        
        {currentView === AppView.SETTINGS && (
          <UserProfileSettings 
            currentUser={currentProfile} 
            onUpdate={handleProfileUpdate} 
          />
        )}
      </Layout>

      <SupportWidget apiKeys={currentProfile.apiKeys} />

      {/* MOBILE FAB & MENU */}
      <div className="md:hidden">
         {!showMobileMenu && (
           <button onClick={() => setShowMobileMenu(true)} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-16 h-16 bg-[#27bea5] rounded-full flex items-center justify-center text-white shadow-2xl hover:scale-110 transition-transform">
             <Plus className="w-8 h-8" />
           </button>
         )}
         {showMobileMenu && (
           <div className="fixed inset-0 z-[100] backdrop-blur-md bg-white/30 flex flex-col justify-end pb-24 px-6 animate-in fade-in duration-200">
              <div className="space-y-4 max-w-sm mx-auto w-full">
                 <button onClick={() => handleMenuAction(AppView.WIZARD)} className="w-full bg-white p-4 rounded-2xl shadow-xl flex items-center gap-4 text-[#1c2938] hover:bg-slate-50 transition-colors group">
                    <div className="w-12 h-12 rounded-full bg-[#27bea5]/10 flex items-center justify-center text-[#27bea5] group-hover:bg-[#27bea5] group-hover:text-white transition-colors"><FileText className="w-6 h-6" /></div>
                    <span className="font-bold text-lg">Nueva Factura</span>
                 </button>
                 <button onClick={() => handleMenuAction(AppView.WIZARD)} className="w-full bg-white p-4 rounded-2xl shadow-xl flex items-center gap-4 text-[#1c2938] hover:bg-slate-50 transition-colors group">
                    <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors"><FileBadge className="w-6 h-6" /></div>
                    <span className="font-bold text-lg">Nueva Cotización</span>
                 </button>
                 <button onClick={() => handleMenuAction(AppView.CLIENTS)} className="w-full bg-white p-4 rounded-2xl shadow-xl flex items-center gap-4 text-[#1c2938] hover:bg-slate-50 transition-colors group">
                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors"><UserPlus className="w-6 h-6" /></div>
                    <span className="font-bold text-lg">Nuevo Cliente</span>
                 </button>
                 <button onClick={() => handleMenuAction(AppView.EXPENSE_WIZARD)} className="w-full bg-white p-4 rounded-2xl shadow-xl flex items-center gap-4 text-[#1c2938] hover:bg-slate-50 transition-colors group">
                    <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 group-hover:bg-rose-500 group-hover:text-white transition-colors"><TrendingDown className="w-6 h-6" /></div>
                    <span className="font-bold text-lg">Nuevo Gasto</span>
                 </button>
              </div>
              <button onClick={() => setShowMobileMenu(false)} className="fixed bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full flex items-center justify-center text-slate-400 shadow-xl hover:text-slate-600 transition-colors">
                <X className="w-8 h-8" />
              </button>
           </div>
         )}
      </div>
    </div>
  );
};

export default App;