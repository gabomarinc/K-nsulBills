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
import ExpenseTracker from './components/ExpenseTracker'; 
import ExpenseWizard from './components/ExpenseWizard'; 
import { AppView, ProfileType, UserProfile, Invoice, CatalogItem } from './types';
import { fetchInvoicesFromDb, saveInvoiceToDb, deleteInvoiceFromDb, createUserInDb, updateUserProfileInDb } from './services/neon'; 
import { sendEmail, generateWelcomeHtml } from './services/resendService';
import { Plus, X, FileText, FileBadge, UserPlus, TrendingDown } from 'lucide-react';

// Mock Profiles (kept for fallback)
const FREELANCE_PROFILE: UserProfile = {
  id: 'p1',
  name: 'Juan Pérez',
  type: ProfileType.FREELANCE,
  taxId: '8-123-456',
  avatar: '',
  isOnboardingComplete: false, 
  defaultServices: [],
  branding: { primaryColor: '#27bea5', templateStyle: 'Modern' },
  defaultCurrency: 'USD',
  plan: 'Emprendedor Pro',
  renewalDate: '15 Nov 2024',
  country: 'Panamá',
};

const COMPANY_PROFILE: UserProfile = {
  id: 'p2',
  name: 'JP Studio SAS',
  type: ProfileType.COMPANY,
  taxId: '15569888-2-2021',
  avatar: '',
  isOnboardingComplete: true,
  defaultServices: [],
  branding: { primaryColor: '#1c2938', templateStyle: 'Classic' },
  defaultCurrency: 'USD',
  plan: 'Empresa Scale',
  renewalDate: '01 Dic 2024',
  country: 'Panamá',
};

// --- DATA GENERATOR (ROBUST MOCK FALLBACK) ---
const generateMockInvoices = (): Invoice[] => {
  const items: Invoice[] = [];
  const now = new Date();
  const clients = ['TechSolutions SRL', 'Restaurante El Sol', 'Agencia Creativa One', 'Consultora Global', 'Startup X', 'Juan Pérez', 'Empresa Demo'];
  let invSeq = 110;
  let quoteSeq = 20;

  const createItem = (idSuffix: number, daysAgo: number): Invoice => {
     const d = new Date(now);
     d.setDate(d.getDate() - daysAgo);
     d.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
     
     const rand = Math.random();
     const type = rand > 0.3 ? 'Invoice' : (rand > 0.15 ? 'Quote' : 'Expense');
     
     let docId = '';
     if (type === 'Invoice') {
       docId = `FAC-${String(invSeq++).padStart(4, '0')}`;
     } else if (type === 'Quote') {
       docId = `COT-${String(quoteSeq++).padStart(4, '0')}`;
     } else {
       docId = `EXP-${String(idSuffix).padStart(4, '0')}`;
     }

     let status: Invoice['status'] = 'Borrador';
     if (type === 'Invoice') {
        const r = Math.random();
        if (r > 0.4) status = 'Aceptada'; 
        else if (r > 0.2) status = 'Enviada'; 
        else if (r > 0.1) status = 'Seguimiento'; 
        else status = 'Creada';
     } else if (type === 'Quote') {
        const r = Math.random();
        if (r > 0.7) status = 'Negociacion';
        else if (r > 0.5) status = 'Seguimiento'; 
        else if (r > 0.3) status = 'Enviada';
        else if (r > 0.1) status = 'Rechazada';
        else status = 'Borrador';
     } else {
        status = 'Aceptada';
     }

     const amount = Math.floor(Math.random() * 2500) + 150;

     return {
        id: docId,
        clientName: clients[Math.floor(Math.random() * clients.length)],
        clientTaxId: `TAX-${Math.floor(Math.random() * 9999)}`,
        date: d.toISOString(),
        items: [{
          id: `item-${idSuffix}`,
          description: type === 'Expense' ? 'Material de Oficina' : 'Servicios Profesionales',
          quantity: 1,
          price: amount,
          tax: 21
        }],
        total: amount * 1.21,
        status: status,
        currency: 'USD',
        type: type,
        successProbability: type === 'Quote' ? Math.floor(Math.random() * 40) + 50 : undefined,
        timeline: [
          { id: `t1-${idSuffix}`, type: 'CREATED', title: 'Creado', timestamp: d.toISOString() }
        ]
     };
  };

  let idCounter = 0;
  for (let i = 0; i < 15; i++) { items.push(createItem(idCounter++, Math.floor(Math.random() * 30))); }
  for (let i = 0; i < 20; i++) { items.push(createItem(idCounter++, Math.floor(Math.random() * 60) + 31)); }
  for (let i = 0; i < 40; i++) { items.push(createItem(idCounter++, Math.floor(Math.random() * 270) + 91)); }
  
  return items.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

const App: React.FC = () => {
  // --- AUTH STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<UserProfile>(FREELANCE_PROFILE);
  const [showRegister, setShowRegister] = useState(false);

  // --- APP STATE ---
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [isOffline, setIsOffline] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isDbConnected, setIsDbConnected] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // MOBILE MENU STATE
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // LOAD DATA HELPER
  const refreshData = async () => {
    setIsLoadingData(true);
    const dbData = await fetchInvoicesFromDb();
    
    if (dbData && dbData.length > 0) {
      console.log("✅ Connected to Neon DB. Loaded", dbData.length, "docs (Invoices + Expenses).");
      setInvoices(dbData);
      setIsDbConnected(true);
    } else {
      console.warn("⚠️ Using robust mock data.");
      if (invoices.length === 0) {
        setInvoices(generateMockInvoices());
      }
      setIsDbConnected(false);
    }
    setIsLoadingData(false);
  };

  // LOAD DATA EFFECT
  useEffect(() => {
    if (!isAuthenticated) return;
    refreshData();
  }, [isAuthenticated]);

  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentProfile(user);
    setIsAuthenticated(true);
  };

  const toggleProfile = () => {
    setCurrentProfile(prev => prev.id === 'p1' ? COMPANY_PROFILE : FREELANCE_PROFILE);
  };

  const handleSaveInvoice = async (newInvoice: Invoice) => {
    const invoiceWithTimeline: Invoice = {
      ...newInvoice,
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
    
    setInvoices([invoiceWithTimeline, ...invoices]);
    setSelectedInvoice(invoiceWithTimeline);

    // Update Sequences only for Sales Docs
    if (newInvoice.type === 'Invoice') {
      setCurrentProfile(prev => ({
        ...prev,
        documentSequences: {
          ...prev.documentSequences!,
          invoiceNextNumber: (prev.documentSequences?.invoiceNextNumber || 0) + 1
        }
      }));
    } else if (newInvoice.type === 'Quote') {
      setCurrentProfile(prev => ({
        ...prev,
        documentSequences: {
          ...prev.documentSequences!,
          quoteNextNumber: (prev.documentSequences?.quoteNextNumber || 0) + 1
        }
      }));
    }
    
    if (isDbConnected || !isOffline) {
       saveInvoiceToDb(invoiceWithTimeline).then(success => {
         if (success) {
            console.log(
                newInvoice.type === 'Expense' 
                ? "✅ Expense Saved to 'expenses' table" 
                : "✅ Document Saved to 'invoices' table"
            );
         }
       });
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    if (window.confirm("¿Estás seguro de que quieres eliminar este documento? Esta acción no se puede deshacer.")) {
      const newInvoices = invoices.filter(i => i.id !== id);
      setInvoices(newInvoices);
      if (selectedInvoice?.id === id) setSelectedInvoice(null);

      if (isDbConnected || !isOffline) {
        await deleteInvoiceFromDb(id);
      }
    }
  };

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
    if (updatedInv && (isDbConnected || !isOffline)) {
      saveInvoiceToDb(updatedInv);
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
    
    setCurrentProfile(prev => ({
      ...prev,
      documentSequences: {
        ...prev.documentSequences!,
        invoiceNextNumber: (prev.documentSequences?.invoiceNextNumber || 0) + 1
      }
    }));
    
    if (isDbConnected || !isOffline) {
       await saveInvoiceToDb({...quote, status: 'Aceptada'});
       await saveInvoiceToDb(newInvoice);
    }
  };

  const handleInvoiceSelect = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setCurrentView(AppView.INVOICE_DETAIL);
  };

  const handleOnboardingComplete = async (data: Partial<UserProfile> & { password?: string, email?: string }) => {
    const newProfile = {
      ...currentProfile,
      ...data,
      isOnboardingComplete: true,
      documentSequences: currentProfile.documentSequences || {
        invoicePrefix: 'FAC', invoiceNextNumber: 1,
        quotePrefix: 'COT', quoteNextNumber: 1
      }
    };

    // Try to create user in DB if password provided
    if (data.password && data.email) {
       try {
         const success = await createUserInDb(newProfile, data.password, data.email);
         if (success) {
            console.log("User created in DB securely");
            
            // Try to send Welcome Email using System Key
            await sendEmail(
                data.email, 
                'Bienvenido a FacturaZen 🚀', 
                generateWelcomeHtml(newProfile.name)
            );
         }
       } catch (e) {
         console.error("Failed to create user in DB", e);
         alert("Error al crear usuario en base de datos. Se procederá en modo local.");
       }
    }

    setCurrentProfile(newProfile);
    setIsAuthenticated(true);
    setShowRegister(false);
  };

  const handleProfileUpdate = async (updatedProfile: UserProfile) => {
    setCurrentProfile(updatedProfile);
    if (isDbConnected || !isOffline) {
       try {
         await updateUserProfileInDb(updatedProfile);
         await refreshData();
       } catch (e) {
         console.error("DB Sync Error:", e);
       }
    }
  };

  const handleCatalogUpdate = (newItems: CatalogItem[]) => {
    const updatedProfile = {
      ...currentProfile,
      defaultServices: newItems
    };
    handleProfileUpdate(updatedProfile);
  };

  const pendingCount = invoices.filter(i => i.status === 'PendingSync').length;

  // --- MENU ACTION HANDLERS ---
  const handleMenuAction = (view: AppView) => {
    setCurrentView(view);
    setShowMobileMenu(false);
  };

  // --- RENDER FLOW ---

  if (isLoadingData && invoices.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 flex-col gap-4">
        <div className="w-12 h-12 bg-[#27bea5] rounded-xl animate-spin"></div>
        <p className="text-slate-500 font-medium animate-pulse">Sincronizando oficina virtual...</p>
      </div>
    );
  }

  if (showRegister || (isAuthenticated && !currentProfile.isOnboardingComplete)) {
    return (
      <div className="antialiased text-[#1c2938] font-sans">
        <OnboardingWizard onComplete={handleOnboardingComplete} />
        {!isAuthenticated && (
           <div className="fixed bottom-4 left-4 z-50">
              <button onClick={() => setShowRegister(false)} className="text-slate-400 text-sm hover:text-[#1c2938] font-bold">
                 ← Volver al Login
              </button>
           </div>
        )}
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="antialiased text-[#1c2938] font-sans">
        <LoginScreen 
          onLoginSuccess={handleLoginSuccess} 
          onRegisterClick={() => setShowRegister(true)} 
        />
      </div>
    );
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
      >
        {currentView === AppView.DASHBOARD && (
          <Dashboard 
            recentInvoices={invoices} 
            isOffline={isOffline}
            pendingCount={pendingCount}
            onNewAction={() => setCurrentView(AppView.WIZARD)}
            onSelectInvoice={handleInvoiceSelect}
            onNavigate={setCurrentView} // Passed to mobile dashboard
          />
        )}
        
        {currentView === AppView.WIZARD && (
          <InvoiceWizard
            currentUser={currentProfile}
            isOffline={isOffline}
            onSave={handleSaveInvoice}
            onCancel={() => setCurrentView(AppView.DASHBOARD)}
            onViewDetail={() => {
              if (selectedInvoice) {
                setCurrentView(AppView.INVOICE_DETAIL);
              } else {
                setCurrentView(AppView.DASHBOARD);
              }
            }}
          />
        )}

        {currentView === AppView.EXPENSE_WIZARD && (
          <ExpenseWizard 
            currentUser={currentProfile}
            onSave={handleSaveInvoice}
            onCancel={() => setCurrentView(AppView.EXPENSES)}
          />
        )}

        {currentView === AppView.INVOICE_DETAIL && selectedInvoice && (
          <InvoiceDetail 
            invoice={selectedInvoice}
            issuer={currentProfile}
            onBack={() => setCurrentView(AppView.INVOICES)} 
          />
        )}
        
        {currentView === AppView.INVOICES && (
          <DocumentList 
            invoices={invoices} 
            onSelectInvoice={handleInvoiceSelect}
            onCreateNew={() => setCurrentView(AppView.WIZARD)}
            onMarkPaid={handleMarkAsPaid}
            onConvertQuote={handleConvertQuote}
            onDeleteInvoice={handleDeleteInvoice} 
            currencySymbol={currentProfile.defaultCurrency === 'EUR' ? '€' : '$'}
            currentUser={currentProfile} // PASSED FOR AI KEY CHECK
          />
        )}

        {currentView === AppView.CLIENTS && (
          <ClientList 
            invoices={invoices} 
            onCreateDocument={() => setCurrentView(AppView.WIZARD)}
            currencySymbol={currentProfile.defaultCurrency === 'EUR' ? '€' : '$'}
            currentUser={currentProfile} // PASSED FOR AI KEY CHECK
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
         {/* FAB */}
         {!showMobileMenu && (
           <button 
             onClick={() => setShowMobileMenu(true)}
             className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-16 h-16 bg-[#27bea5] rounded-full flex items-center justify-center text-white shadow-2xl hover:scale-110 transition-transform"
           >
             <Plus className="w-8 h-8" />
           </button>
         )}

         {/* MENU OVERLAY */}
         {showMobileMenu && (
           <div className="fixed inset-0 z-[100] backdrop-blur-md bg-white/30 flex flex-col justify-end pb-24 px-6 animate-in fade-in duration-200">
              <div className="space-y-4 max-w-sm mx-auto w-full">
                 <button 
                   onClick={() => handleMenuAction(AppView.WIZARD)}
                   className="w-full bg-white p-4 rounded-2xl shadow-xl flex items-center gap-4 text-[#1c2938] hover:bg-slate-50 transition-colors group"
                 >
                    <div className="w-12 h-12 rounded-full bg-[#27bea5]/10 flex items-center justify-center text-[#27bea5] group-hover:bg-[#27bea5] group-hover:text-white transition-colors">
                       <FileText className="w-6 h-6" />
                    </div>
                    <span className="font-bold text-lg">Nueva Factura</span>
                 </button>

                 <button 
                   onClick={() => handleMenuAction(AppView.WIZARD)}
                   className="w-full bg-white p-4 rounded-2xl shadow-xl flex items-center gap-4 text-[#1c2938] hover:bg-slate-50 transition-colors group"
                 >
                    <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                       <FileBadge className="w-6 h-6" />
                    </div>
                    <span className="font-bold text-lg">Nueva Cotización</span>
                 </button>

                 <button 
                   onClick={() => handleMenuAction(AppView.CLIENTS)}
                   className="w-full bg-white p-4 rounded-2xl shadow-xl flex items-center gap-4 text-[#1c2938] hover:bg-slate-50 transition-colors group"
                 >
                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                       <UserPlus className="w-6 h-6" />
                    </div>
                    <span className="font-bold text-lg">Nuevo Cliente</span>
                 </button>

                 <button 
                   onClick={() => handleMenuAction(AppView.EXPENSE_WIZARD)}
                   className="w-full bg-white p-4 rounded-2xl shadow-xl flex items-center gap-4 text-[#1c2938] hover:bg-slate-50 transition-colors group"
                 >
                    <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 group-hover:bg-rose-500 group-hover:text-white transition-colors">
                       <TrendingDown className="w-6 h-6" />
                    </div>
                    <span className="font-bold text-lg">Nuevo Gasto</span>
                 </button>
              </div>

              {/* Close Button */}
              <button 
                onClick={() => setShowMobileMenu(false)}
                className="fixed bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full flex items-center justify-center text-slate-400 shadow-xl hover:text-slate-600 transition-colors"
              >
                <X className="w-8 h-8" />
              </button>
           </div>
         )}
      </div>
    </div>
  );
};

export default App;