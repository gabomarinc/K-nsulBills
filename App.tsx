
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

// Fallback profile type for typing, though now we use real data
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

  // MOBILE MENU STATE
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // --- SESSION MANAGEMENT ---
  useEffect(() => {
    // Check for stored session on mount
    const storedUser = localStorage.getItem('facturazen_user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setCurrentProfile(user);
        setIsAuthenticated(true);
      } catch (e) {
        console.error("Failed to parse stored session", e);
        localStorage.removeItem('facturazen_user');
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('facturazen_user');
    setIsAuthenticated(false);
    setInvoices([]);
    setCurrentProfile(DEFAULT_PROFILE);
    setCurrentView(AppView.DASHBOARD);
  };

  // --- DATA LOADING ---
  const refreshData = async () => {
    if (!currentProfile.id) return;

    setIsLoadingData(true);
    // Fetch only invoices for this specific user
    const dbData = await fetchInvoicesFromDb(currentProfile.id);
    
    if (dbData) {
      console.log(`✅ Loaded ${dbData.length} docs from DB for user ${currentProfile.id}`);
      setInvoices(dbData);
      setIsDbConnected(true);
    } else {
      console.warn("⚠️ Failed to fetch DB data or empty. Using empty state.");
      setInvoices([]); // STRICTLY EMPTY if no DB data
      setIsDbConnected(false);
    }
    setIsLoadingData(false);
  };

  // Trigger data load when authenticated
  useEffect(() => {
    if (isAuthenticated && currentProfile.id) {
      refreshData();
    }
  }, [isAuthenticated, currentProfile.id]);

  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentProfile(user);
    setIsAuthenticated(true);
    localStorage.setItem('facturazen_user', JSON.stringify(user));
  };

  const toggleProfile = () => {
    // Feature disabled for now or could implement profile switching logic here
    console.log("Switch profile requested");
  };

  const handleSaveInvoice = async (newInvoice: Invoice) => {
    const invoiceWithMetadata: Invoice = {
      ...newInvoice,
      userId: currentProfile.id, // LINK TO CURRENT USER
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
    
    // Optimistic Update
    setInvoices([invoiceWithMetadata, ...invoices]);
    setSelectedInvoice(invoiceWithMetadata);

    // Update Sequences only for Sales Docs
    if (newInvoice.type === 'Invoice') {
      const updatedProfile = {
        ...currentProfile,
        documentSequences: {
          ...currentProfile.documentSequences!,
          invoiceNextNumber: (currentProfile.documentSequences?.invoiceNextNumber || 0) + 1
        }
      };
      setCurrentProfile(updatedProfile);
      localStorage.setItem('facturazen_user', JSON.stringify(updatedProfile));
      handleProfileUpdate(updatedProfile); // Sync sequences to DB
    } else if (newInvoice.type === 'Quote') {
      const updatedProfile = {
        ...currentProfile,
        documentSequences: {
          ...currentProfile.documentSequences!,
          quoteNextNumber: (currentProfile.documentSequences?.quoteNextNumber || 0) + 1
        }
      };
      setCurrentProfile(updatedProfile);
      localStorage.setItem('facturazen_user', JSON.stringify(updatedProfile));
      handleProfileUpdate(updatedProfile);
    }
    
    // DB Save
    saveInvoiceToDb(invoiceWithMetadata).then(success => {
      if (success) {
        console.log("✅ Document Saved to DB");
      } else {
        console.error("❌ Failed to save document to DB");
      }
    });
  };

  const handleDeleteInvoice = async (id: string) => {
    if (window.confirm("¿Estás seguro de que quieres eliminar este documento? Esta acción no se puede deshacer.")) {
      const newInvoices = invoices.filter(i => i.id !== id);
      setInvoices(newInvoices);
      if (selectedInvoice?.id === id) setSelectedInvoice(null);

      await deleteInvoiceFromDb(id);
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
    if (updatedInv) {
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
    localStorage.setItem('facturazen_user', JSON.stringify(updatedProfile));
    
    await saveInvoiceToDb({...quote, status: 'Aceptada'});
    await saveInvoiceToDb(newInvoice);
    await handleProfileUpdate(updatedProfile);
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

    // Create user in DB
    if (data.password && data.email) {
       try {
         const success = await createUserInDb(newProfile, data.password, data.email);
         if (success) {
            console.log("User created in DB securely");
            // Auto Login context by re-authenticating or just setting profile
            // We need to fetch the ID generated by DB or generate it here.
            // For now, createUserInDb generates ID internally. 
            // Ideally we should get the ID back. 
            // In this flow, user must login after registration for security, 
            // OR we rely on `createUserInDb` returning the profile.
            // Simplified: User must login.
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
    
    // Note: Code normally shouldn't reach here if registration is required
    setCurrentProfile(newProfile);
    setIsAuthenticated(true);
    setShowRegister(false);
  };

  const handleProfileUpdate = async (updatedProfile: UserProfile) => {
    setCurrentProfile(updatedProfile);
    localStorage.setItem('facturazen_user', JSON.stringify(updatedProfile));
    try {
      await updateUserProfileInDb(updatedProfile);
    } catch (e) {
      console.error("DB Sync Error:", e);
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

  if (isLoadingData) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 flex-col gap-4">
        <div className="w-12 h-12 bg-[#27bea5] rounded-xl animate-spin"></div>
        <p className="text-slate-500 font-medium animate-pulse">Sincronizando oficina virtual...</p>
      </div>
    );
  }

  if (showRegister || (isAuthenticated && !currentProfile.isOnboardingComplete && currentProfile.id)) {
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
        onLogout={handleLogout} // Pass Logout Handler
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
            currentUser={currentProfile}
          />
        )}

        {currentView === AppView.CLIENTS && (
          <ClientList 
            invoices={invoices} 
            onCreateDocument={() => setCurrentView(AppView.WIZARD)}
            currencySymbol={currentProfile.defaultCurrency === 'EUR' ? '€' : '$'}
            currentUser={currentProfile} 
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
           <button 
             onClick={() => setShowMobileMenu(true)}
             className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-16 h-16 bg-[#27bea5] rounded-full flex items-center justify-center text-white shadow-2xl hover:scale-110 transition-transform"
           >
             <Plus className="w-8 h-8" />
           </button>
         )}

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
