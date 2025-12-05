
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
import { AppView, ProfileType, UserProfile, Invoice, CatalogItem } from './types';
import { fetchInvoicesFromDb, saveInvoiceToDb } from './services/neon'; // Import Neon Service

// Mock Profiles
const FREELANCE_PROFILE: UserProfile = {
  id: 'p1',
  name: 'Juan Pérez',
  type: ProfileType.FREELANCE,
  taxId: '12345678A',
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
  country: 'México'
};

const COMPANY_PROFILE: UserProfile = {
  id: 'p2',
  name: 'JP Studio SAS',
  type: ProfileType.COMPANY,
  taxId: 'B87654321',
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
  country: 'España'
};

// --- DATA GENERATOR (ROBUST MOCK FALLBACK) ---
const generateMockInvoices = (): Invoice[] => {
  const items: Invoice[] = [];
  const now = new Date();
  const clients = ['TechSolutions SRL', 'Restaurante El Sol', 'Agencia Creativa One', 'Consultora Global', 'Startup X', 'Juan Pérez', 'Empresa Demo'];
  
  // Helper to create a single invoice
  const createItem = (idSuffix: number, daysAgo: number): Invoice => {
     const d = new Date(now);
     d.setDate(d.getDate() - daysAgo);
     // Add some randomness to time for sorting
     d.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
     
     // Weighted types: More invoices than quotes/expenses
     const rand = Math.random();
     const type = rand > 0.3 ? 'Invoice' : (rand > 0.15 ? 'Quote' : 'Expense');
     
     let status: Invoice['status'] = 'Draft';
     if (type === 'Invoice') {
        // Biased towards Paid/Sent for "Success" feeling
        status = Math.random() > 0.3 ? 'Paid' : (Math.random() > 0.4 ? 'Sent' : 'PendingSync');
     }
     if (type === 'Quote') status = Math.random() > 0.3 ? 'Viewed' : 'Draft';
     if (type === 'Expense') status = 'Paid';

     // Amounts: varied but realistic
     const amount = Math.floor(Math.random() * 2500) + 150;

     return {
        id: `INV-${1000 + idSuffix}`,
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

  // 1. RECENT ACTIVITY (Last 30 Days) - Ensure dense data for "30D" view
  // Generate ~15 items distributed in the last month
  for (let i = 0; i < 15; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    items.push(createItem(idCounter++, daysAgo));
  }

  // 2. QUARTERLY ACTIVITY (Last 31-90 Days) - Ensure data for "90D" view
  // Generate ~20 items
  for (let i = 0; i < 20; i++) {
    const daysAgo = Math.floor(Math.random() * 60) + 31; // 31 to 90
    items.push(createItem(idCounter++, daysAgo));
  }

  // 3. YEARLY ACTIVITY (Last 91-365 Days) - Ensure data for "12M" view
  // Generate ~40 items spread out to show a "curve"
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
           description: 'Creado exitosamente', 
           timestamp: new Date().toISOString() 
         }
      ],
      successProbability: newInvoice.type === 'Quote' ? Math.floor(Math.random() * 30) + 60 : undefined
    };
    
    // Update Local State Optimistically
    setInvoices([invoiceWithTimeline, ...invoices]);
    setSelectedInvoice(invoiceWithTimeline);
    
    // Persist to Neon DB (Fire and forget style for UI responsiveness)
    if (isDbConnected || !isOffline) {
       saveInvoiceToDb(invoiceWithTimeline).then(success => {
         if (success) console.log("✅ Saved to Neon DB");
         else console.warn("❌ Failed to save to Neon DB");
       });
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
      isOnboardingComplete: true
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
            currencySymbol={currentProfile.defaultCurrency === 'EUR' ? '€' : '$'}
          />
        )}

        {/* Catalog View */}
        {currentView === AppView.CATALOG && (
          <CatalogDashboard 
            items={currentProfile.defaultServices || []}
            userCountry={currentProfile.country || 'Global'}
            apiKey={currentProfile.apiKeys?.gemini}
            onUpdate={handleCatalogUpdate}
          />
        )}

        {/* Reports View */}
        {currentView === AppView.REPORTS && (
          <ReportsDashboard 
            invoices={invoices}
            currencySymbol={currentProfile.defaultCurrency === 'EUR' ? '€' : '$'}
            apiKey={currentProfile.apiKeys?.gemini}
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
