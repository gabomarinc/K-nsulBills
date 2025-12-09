
import React, { useState, useEffect } from 'react';
import { AppView, Invoice, UserProfile, CatalogItem } from './types';
import LoginScreen from './components/LoginScreen';
import OnboardingWizard from './components/OnboardingWizard';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import InvoiceWizard from './components/InvoiceWizard';
import DocumentList from './components/DocumentList';
import InvoiceDetail from './components/InvoiceDetail';
import ClientList from './components/ClientList';
import ClientDetail from './components/ClientDetail';
import ReportsDashboard from './components/ReportsDashboard';
import UserProfileSettings from './components/UserProfileSettings';
import CatalogDashboard from './components/CatalogDashboard';
import ExpenseTracker from './components/ExpenseTracker';
import ExpenseWizard from './components/ExpenseWizard';
import ClientWizard from './components/ClientWizard'; // Import the new component
import { 
  authenticateUser, 
  createUserInDb, 
  updateUserProfileInDb, 
  fetchInvoicesFromDb, 
  saveInvoiceToDb, 
  deleteInvoiceFromDb,
  saveClientToDb,
  getUserById 
} from './services/neon';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeView, setActiveView] = useState<AppView>(AppView.DASHBOARD);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedClientName, setSelectedClientName] = useState<string | null>(null);
  const [documentToEdit, setDocumentToEdit] = useState<Invoice | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  
  // SESSION RESTORATION LOGIC
  useEffect(() => {
    const initSession = async () => {
        const storedUserStr = localStorage.getItem('konsul_user_data'); // New Cache
        const storedUserId = localStorage.getItem('konsul_session_id');

        // 1. Optimistic Restore (Instant Load)
        if (storedUserStr) {
           try {
             const cachedUser = JSON.parse(storedUserStr);
             setCurrentUser(cachedUser);
             setIsSessionLoading(false); // Render immediately
           } catch (e) {
             console.error("Cache parse error", e);
           }
        }

        // 2. Network Verification (Background)
        if (storedUserId) {
            try {
                const user = await getUserById(storedUserId);
                if (user) {
                    setCurrentUser(user);
                    // Update cache with fresh data
                    localStorage.setItem('konsul_user_data', JSON.stringify(user));
                } else {
                    // User explicitly not found in DB (deleted/banned/invalid ID)
                    // Only perform logout if we are SURE the user doesn't exist
                    console.warn("User ID invalid or not found in DB. Logging out.");
                    handleLogout();
                }
            } catch (error) {
                console.error("Session verification failed (Network/DB error). Keeping cached session if available.", error);
                // CRITICAL FIX: Do NOT logout on error. 
                // If the DB is unreachable, we stay logged in via cache (Offline Mode).
                // Optionally set offline flag
                setIsOffline(true);
            }
        }
        setIsSessionLoading(false);
    };
    initSession();
  }, []);

  // Load data when user is set
  useEffect(() => {
    if (currentUser) {
      const loadData = async () => {
        const docs = await fetchInvoicesFromDb(currentUser.id);
        if (docs) {
            setInvoices(docs);
            // If data loaded successfully, we are online
            setIsOffline(false);
        } else {
            // Failed to load docs usually means connectivity issue
            setIsOffline(true);
        }
      };
      loadData();
    }
  }, [currentUser]);

  const handleLoginSuccess = (user: UserProfile) => {
    localStorage.setItem('konsul_session_id', user.id);
    localStorage.setItem('konsul_user_data', JSON.stringify(user)); // Cache full profile
    setCurrentUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('konsul_session_id');
    localStorage.removeItem('konsul_user_data');
    setCurrentUser(null);
    setInvoices([]);
    setActiveView(AppView.DASHBOARD);
  };

  const handleOnboardingComplete = async (data: Partial<UserProfile> & { password?: string, email?: string }) => {
    if (data.password && data.email) {
       // Registration Flow
       const success = await createUserInDb(data, data.password, data.email);
       if (success) {
         const user = await authenticateUser(data.email, data.password);
         if (user) handleLoginSuccess(user); // Use handleLoginSuccess to save session
       } else {
         alert("Error al crear cuenta. El correo podría ya estar registrado.");
       }
    } else if (currentUser) {
       // Update Flow
       const updated = { ...currentUser, ...data, isOnboardingComplete: true };
       await updateUserProfileInDb(updated);
       setCurrentUser(updated);
       localStorage.setItem('konsul_user_data', JSON.stringify(updated)); // Sync cache
    }
  };

  const handleSaveInvoice = async (invoice: Invoice) => {
    if (!currentUser) return;
    
    // Optimistic Update
    const exists = invoices.find(i => i.id === invoice.id);
    let newInvoices = [];
    if (exists) {
      newInvoices = invoices.map(i => i.id === invoice.id ? invoice : i);
    } else {
      newInvoices = [invoice, ...invoices];
    }
    setInvoices(newInvoices);
    
    // DB Save
    await saveInvoiceToDb({ ...invoice, userId: currentUser.id });
    
    // Update Client Registry
    if (invoice.clientName) {
       await saveClientToDb({ 
         name: invoice.clientName, 
         taxId: invoice.clientTaxId, 
         email: invoice.clientEmail,
         address: invoice.clientAddress
       }, currentUser.id, 'CLIENT');
    }

    setDocumentToEdit(null);
    // NOTE: Removed setActiveView(AppView.INVOICES) here.
    // The Wizard component will handle the navigation via "View Detail" or "Close" buttons 
    // AFTER the user sees the success screen.
  };

  const handleSaveNewClient = async (clientData: { name: string; taxId: string; email: string; address: string; phone: string }) => {
    if (!currentUser) return;

    // 1. Save to DB
    await saveClientToDb({
      name: clientData.name,
      taxId: clientData.taxId,
      email: clientData.email,
      address: clientData.address
    }, currentUser.id, 'CLIENT');

    // 2. Refresh local view or data if needed
    setActiveView(AppView.CLIENTS);
  };

  const handleDeleteInvoice = async (id: string) => {
    if (!currentUser) return;
    if (window.confirm("¿Estás seguro de que quieres eliminar este documento? Esta acción no se puede deshacer.")) {
      const newInvoices = invoices.filter(i => i.id !== id);
      setInvoices(newInvoices);
      
      if (selectedInvoice?.id === id) {
         setSelectedInvoice(null);
         setActiveView(AppView.INVOICES);
      }
      
      await deleteInvoiceFromDb(id, currentUser.id);
    }
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setDocumentToEdit(invoice);
    setActiveView(AppView.WIZARD);
  };

  const handleUpdateProfile = async (updated: UserProfile) => {
    setCurrentUser(updated);
    localStorage.setItem('konsul_user_data', JSON.stringify(updated)); // Sync cache
    await updateUserProfileInDb(updated);
  };

  const handleUpdateCatalog = async (items: CatalogItem[]) => {
    if (!currentUser) return;
    const updated = { ...currentUser, defaultServices: items };
    setCurrentUser(updated);
    localStorage.setItem('konsul_user_data', JSON.stringify(updated)); // Sync cache
    await updateUserProfileInDb(updated);
  };

  // --- RENDER ---

  // Loading Screen to prevent flicker
  if (isSessionLoading) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
            <div className="w-16 h-16 border-4 border-slate-200 border-t-[#27bea5] rounded-full animate-spin mb-4"></div>
            <p className="text-slate-400 font-medium animate-pulse">Recuperando tu oficina...</p>
        </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginScreen 
        onLoginSuccess={handleLoginSuccess}
        onRegisterClick={() => { 
            // Trigger registration mode via temp user
            setCurrentUser({ 
                id: 'temp_reg', 
                name: '', 
                type: 'Autónomo' as any, 
                taxId: '', 
                avatar: '', 
                isOnboardingComplete: false 
            } as UserProfile);
        }} 
      />
    );
  }

  if (!currentUser.isOnboardingComplete) {
    return <OnboardingWizard onComplete={handleOnboardingComplete} />;
  }

  return (
    <Layout 
      activeView={activeView} 
      onNavigate={setActiveView}
      currentProfile={currentUser}
      onSwitchProfile={() => {}}
      isOffline={isOffline}
      onToggleOffline={() => setIsOffline(!isOffline)}
      pendingInvoicesCount={invoices.filter(i => i.status === 'PendingSync').length}
      onLogout={handleLogout}
    >
      {activeView === AppView.DASHBOARD && (
        <Dashboard 
          recentInvoices={invoices}
          isOffline={isOffline}
          pendingCount={invoices.filter(i => i.status === 'PendingSync').length}
          onNewAction={() => { setDocumentToEdit(null); setActiveView(AppView.WIZARD); }}
          onSelectInvoice={(inv) => { setSelectedInvoice(inv); setActiveView(AppView.INVOICE_DETAIL); }}
          onNavigate={setActiveView}
        />
      )}

      {activeView === AppView.WIZARD && (
        <InvoiceWizard 
          currentUser={currentUser}
          isOffline={isOffline}
          onSave={handleSaveInvoice}
          onCancel={() => { setDocumentToEdit(null); setActiveView(AppView.DASHBOARD); }}
          onViewDetail={() => {
             // Find the invoice that was just created/edited (using ID matching would be better, but selecting by most recent works for now or let Wizard pass ID)
             // Ideally InvoiceWizard should pass the ID to onViewDetail, but since we rely on `selectedInvoice` state:
             // The wizard logic sets state in App via onSave. We just need to navigate.
             // We can find the invoice in the updated list or pass it.
             // Since onSave is async, the invoice is already in state.
             const targetId = documentToEdit?.id; 
             // We'll trust the Wizard has already updated the parent state via onSave.
             // The Wizard will actually handle the detailed selection if we pass logic there? 
             // Simpler: Just navigate to INVOICE_DETAIL. The Wizard's "View Detail" button should probably invoke `onSelectInvoice` behavior.
             // For now, let's just switch view, assuming user will select or we select the latest.
             // BETTER: Let's assume onSave set the state.
             setActiveView(AppView.INVOICES); // Fallback to list if specific selection is tricky
          }}
          // Passing a specific setter to ensure the detail view opens correctly
          onSelectInvoiceForDetail={(inv) => {
             setSelectedInvoice(inv);
             setActiveView(AppView.INVOICE_DETAIL);
          }}
          initialData={documentToEdit}
        />
      )}

      {activeView === AppView.INVOICES && (
        <DocumentList 
          invoices={invoices}
          onSelectInvoice={(inv) => { setSelectedInvoice(inv); setActiveView(AppView.INVOICE_DETAIL); }}
          onCreateNew={() => { setDocumentToEdit(null); setActiveView(AppView.WIZARD); }}
          onDeleteInvoice={handleDeleteInvoice}
          onEditInvoice={handleEditInvoice} 
          currencySymbol={currentUser.defaultCurrency === 'EUR' ? '€' : '$'}
          currentUser={currentUser}
        />
      )}

      {activeView === AppView.INVOICE_DETAIL && selectedInvoice && (
        <InvoiceDetail 
          invoice={selectedInvoice}
          issuer={currentUser}
          onBack={() => setActiveView(AppView.INVOICES)}
          onUpdateInvoice={(updated) => {
             setInvoices(invoices.map(i => i.id === updated.id ? updated : i));
             setSelectedInvoice(updated);
             saveInvoiceToDb({ ...updated, userId: currentUser.id });
          }}
          onEdit={handleEditInvoice}
        />
      )}

      {activeView === AppView.CLIENTS && (
        <ClientList 
          invoices={invoices}
          onCreateDocument={() => { setDocumentToEdit(null); setActiveView(AppView.WIZARD); }}
          onCreateClient={() => setActiveView(AppView.CLIENT_WIZARD)} // Navigate to wizard
          currencySymbol={currentUser.defaultCurrency === 'EUR' ? '€' : '$'}
          currentUser={currentUser}
          onSelectClient={(name) => { setSelectedClientName(name); setActiveView(AppView.CLIENT_DETAIL); }}
        />
      )}

      {activeView === AppView.CLIENT_WIZARD && (
        <ClientWizard 
          onSave={handleSaveNewClient}
          onCancel={() => setActiveView(AppView.CLIENTS)}
        />
      )}

      {activeView === AppView.CLIENT_DETAIL && selectedClientName && (
         <ClientDetail 
           clientName={selectedClientName}
           invoices={invoices}
           onBack={() => setActiveView(AppView.CLIENTS)}
           onSelectInvoice={(inv) => { setSelectedInvoice(inv); setActiveView(AppView.INVOICE_DETAIL); }}
           currencySymbol={currentUser.defaultCurrency === 'EUR' ? '€' : '$'}
           onUpdateClientContact={async (name, contact) => {
              await saveClientToDb({ name, ...contact }, currentUser.id, 'CLIENT');
           }}
         />
      )}

      {activeView === AppView.EXPENSES && (
        <ExpenseTracker 
          invoices={invoices}
          currencySymbol={currentUser.defaultCurrency === 'EUR' ? '€' : '$'}
          onCreateExpense={() => setActiveView(AppView.EXPENSE_WIZARD)}
          currentProfile={currentUser}
          onUpdateProfile={handleUpdateProfile}
        />
      )}

      {activeView === AppView.EXPENSE_WIZARD && (
        <ExpenseWizard 
          currentUser={currentUser}
          onSave={(inv) => { handleSaveInvoice(inv); setActiveView(AppView.EXPENSES); }}
          onCancel={() => setActiveView(AppView.EXPENSES)}
        />
      )}

      {activeView === AppView.CATALOG && (
        <CatalogDashboard 
          items={currentUser.defaultServices || []}
          userCountry={currentUser.country || 'Global'}
          apiKey={currentUser.apiKeys}
          onUpdate={handleUpdateCatalog}
          referenceHourlyRate={currentUser.hourlyRateConfig?.calculatedRate}
        />
      )}

      {activeView === AppView.REPORTS && (
        <ReportsDashboard 
          invoices={invoices}
          currencySymbol={currentUser.defaultCurrency === 'EUR' ? '€' : '$'}
          apiKey={currentUser.apiKeys}
          currentUser={currentUser}
        />
      )}

      {activeView === AppView.SETTINGS && (
        <UserProfileSettings 
          currentUser={currentUser}
          onUpdate={handleUpdateProfile}
        />
      )}

    </Layout>
  );
};

export default App;
