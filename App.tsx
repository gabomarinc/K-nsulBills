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
import { 
  authenticateUser, 
  createUserInDb, 
  updateUserProfileInDb, 
  fetchInvoicesFromDb, 
  saveInvoiceToDb, 
  deleteInvoiceFromDb,
  saveClientToDb
} from './services/neon';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeView, setActiveView] = useState<AppView>(AppView.DASHBOARD);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedClientName, setSelectedClientName] = useState<string | null>(null);
  const [documentToEdit, setDocumentToEdit] = useState<Invoice | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  
  // Load data when user is set
  useEffect(() => {
    if (currentUser) {
      const loadData = async () => {
        const docs = await fetchInvoicesFromDb(currentUser.id);
        if (docs) setInvoices(docs);
      };
      loadData();
    }
  }, [currentUser]);

  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
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
         if (user) setCurrentUser(user);
       } else {
         alert("Error al crear cuenta. El correo podría ya estar registrado.");
       }
    } else if (currentUser) {
       // Update Flow
       const updated = { ...currentUser, ...data, isOnboardingComplete: true };
       await updateUserProfileInDb(updated);
       setCurrentUser(updated);
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
    setActiveView(AppView.INVOICES);
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
    await updateUserProfileInDb(updated);
  };

  const handleUpdateCatalog = async (items: CatalogItem[]) => {
    if (!currentUser) return;
    const updated = { ...currentUser, defaultServices: items };
    setCurrentUser(updated);
    await updateUserProfileInDb(updated);
  };

  // --- RENDER ---

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
          onViewDetail={() => setActiveView(AppView.INVOICE_DETAIL)}
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
          currencySymbol={currentUser.defaultCurrency === 'EUR' ? '€' : '$'}
          currentUser={currentUser}
          onSelectClient={(name) => { setSelectedClientName(name); setActiveView(AppView.CLIENT_DETAIL); }}
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