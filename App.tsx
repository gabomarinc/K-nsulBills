import React, { useState, useEffect } from 'react';
import { AppView, Invoice, UserProfile, CatalogItem, InvoiceStatus, TimelineEvent } from './types';
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
import ClientWizard from './components/ClientWizard'; 
import { 
  authenticateUser, 
  createUserInDb, 
  updateUserProfileInDb, 
  fetchInvoicesFromDb, 
  saveInvoiceToDb, 
  deleteInvoiceFromDb,
  saveClientToDb,
  getUserById,
  fetchClientsFromDb 
} from './services/neon';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeView, setActiveView] = useState<AppView>(AppView.DASHBOARD);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [dbClients, setDbClients] = useState<any[]>([]); // NEW: Store pure clients
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedClientName, setSelectedClientName] = useState<string | null>(null);
  const [documentToEdit, setDocumentToEdit] = useState<Invoice | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  
  // SESSION RESTORATION LOGIC
  useEffect(() => {
    const initSession = async () => {
        const storedUserStr = localStorage.getItem('konsul_user_data'); 
        const storedUserId = localStorage.getItem('konsul_session_id');

        if (storedUserStr) {
           try {
             const cachedUser = JSON.parse(storedUserStr);
             setCurrentUser(cachedUser);
             setIsSessionLoading(false); 
           } catch (e) {
             console.error("Cache parse error", e);
           }
        }

        if (storedUserId) {
            try {
                const user = await getUserById(storedUserId);
                if (user) {
                    setCurrentUser(user);
                    localStorage.setItem('konsul_user_data', JSON.stringify(user));
                } else {
                    console.warn("User ID invalid or not found in DB. Logging out.");
                    handleLogout();
                }
            } catch (error) {
                console.error("Session verification failed. Keeping cached session.", error);
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
        // Fetch Invoices
        const docs = await fetchInvoicesFromDb(currentUser.id);
        if (docs) {
            setInvoices(docs);
            setIsOffline(false);
        } else {
            setIsOffline(true);
        }

        // Fetch Clients (NEW)
        const clients = await fetchClientsFromDb(currentUser.id);
        if (clients) {
            setDbClients(clients);
        }
      };
      loadData();
    }
  }, [currentUser]);

  const handleLoginSuccess = (user: UserProfile) => {
    localStorage.setItem('konsul_session_id', user.id);
    localStorage.setItem('konsul_user_data', JSON.stringify(user)); 
    setCurrentUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('konsul_session_id');
    localStorage.removeItem('konsul_user_data');
    setCurrentUser(null);
    setInvoices([]);
    setDbClients([]);
    setActiveView(AppView.DASHBOARD);
  };

  const handleOnboardingComplete = async (data: Partial<UserProfile> & { password?: string, email?: string }) => {
    if (data.password && data.email) {
       const success = await createUserInDb(data, data.password, data.email);
       if (success) {
         const user = await authenticateUser(data.email, data.password);
         if (user) handleLoginSuccess(user);
       } else {
         alert("Error al crear cuenta. El correo podría ya estar registrado.");
       }
    } else if (currentUser) {
       const updated = { ...currentUser, ...data, isOnboardingComplete: true };
       await updateUserProfileInDb(updated);
       setCurrentUser(updated);
       localStorage.setItem('konsul_user_data', JSON.stringify(updated));
    }
  };

  const handleSaveInvoice = async (invoice: Invoice) => {
    if (!currentUser) return;
    
    const exists = invoices.find(i => i.id === invoice.id);
    let newInvoices = [];
    if (exists) {
      newInvoices = invoices.map(i => i.id === invoice.id ? invoice : i);
    } else {
      newInvoices = [invoice, ...invoices];
    }
    setInvoices(newInvoices);
    
    await saveInvoiceToDb({ ...invoice, userId: currentUser.id });
    
    if (invoice.clientName) {
       await saveClientToDb({ 
         name: invoice.clientName, 
         taxId: invoice.clientTaxId, 
         email: invoice.clientEmail,
         address: invoice.clientAddress
       }, currentUser.id, 'CLIENT');
       
       const updatedClients = await fetchClientsFromDb(currentUser.id);
       setDbClients(updatedClients);
    }

    setDocumentToEdit(null);
  };

  const handleUpdateStatus = async (id: string, newStatus: InvoiceStatus) => {
    if (!currentUser) return;
    
    const targetInvoice = invoices.find(i => i.id === id);
    if (!targetInvoice) return;

    const event: TimelineEvent = {
        id: Date.now().toString(),
        type: 'STATUS_CHANGE',
        title: `Estado cambiado a ${newStatus}`,
        timestamp: new Date().toISOString()
    };

    const updatedInvoice = { 
        ...targetInvoice, 
        status: newStatus,
        timeline: [...(targetInvoice.timeline || []), event]
    };

    const newInvoices = invoices.map(i => i.id === id ? updatedInvoice : i);
    setInvoices(newInvoices);
    
    if (selectedInvoice?.id === id) {
        setSelectedInvoice(updatedInvoice);
    }

    await saveInvoiceToDb({ ...updatedInvoice, userId: currentUser.id });
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

    // 2. Refresh local view explicitly so it shows up in ClientList
    const updatedClients = await fetchClientsFromDb(currentUser.id);
    setDbClients(updatedClients);

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
    localStorage.setItem('konsul_user_data', JSON.stringify(updated)); 
    await updateUserProfileInDb(updated);
  };

  const handleUpdateCatalog = async (items: CatalogItem[]) => {
    if (!currentUser) return;
    const updated = { ...currentUser, defaultServices: items };
    setCurrentUser(updated);
    localStorage.setItem('konsul_user_data', JSON.stringify(updated)); 
    await updateUserProfileInDb(updated);
  };

  // --- RENDER ---

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
          currentUser={currentUser!}
        />
      )}

      {activeView === AppView.WIZARD && (
        <InvoiceWizard 
          currentUser={currentUser}
          isOffline={isOffline}
          onSave={handleSaveInvoice}
          onCancel={() => { setDocumentToEdit(null); setActiveView(AppView.DASHBOARD); }}
          onViewDetail={() => setActiveView(AppView.INVOICES)}
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
          onUpdateStatus={handleUpdateStatus} // New Prop
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
          onUpdateStatus={handleUpdateStatus} // New Prop
          onEdit={handleEditInvoice}
        />
      )}

      {activeView === AppView.CLIENTS && (
        <ClientList 
          invoices={invoices}
          dbClients={dbClients} 
          onCreateDocument={() => { setDocumentToEdit(null); setActiveView(AppView.WIZARD); }}
          onCreateClient={() => setActiveView(AppView.CLIENT_WIZARD)} 
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
              // Refresh clients
              const updated = await fetchClientsFromDb(currentUser.id);
              setDbClients(updated);
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