
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import InvoiceWizard from './components/InvoiceWizard';
import SupportWidget from './components/SupportWidget';
import OnboardingWizard from './components/OnboardingWizard';
import InvoiceDetail from './components/InvoiceDetail'; // Import Detail View
import UserProfileSettings from './components/UserProfileSettings'; // Import Settings View
import DocumentList from './components/DocumentList'; // Import New Document List
import ReportsDashboard from './components/ReportsDashboard'; // Import New Reports Dashboard
import CatalogDashboard from './components/CatalogDashboard'; // Import New Catalog Dashboard
import ClientList from './components/ClientList'; // Import New Client List
import { AppView, ProfileType, UserProfile, Invoice, CatalogItem } from './types';
import { fetchInvoicesFromDb, saveInvoiceToDb, deleteInvoiceFromDb } from './services/neon'; // Import Neon Service

// Mock Profiles
const FREELANCE_PROFILE: UserProfile = {
  id: 'p1',
  name: 'Juan Pérez',
  type: ProfileType.FREELANCE,
  taxId: '8-123-456',
  avatar: '',
  isOnboardingComplete: false, // Start here to show onboarding
  defaultServices: [
    { id: 'c1', name: 'Consultoría Estratégica', price: 150, description: 'Sesión de 1 hora de asesoría' },
    { id: 'c2', name: 'Desarrollo Web Básico', price: 800, description: 'Landing page con 3 secciones' },
    { id: 'c3', name: 'Mantenimiento Mensual', price: 200, description: 'Soporte y actualizaciones' },
  ],
  branding: { primaryColor: '#27bea5', templateStyle: 'Modern' },
  defaultCurrency: 'USD',
  plan: 'Emprendedor Pro',
  renewalDate: '15 Nov 2024',
  country: 'Panamá',
  documentSequences: {
    invoicePrefix: 'FAC',
    invoiceNextNumber: 150, // Simulator starting point
    quotePrefix: 'COT',
    quoteNextNumber: 45
  }
};

const COMPANY_PROFILE: UserProfile = {
  id: 'p2',
  name: 'JP Studio SAS',
  type: ProfileType.COMPANY,
  taxId: '15569888-2-2021',
  avatar: '',
  isOnboardingComplete: true,
  defaultServices: [
    { id: 'c1', name: 'Licencia Software Enterprise', price: 5000 },
    { id: 'c2', name: 'Soporte 24/7', price: 1200 },
  ],
  branding: { primaryColor: '#1c2938', templateStyle: 'Classic' },
  defaultCurrency: 'USD',
  plan: 'Empresa Scale',
  renewalDate: '01 Dic 2024',
  country: 'Panamá',
  documentSequences: {
    invoicePrefix: 'F',
    invoiceNextNumber: 1024,
    quotePrefix: 'Q',
    quoteNextNumber: 200
  }
};

// --- DATA GENERATOR (ROBUST MOCK FALLBACK) ---
const generateMockInvoices = (): Invoice[] => {
  const items: Invoice[] = [];
  const now = new Date();
  const clients = ['TechSolutions SRL', 'Restaurante El Sol', 'Agencia Creativa One', 'Consultora Global', 'Startup X', 'Juan Pérez', 'Empresa Demo'];
  
  // Counters to simulate sequence history
  let invSeq = 110;
  let quoteSeq = 20;

  // Helper to create a single invoice
  const createItem = (idSuffix: number, daysAgo: number): Invoice => {
     const d = new Date(now);
     d.setDate(d.getDate() - daysAgo);
     // Add some randomness to time for sorting
     d.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
     
     // Weighted types: More invoices than quotes/expenses
     const rand = Math.random();
     const type = rand > 0.3 ? 'Invoice' : (rand > 0.15 ? 'Quote' : 'Expense');
     
     // ID Generation based on type
     let docId = '';
     if (type === 'Invoice') {
       docId = `FAC-${String(invSeq++).padStart(4, '0')}`;
     } else if (type === 'Quote') {
       docId = `COT-${String(quoteSeq++).padStart(4, '0')}`;
     } else {
       docId = `EXP-${String(idSuffix).padStart(4, '0')}`;
     }

     // UPDATED STATUS LOGIC
     let status: Invoice['status'] = 'Borrador';
     
     if (type === 'Invoice') {
        // Biased towards Aceptada/Enviada for "Success" feeling
        const r = Math.random();
        if (r > 0.4) status = 'Aceptada'; // Paid
        else if (r > 0.2) status = 'Enviada'; // Sent
        else if (r > 0.1) status = 'Seguimiento'; // Follow-up
        else status = 'Creada';
     } else if (type === 'Quote') {
        const r = Math.random();
        if (r > 0.7) status = 'Negociacion';
        else if (r > 0.5) status = 'Seguimiento'; // Viewed
        else if (r > 0.3) status = 'Enviada';
        else if (r > 0.1) status = 'Rechazada';
        else status = 'Borrador';
     } else {
        // Expense
        status = 'Aceptada';
     }

     // Amounts: varied but realistic
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

  // 1. RECENT ACTIVITY (Last 30 Days)
  for (let i = 0; i < 15; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    items.push(createItem(idCounter++, daysAgo));
  }

  // 2. QUARTERLY ACTIVITY (Last 31-90 Days)
  for (let i = 0; i < 20; i++) {
    const daysAgo = Math.floor(Math.random() * 60) + 31; // 31 to 90
    items.push(createItem(idCounter++, daysAgo));
  }

  // 3. YEARLY ACTIVITY (Last 91-365 Days)
  for (let i = 0; i < 40; i++) {
    const daysAgo = Math.floor(Math.random() * 270) + 91; // 91 to 365
    items.push(createItem(idCounter++, daysAgo));
  }
  
  return items.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [currentProfile, setCurrentProfile] = useState<UserProfile>(FREELANCE_PROFILE);
  const [isOffline, setIsOffline] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  
  // Data State
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isDbConnected, setIsDbConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // INITIAL LOAD: Try Neon, Fallback to Mock
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      
      // 1. Try Fetching from Neon
      const dbData = await fetchInvoicesFromDb();
      
      if (dbData && dbData.length > 0) {
        console.log("✅ Connected to Neon DB. Loaded", dbData.length, "invoices.");
        setInvoices(dbData);
        setIsDbConnected(true);
      } else {
        // 2. Fallback to Mock Data generator
        console.warn("⚠️ Could not connect to Neon (or empty). Using robust mock data.");
        setInvoices(generateMockInvoices());
        setIsDbConnected(false);
      }
      setIsLoading(false);
    };

    loadData();
  }, []);

  const toggleProfile = () => {
    setCurrentProfile(prev => prev.id === 'p1' ? COMPANY_PROFILE : FREELANCE_PROFILE);
  };

  const handleSaveInvoice = async (newInvoice: Invoice) => {
    // Initialize timeline for new invoice
    const invoiceWithTimeline: Invoice = {
      ...newInvoice,
      timeline: [
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
    
    // Update Local State Optimistically
    setInvoices([invoiceWithTimeline, ...invoices]);
    setSelectedInvoice(invoiceWithTimeline);

    // Update Sequence Counters in Profile
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
    
    // Persist to Neon DB
    if (isDbConnected || !isOffline) {
       saveInvoiceToDb(invoiceWithTimeline).then(success => {
         if (success) console.log("✅ Saved to Neon DB");
         else console.warn("❌ Failed to save to Neon DB");
       });
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    if (window.confirm("¿Estás seguro de que quieres eliminar este documento? Esta acción no se puede deshacer.")) {
      // 1. Optimistic Update
      const newInvoices = invoices.filter(i => i.id !== id);
      setInvoices(newInvoices);
      if (selectedInvoice?.id === id) setSelectedInvoice(null);

      // 2. DB Delete
      if (isDbConnected || !isOffline) {
        const success = await deleteInvoiceFromDb(id);
        if (success) {
           console.log("✅ Deleted from Neon DB");
        } else {
           console.warn("❌ Failed to delete from DB");
           // Ideally rollback here, but kept simple for prototype
        }
      }
    }
  };

  // --- ACTIONS FOR DOCUMENT LIST ---
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
    
    // Sync update to DB
    const updatedInv = updatedInvoices.find(i => i.id === id);
    if (updatedInv && (isDbConnected || !isOffline)) {
      saveInvoiceToDb(updatedInv);
    }
  };

  const handleConvertQuote = async (quoteId: string) => {
    const quote = invoices.find(i => i.id === quoteId);
    if (!quote) return;

    // 1. Mark Quote as Accepted
    const updatedInvoices = invoices.map(inv => 
      inv.id === quoteId ? { ...inv, status: 'Aceptada' as const } : inv
    );

    // 2. Create new Invoice based on Quote
    const nextInvId = `${currentProfile.documentSequences?.invoicePrefix}-${String(currentProfile.documentSequences?.invoiceNextNumber).padStart(4, '0')}`;
    
    const newInvoice: Invoice = {
      ...quote,
      id: nextInvId,
      type: 'Invoice',
      status: 'Creada', // Start as created
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
    
    // Increment sequence
    setCurrentProfile(prev => ({
      ...prev,
      documentSequences: {
        ...prev.documentSequences!,
        invoiceNextNumber: (prev.documentSequences?.invoiceNextNumber || 0) + 1
      }
    }));
    
    // Sync both to DB
    if (isDbConnected || !isOffline) {
       await saveInvoiceToDb({...quote, status: 'Aceptada'});
       await saveInvoiceToDb(newInvoice);
    }
  };

  const handleInvoiceSelect = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setCurrentView(AppView.INVOICE_DETAIL);
  };

  const handleOnboardingComplete = (data: Partial<UserProfile>) => {
    setCurrentProfile(prev => ({
      ...prev,
      ...data,
      isOnboardingComplete: true,
      // Ensure defaults if not provided
      documentSequences: prev.documentSequences || {
        invoicePrefix: 'FAC',
        invoiceNextNumber: 1,
        quotePrefix: 'COT',
        quoteNextNumber: 1
      }
    }));
  };

  const handleProfileUpdate = (updatedProfile: UserProfile) => {
    setCurrentProfile(updatedProfile);
  };

  const handleCatalogUpdate = (newItems: CatalogItem[]) => {
    setCurrentProfile(prev => ({
      ...prev,
      defaultServices: newItems
    }));
  };

  const pendingCount = invoices.filter(i => i.status === 'PendingSync').length;

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 flex-col gap-4">
        <div className="w-12 h-12 bg-[#27bea5] rounded-xl animate-spin"></div>
        <p className="text-slate-500 font-medium animate-pulse">Conectando a Neon DB...</p>
      </div>
    );
  }

  // Render Onboarding if incomplete
  if (!currentProfile.isOnboardingComplete) {
    return (
      <div className="antialiased text-[#1c2938] font-sans">
        <OnboardingWizard onComplete={handleOnboardingComplete} />
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

        {currentView === AppView.INVOICE_DETAIL && selectedInvoice && (
          <InvoiceDetail 
            invoice={selectedInvoice}
            issuer={currentProfile}
            onBack={() => setCurrentView(AppView.INVOICES)} // Return to list if coming from list
          />
        )}
        
        {/* Document List View */}
        {currentView === AppView.INVOICES && (
          <DocumentList 
            invoices={invoices} 
            onSelectInvoice={handleInvoiceSelect}
            onCreateNew={() => setCurrentView(AppView.WIZARD)}
            onMarkPaid={handleMarkAsPaid}
            onConvertQuote={handleConvertQuote}
            onDeleteInvoice={handleDeleteInvoice} // NEW PROP
            currencySymbol={currentProfile.defaultCurrency === 'EUR' ? '€' : '$'}
          />
        )}

        {/* Client List View */}
        {currentView === AppView.CLIENTS && (
          <ClientList 
            invoices={invoices} 
            onCreateDocument={() => setCurrentView(AppView.WIZARD)}
            currencySymbol={currentProfile.defaultCurrency === 'EUR' ? '€' : '$'}
          />
        )}

        {/* Catalog View */}
        {currentView === AppView.CATALOG && (
          <CatalogDashboard 
            items={currentProfile.defaultServices || []}
            userCountry={currentProfile.country || 'Global'}
            apiKey={currentProfile.apiKeys} // Pass full key object
            onUpdate={handleCatalogUpdate}
          />
        )}

        {/* Reports View */}
        {currentView === AppView.REPORTS && (
          <ReportsDashboard 
            invoices={invoices}
            currencySymbol={currentProfile.defaultCurrency === 'EUR' ? '€' : '$'}
            apiKey={currentProfile.apiKeys} // Pass full key object
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
    </div>
  );
};

export default App;
