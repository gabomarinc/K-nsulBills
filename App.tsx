import React, { useState, useEffect, useMemo } from 'react';
import { AppView, Invoice, UserProfile, CatalogItem, InvoiceStatus, TimelineEvent, DbClient, AccountantTask, ProfileType, BreadcrumbItem } from './types';
import { 
  ChevronRight, Home, Users, FileText, Settings, 
  BarChart3, BookOpen, Wallet, Target, Calculator, Calendar as CalendarIcon 
} from 'lucide-react';
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
import AccountantDashboard from './components/AccountantDashboard';
import AiTaskManager from './components/AiTaskManager';
import FiscalCalculators from './components/FiscalCalculators';
import TaxCalendar from './components/TaxCalendar';
import { AlertProvider, useAlert } from './components/AlertSystem';
import {
  authenticateUser,
  createUserInDb,
  updateUserProfileInDb,
  fetchInvoicesFromDb,
  saveInvoiceToDb,
  deleteInvoiceFromDb,
  saveClientToDb,
  saveProviderToDb,
  getUserById,
  fetchClientsFromDb,
  deleteClientFromDb,
  fetchCatalogItemsFromDb,
  saveCatalogItemToDb,
  deleteCatalogItemFromDb
} from './services/neon';
import { processInvoicesFollowUp } from './services/followUpService';
import { performAutomatedStripeSync } from './services/stripeSyncService';

// --- ROUTING CONFIG ---
const viewToPath: Record<string, string> = {
  [AppView.DASHBOARD]: '/dashboard',
  [AppView.WIZARD]: '/new-document',
  [AppView.INVOICES]: '/documents',
  [AppView.CLIENTS]: '/clients',
  [AppView.SETTINGS]: '/settings',
  [AppView.REPORTS]: '/reports',
  [AppView.CATALOG]: '/catalog',
  [AppView.EXPENSES]: '/expenses',
  [AppView.AI_TASKS]: '/tasks',
  [AppView.FISCAL_CALCULATORS]: '/calculators',
  [AppView.TAX_CALENDAR]: '/calendar',
  [AppView.INVOICE_DETAIL]: '/documents', // Base for details
  [AppView.CLIENT_DETAIL]: '/clients',    // Base for details
  [AppView.EXPENSE_WIZARD]: '/expenses/new',
  [AppView.CLIENT_WIZARD]: '/clients/new',
  [AppView.ACCOUNTANT_DASHBOARD]: '/accountant',
};

const pathToView = Object.entries(viewToPath).reduce((acc, [view, path]) => {
  acc[path] = view as AppView;
  return acc;
}, {} as Record<string, AppView>);

// Wrapper Component to use Hooks
const AppContent: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeView, setActiveView] = useState<AppView>(AppView.DASHBOARD);
  const [docType, setDocType] = useState<'INVOICE' | 'QUOTE'>('INVOICE');
  const [docStage, setDocStage] = useState<string>('ALL_ACTIVE');
  const [clientFilter, setClientFilter] = useState<string>('ALL');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [dbClients, setDbClients] = useState<DbClient[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]); 
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedClientName, setSelectedClientName] = useState<string | null>(null);
  const [documentToEdit, setDocumentToEdit] = useState<Invoice | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(true);

  // Accountant Specific State
  const [managedCompanies, setManagedCompanies] = useState<UserProfile[]>([]);
  const [accountantTasks, setAccountantTasks] = useState<AccountantTask[]>([]);
  const [calcType, setCalcType] = useState<'INTEREST' | 'SANCTION'>('INTEREST');

  const alert = useAlert(); 

  const handleLoginSuccess = async (user: UserProfile) => {
    const isAccountant = user.type === ProfileType.ACCOUNTANT || user.isAccountant;
    const finalUser = { ...user, isAccountant };
    setCurrentUser(finalUser);
    const view = isAccountant ? AppView.ACCOUNTANT_DASHBOARD : AppView.DASHBOARD;
    handleNavigate(view);
    localStorage.setItem('konsul_session_id', finalUser.id);
    localStorage.setItem('konsul_user_data', JSON.stringify(finalUser));

    if (isAccountant) {
      setManagedCompanies([
        { id: 'c1', name: 'Mi Dulce Hogar S.A.', taxId: '123456-1-123456', fiscalConfig: { entityType: 'JURIDICA' } } as UserProfile,
        { id: 'c2', name: 'Tech Solutions Panamá', taxId: '654321-2-654321', fiscalConfig: { entityType: 'JURIDICA' } } as UserProfile,
        { id: 'c3', name: 'Dr. Roberto Mendoza', taxId: '8-888-888', fiscalConfig: { entityType: 'NATURAL' } } as UserProfile,
      ]);
      setAccountantTasks([
        { id: 't1', userId: finalUser.id, title: 'Presentar ITBMS Enero', dueDate: '2026-01-15', priority: 'HIGH', status: 'PENDING', linkedClientId: 'Mi Dulce Hogar S.A.', aiSuggestion: 'Priorizar por flujo de caja' },
        { id: 't2', userId: finalUser.id, title: 'Revisión Planilla SIPE', dueDate: '2026-01-20', priority: 'MEDIUM', status: 'PENDING', linkedClientId: 'Tech Solutions Panamá' },
      ]);
    }
    alert.addToast('success', `Bienvenido, ${user.name}`, isAccountant ? 'Panel de Contador Activado.' : 'Tu sesión ha iniciado correctamente.');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    handleNavigate(AppView.DASHBOARD);
    localStorage.removeItem('konsul_session_id');
    localStorage.removeItem('konsul_user_data');
  };

  // --- NAVIGATION HANDLER ---
  interface NavParams {
    id?: string;
    type?: 'INVOICE' | 'QUOTE';
    stage?: string;
    filter?: string;
    name?: string;
  }

  const handleNavigate = (view: AppView, params: NavParams = {}) => {
    setActiveView(view);
    
    // Update sub-states or RESET if switching to a main tab without params
    if (params.type) setDocType(params.type);
    else if (view === AppView.INVOICES && Object.keys(params).length === 0) setDocType('INVOICE');

    if (params.stage) setDocStage(params.stage);
    else if (view === AppView.INVOICES && Object.keys(params).length === 0) setDocStage('ALL_ACTIVE');

    if (params.filter) setClientFilter(params.filter);
    else if (view === AppView.CLIENTS && Object.keys(params).length === 0) setClientFilter('ALL');

    if (params.name) setSelectedClientName(params.name);
    if (params.id) {
       const found = invoices.find(i => i.id === params.id);
       if (found) setSelectedInvoice(found);
    }

    let path = viewToPath[view] || '/dashboard';
    
    // Build Hierarchical Path
    if (view === AppView.INVOICES) {
      const typeStr = params.type || docType;
      const stageStr = params.stage || (typeStr === 'QUOTE' ? 'SENT_QUOTES' : 'ALL_ACTIVE');
      path = `/documents/${typeStr.toLowerCase()}/${stageStr.toLowerCase()}`;
    } else if (view === AppView.CLIENTS) {
      const filterStr = params.filter || clientFilter;
      path = `/clients/${filterStr.toLowerCase()}`;
    } else if (view === AppView.CLIENT_DETAIL) {
      const nameStr = params.name || selectedClientName;
      path = `/clients/view/${encodeURIComponent(nameStr || '')}`;
    } else if (view === AppView.INVOICE_DETAIL) {
      const idStr = params.id || selectedInvoice?.id;
      path = `/documents/view/${encodeURIComponent(idStr || '')}`;
    }

    if (window.location.pathname !== path) {
      window.history.pushState({ view, params }, '', path);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- SYNC URL TO STATE (History API) ---
  useEffect(() => {
    const syncUrlToState = () => {
      const path = window.location.pathname;
      if (!path || path === '/') return;

      const segments = path.split('/').filter(Boolean);
      const mainPath = `/${segments[0]}`;
      
      const targetView = pathToView[mainPath];
      
      if (targetView) {
        if (mainPath === '/clients') {
          if (segments[1] === 'view' && segments[2]) {
            setActiveView(AppView.CLIENT_DETAIL);
            setSelectedClientName(decodeURIComponent(segments[2]));
          } else {
            setActiveView(AppView.CLIENTS);
            if (segments[1]) setClientFilter(segments[1].toUpperCase());
          }
        } else if (mainPath === '/documents') {
          if (segments[1] === 'view' && segments[2]) {
            setActiveView(AppView.INVOICE_DETAIL);
            const id = decodeURIComponent(segments[2]);
            const found = invoices.find(i => i.id === id);
            if (found) setSelectedInvoice(found);
          } else {
            setActiveView(AppView.INVOICES);
            if (segments[1]) setDocType(segments[1].toUpperCase() as 'INVOICE' | 'QUOTE');
            if (segments[2]) setDocStage(segments[2].toUpperCase());
          }
        } else {
           setActiveView(targetView);
        }
      }
    };

    window.addEventListener('popstate', syncUrlToState);
    if (currentUser) syncUrlToState();
    
    return () => window.removeEventListener('popstate', syncUrlToState);
  }, [currentUser, invoices]);

  // --- BREADCRUMBS HELPER ---
  const breadcrumbs = useMemo(() => {
    const items: BreadcrumbItem[] = [{ label: 'Inicio', view: AppView.DASHBOARD, icon: <Home className="w-3 h-3" /> }];
    
    if (activeView === AppView.DASHBOARD) return items;

    // Mapping for intermediate labels
    const labels: Record<string, string> = {
      [AppView.INVOICES]: 'Documentos',
      [AppView.CLIENTS]: 'Directorio',
      [AppView.CLIENT_DETAIL]: 'Cliente',
      [AppView.SETTINGS]: 'Configuración',
      [AppView.REPORTS]: 'Reportes',
      [AppView.CATALOG]: 'Catálogo',
      [AppView.EXPENSES]: 'Gastos',
      [AppView.ACCOUNTANT_DASHBOARD]: 'Contador',
    };

    // Main Category
    if (activeView === AppView.CLIENT_DETAIL) {
      items.push({ label: 'Directorio', view: AppView.CLIENTS, icon: <Users className="w-3 h-3" /> });
      items.push({ label: selectedClientName || 'Detalle', view: AppView.CLIENT_DETAIL });
    } else if (activeView === AppView.INVOICE_DETAIL) {
      items.push({ label: 'Documentos', view: AppView.INVOICES, icon: <FileText className="w-3 h-3" /> });
      items.push({ label: selectedInvoice ? `${selectedInvoice.type === 'Quote' ? 'Cotización' : 'Factura'} #${selectedInvoice.id}` : 'Detalle', view: AppView.INVOICE_DETAIL });
    } else if (labels[activeView]) {
      items.push({ label: labels[activeView], view: activeView });
    } else {
      items.push({ label: activeView.toLowerCase().replace('_', ' '), view: activeView });
    }

    return items;
  }, [activeView, selectedClientName, selectedInvoice]);

  // SESSION RESTORATION LOGIC
  useEffect(() => {
    const initSession = async () => {
      // Check URL for Stripe return logic
      const params = new URLSearchParams(window.location.search);
      const paymentSuccess = params.get('payment_success');
      const sessionId = params.get('session_id');

      const storedUserStr = localStorage.getItem('konsul_user_data');
      const storedUserId = localStorage.getItem('konsul_session_id');

      // Initialize view from path
      const path = window.location.pathname;
      const initialView = Object.keys(viewToPath).find(key => viewToPath[key] === path) as AppView;
      if (initialView) {
        handleNavigate(initialView);
      }

      if (storedUserStr) {
        try {
          let cachedUser = JSON.parse(storedUserStr);

          // HANDLE STRIPE SUCCESS RETURN & SYNC
          if (paymentSuccess === 'true' && sessionId) {
            try {
              // Fetch real customer ID and renewal date from our backend bridge
              const stripeRes = await fetch(`/api/get-stripe-session?sessionId=${sessionId}`);
              const stripeData = await stripeRes.json();

              if (stripeData.customerId) {
                console.log("Stripe Sync Successful:", stripeData);

                // Merge new data
                const updatedUserWithStripe = {
                  ...cachedUser,
                  stripeCustomerId: stripeData.customerId,
                  renewalDate: stripeData.renewalDate ? new Date(stripeData.renewalDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : cachedUser.renewalDate,
                  plan: stripeData.plan || 'Emprendedor Pro'
                };

                // 1. Update Local State
                cachedUser = updatedUserWithStripe;
                localStorage.setItem('konsul_user_data', JSON.stringify(updatedUserWithStripe));

                // 2. Sync to Neon DB immediately
                await updateUserProfileInDb(updatedUserWithStripe);

                // 3. Notify user
                setTimeout(() => {
                  alert.addToast('success', 'Suscripción Activada', 'Tu cuenta Pro está lista y sincronizada.');
                }, 1000);
              }
            } catch (err) {
              console.error("Error syncing Stripe data:", err);
              // Continue with cached user even if sync fails temporarily
            }

            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
          }

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
            setCurrentUser(prev => {
              if (prev?.stripeCustomerId && !user.stripeCustomerId) {
                return prev;
              }
              return user;
            });
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
  }, [alert]);

  // Load data when user is set
  useEffect(() => {
    if (currentUser) {
      const loadData = async () => {
        // Fetch Invoices
        const docs = await fetchInvoicesFromDb(currentUser.id);
        if (docs) {
          setInvoices(docs);
          setIsOffline(false);

          // NEW: RUN AUTOMATED FOLLOW-UP PROCESS
          // Only if not offline and has a profile set
          if (currentUser.followUpProfile && currentUser.followUpProfile !== 'OFF') {
            const count = await processInvoicesFollowUp(docs, currentUser, (updated) => {
              setInvoices(prev => prev.map(i => i.id === updated.id ? updated : i));
            });

            if (count > 0) {
              setTimeout(() => {
                alert.addToast('info', 'Seguimiento de Pagos', `IA: Se han enviado ${count} recordatorios de pago automáticamente.`);
              }, 2000);
            }
          }
        } else {
          setIsOffline(true);
        }

        // Fetch Clients
        const clients = await fetchClientsFromDb(currentUser.id);
        if (clients) {
          setDbClients(clients);
        }

        // Fetch Catalog Items (NEW)
        // We now load this into its own state variable for reliable rendering
        const items = await fetchCatalogItemsFromDb(currentUser.id);
        if (items) {
          setCatalogItems(items);

          // Legacy sync: Keep profile updated just in case older logic uses it
          setCurrentUser(prev => {
            if (!prev) return null;
            if (JSON.stringify(prev.defaultServices) !== JSON.stringify(items)) {
              return { ...prev, defaultServices: items };
            }
            return prev;
          });
        }

        // --- AUTOMATED STRIPE SYNC (NEW) ---
        if (!isOffline && currentUser.paymentIntegration?.stripeSecretKey) {
          const syncResult = await performAutomatedStripeSync(
            currentUser,
            docs || [], // current invoices from DB
            clients || [], // current clients from DB
            handleSaveInvoice,
            handleUpdateStatus
          );

          if (syncResult.createdCount > 0 || syncResult.autoCount > 0) {
            alert.addToast('success', 'Sincronización Stripe', 
              `Sincronización automática completa: ${syncResult.autoCount} pagos conciliados y ${syncResult.createdCount} facturas nuevas creadas.`);
          }
        }
      };
      loadData();
    }
  }, [currentUser?.id]); // Only re-run if ID changes


  const handleOnboardingComplete = async (data: Partial<UserProfile> & { password?: string, email?: string }) => {
    if (data.password && data.email) {
      const success = await createUserInDb(data, data.password, data.email);
      if (success) {
        const user = await authenticateUser(data.email, data.password);
        if (user) {
          handleLoginSuccess(user);
        }
      } else {
        alert.addToast('error', 'Error de Registro', 'El correo podría ya estar registrado.');
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

      const currentSequences = currentUser.documentSequences || {
        invoicePrefix: 'FAC', invoiceNextNumber: 1,
        quotePrefix: 'COT', quoteNextNumber: 1
      };

      let updatedSequences = { ...currentSequences };
      let profileUpdated = false;

      const idParts = invoice.id.split('-');
      const idNum = parseInt(idParts[idParts.length - 1] || '0', 10);

      if (!isNaN(idNum)) {
        if (invoice.type === 'Invoice') {
          if (idNum >= updatedSequences.invoiceNextNumber) {
            updatedSequences.invoiceNextNumber = idNum + 1;
            profileUpdated = true;
          }
        } else if (invoice.type === 'Quote') {
          if (idNum >= updatedSequences.quoteNextNumber) {
            updatedSequences.quoteNextNumber = idNum + 1;
            profileUpdated = true;
          }
        }
      } else {
        if (invoice.type === 'Invoice') { updatedSequences.invoiceNextNumber += 1; profileUpdated = true; }
        if (invoice.type === 'Quote') { updatedSequences.quoteNextNumber += 1; profileUpdated = true; }
      }

      if (profileUpdated) {
        const updatedUser = { ...currentUser, documentSequences: updatedSequences };
        setCurrentUser(updatedUser);
        localStorage.setItem('konsul_user_data', JSON.stringify(updatedUser));
        updateUserProfileInDb(updatedUser);
      }
    }

    setInvoices(newInvoices);
    await saveInvoiceToDb({ ...invoice, userId: currentUser.id });

    if (invoice.clientName) {
      const cleanName = invoice.clientName.trim();

      if (invoice.type === 'Expense') {
        await saveProviderToDb({
          name: cleanName,
          category: invoice.items[0]?.description || 'General'
        }, currentUser.id);
      } else {
        // Improved Matching Logic: Normalize strings
        const existingClient = dbClients.find(c => c.name.trim().toLowerCase() === cleanName.toLowerCase());
        let clientStatus: 'CLIENT' | 'PROSPECT' = 'PROSPECT';

        if (invoice.type === 'Invoice') {
          clientStatus = 'CLIENT';
        } else if (existingClient && existingClient.status === 'CLIENT') {
          clientStatus = 'CLIENT';
        } else {
          clientStatus = 'PROSPECT';
        }

        // LOGIC CHANGE: Only save if new OR promoting Prospect -> Client
        const isPromotion = existingClient?.status === 'PROSPECT' && clientStatus === 'CLIENT';
        const shouldSaveClient = !existingClient || isPromotion;

        if (shouldSaveClient) {
          const saveResult = await saveClientToDb({
            id: existingClient?.id,
            name: cleanName,
            taxId: invoice.clientTaxId,
            email: invoice.clientEmail,
            address: invoice.clientAddress,
            tags: existingClient?.tags,
            notes: existingClient?.notes,
            phone: existingClient?.phone
          }, currentUser.id, clientStatus);

          if (!saveResult.success) {
            alert.addToast('error', 'Error Base de Datos', 'No se pudo guardar el cliente en el directorio.');
          } else {
            const updatedClients = await fetchClientsFromDb(currentUser.id);
            setDbClients(updatedClients);
          }
        }
      }
    }

    setDocumentToEdit(null);
    alert.addToast('success', 'Documento Guardado', `El documento ${invoice.id} se ha guardado exitosamente.`);
  };

  const handleUpdateStatus = async (id: string, newStatus: InvoiceStatus, extras?: Partial<Invoice>) => {
    if (!currentUser) return;

    const targetInvoice = invoices.find(i => i.id === id);
    if (!targetInvoice) return;

    if (targetInvoice.type === 'Quote' && newStatus === 'Aceptada' && targetInvoice.status !== 'Aceptada') {
      const confirmed = await alert.confirm({
        title: 'Convertir a Factura',
        message: '¿Deseas convertir esta cotización aprobada en una nueva factura de venta?',
        confirmText: 'Sí, Convertir',
        type: 'info'
      });

      if (confirmed) {
        const sequences = currentUser.documentSequences || { invoicePrefix: 'FAC', invoiceNextNumber: 1, quotePrefix: 'COT', quoteNextNumber: 1 };
        let nextNum = sequences.invoiceNextNumber;
        let newInvoiceId = `${sequences.invoicePrefix}-${String(nextNum).padStart(4, '0')}`;

        while (invoices.some(i => i.id === newInvoiceId)) {
          nextNum++;
          newInvoiceId = `${sequences.invoicePrefix}-${String(nextNum).padStart(4, '0')}`;
        }

        const newInvoice: Invoice = {
          ...targetInvoice,
          id: newInvoiceId,
          type: 'Invoice',
          status: 'Enviada',
          date: new Date().toISOString(),
          timeline: [
            { id: Date.now().toString(), type: 'CREATED', title: `Convertida desde ${targetInvoice.id}`, timestamp: new Date().toISOString() }
          ]
        };

        await handleSaveInvoice(newInvoice);

        const quoteEvent: TimelineEvent = {
          id: Date.now().toString(), type: 'APPROVED', title: 'Cotización Aceptada', description: `Convertida a factura ${newInvoiceId}`, timestamp: new Date().toISOString()
        };
        const updatedQuote = { ...targetInvoice, status: newStatus, timeline: [...(targetInvoice.timeline || []), quoteEvent] };

        setInvoices(prev => prev.map(i => i.id === id ? updatedQuote : i));
        await saveInvoiceToDb({ ...updatedQuote, userId: currentUser.id });
        alert.addToast('success', 'Conversión Exitosa', `Se creó la factura ${newInvoiceId}`);
        return;
      }
    }

    const event: TimelineEvent = {
      id: Date.now().toString(),
      type: 'STATUS_CHANGE',
      title: `Estado cambiado a ${newStatus}`,
      description: extras?.notes || '',
      timestamp: new Date().toISOString()
    };

    const updatedInvoice: Invoice = {
      ...targetInvoice,
      ...extras,
      status: newStatus,
      timeline: [...(targetInvoice.timeline || []), event]
    };

    const newInvoices = invoices.map(i => i.id === id ? updatedInvoice : i);
    setInvoices(newInvoices);

    if (selectedInvoice?.id === id) {
      setSelectedInvoice(updatedInvoice);
    }

    await saveInvoiceToDb({ ...updatedInvoice, userId: currentUser.id });

    if (updatedInvoice.type === 'Invoice' && (newStatus === 'Pagada' || newStatus === 'Aceptada')) {
      const clientName = updatedInvoice.clientName.trim();
      // Improved Matching
      const existing = dbClients.find(c => c.name.trim().toLowerCase() === clientName.toLowerCase());
      if (existing) {
        await saveClientToDb({ ...existing, name: clientName }, currentUser.id, 'CLIENT');
        const updated = await fetchClientsFromDb(currentUser.id);
        setDbClients(updated);
      }
    }

    alert.addToast('success', 'Estado Actualizado', `El documento ahora está: ${newStatus}`);
  };

  const handleSaveNewClient = async (clientData: DbClient) => {
    if (!currentUser) return;

    const res = await saveClientToDb({
      name: clientData.name,
      taxId: clientData.taxId,
      email: clientData.email,
      address: clientData.address,
      phone: clientData.phone,
      tags: clientData.tags,
      notes: clientData.notes
    }, currentUser.id, clientData.status || 'PROSPECT');

    if (!res.success) {
      alert.addToast('error', 'Error', res.error || 'No se pudo guardar el cliente.');
      return;
    }

    const updatedClients = await fetchClientsFromDb(currentUser.id);
    setDbClients(updatedClients);

    handleNavigate(AppView.CLIENTS);
    alert.addToast('success', 'Cliente Guardado', `${clientData.name} ha sido añadido a tu directorio.`);
  };

  const handleSaveClient = async (oldName: string | null, updatedClient: DbClient) => {
    if (!currentUser) return;
    
    // Loose matching logic for finding the original client record
    const existing = dbClients.find(c => 
      c.name.trim().toLowerCase() === (oldName || updatedClient.name).trim().toLowerCase()
    );
    const currentStatus = existing?.status || updatedClient.status || 'PROSPECT';

    const res = await saveClientToDb(updatedClient, currentUser.id, currentStatus);
    if (res.success) {
      const updated = await fetchClientsFromDb(currentUser.id);
      setDbClients(updated);
      
      // Update selected name if needed
      if (oldName && updatedClient.name !== oldName) {
        setSelectedClientName(updatedClient.name);
      }
      alert.addToast('success', 'Cliente Actualizado');
    } else {
      alert.addToast('error', 'Error al Guardar', res.error);
    }
  };

  const handleDeleteClient = async (id: string, name: string) => {
    if (!currentUser) return;

    const confirmed = await alert.confirm({
      title: '¿Eliminar Cliente?',
      message: `¿Estás seguro que deseas eliminar a ${name}? Esta acción es irreversible.`,
      confirmText: 'Sí, Eliminar',
      cancelText: 'Cancelar',
      type: 'danger'
    });

    if (confirmed) {
      await deleteClientFromDb(id, currentUser.id);
      
      const updatedClients = dbClients.filter(c => c.id !== id);
      setDbClients(updatedClients);
      
      if (selectedClientName === name) {
        setSelectedClientName(null);
        handleNavigate(AppView.CLIENTS);
      }
      
      alert.addToast('info', 'Cliente Eliminado', `${name} ha sido borrado correctamente.`);
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    if (!currentUser) return;

    const confirmed = await alert.confirm({
      title: '¿Eliminar Documento?',
      message: 'Esta acción es irreversible. El documento desaparecerá de tus registros y reportes.',
      confirmText: 'Sí, Eliminar',
      cancelText: 'Cancelar',
      type: 'danger'
    });

    if (confirmed) {
      const newInvoices = invoices.filter(i => i.id !== id);
      setInvoices(newInvoices);

      if (selectedInvoice?.id === id) {
        setSelectedInvoice(null);
        handleNavigate(AppView.INVOICES);
      }

      await deleteInvoiceFromDb(id, currentUser.id);
      alert.addToast('info', 'Documento Eliminado', 'El registro ha sido borrado correctamente.');
    }
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setDocumentToEdit(invoice);
    handleNavigate(AppView.WIZARD);
  };

  const handleEditExpense = (expense: Invoice) => {
    setDocumentToEdit(expense);
    handleNavigate(AppView.EXPENSE_WIZARD);
  };

  const handleCreateDocumentForClient = (client: DbClient, type: 'Invoice' | 'Quote') => {
    const templateDoc: Invoice = {
      id: '',
      clientName: client.name,
      clientTaxId: client.taxId,
      clientEmail: client.email,
      clientAddress: client.address,
      type: type,
      status: 'Borrador',
      date: new Date().toISOString(),
      total: 0,
      currency: currentUser?.defaultCurrency || 'USD',
      items: []
    };
    setDocumentToEdit(templateDoc);
    handleNavigate(AppView.WIZARD);
  };

  const handleUpdateProfile = async (updated: UserProfile) => {
    // Ensure isAccountant flag stays synced with official ProfileType
    const isNowAccountant = updated.type === ProfileType.ACCOUNTANT;

    const finalProfile = {
      ...updated,
      isAccountant: isNowAccountant
    };

    setCurrentUser(finalProfile);
    localStorage.setItem('konsul_user_data', JSON.stringify(finalProfile));
    await updateUserProfileInDb(finalProfile);

    alert.addToast('success', 'Perfil Actualizado', 'Tus cambios se han guardado.');
  };

  // --- CATALOG HANDLERS ---
  const handleSaveCatalogItem = async (item: CatalogItem) => {
    if (!currentUser) return;

    const res = await saveCatalogItemToDb(item, currentUser.id);
    if (res.success) {
      // Fetch fresh list from DB to ensure consistency
      const updatedList = await fetchCatalogItemsFromDb(currentUser.id);
      setCatalogItems(updatedList);

      // Also update user profile just in case (legacy)
      setCurrentUser(prev => prev ? ({ ...prev, defaultServices: updatedList }) : null);

      alert.addToast('success', 'Ítem Guardado', `${item.name} se ha guardado en tu catálogo.`);
    } else {
      alert.addToast('error', 'Error al Guardar', res.error || 'No se pudo conectar con la base de datos.');
    }
  };

  const handleDeleteCatalogItem = async (itemId: string) => {
    if (!currentUser) return;

    const success = await deleteCatalogItemFromDb(itemId, currentUser.id);
    if (success) {
      const updatedList = catalogItems.filter(i => i.id !== itemId);
      setCatalogItems(updatedList);

      // Also update user profile (legacy)
      setCurrentUser(prev => prev ? ({ ...prev, defaultServices: updatedList }) : null);

      alert.addToast('info', 'Ítem Eliminado', 'El producto ha sido removido del catálogo.');
    } else {
      alert.addToast('error', 'Error al Eliminar', 'Intenta nuevamente.');
    }
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
      onNavigate={handleNavigate}
      currentProfile={currentUser}
      onSwitchProfile={() => { }}
      isOffline={isOffline}
      onToggleOffline={() => setIsOffline(!isOffline)}
      pendingInvoicesCount={invoices.filter(i => i.status === 'PendingSync').length}
      onLogout={handleLogout}
      breadcrumbs={breadcrumbs}
    >
      {activeView === AppView.DASHBOARD && (
        <Dashboard
          recentInvoices={invoices}
          isOffline={isOffline}
          pendingCount={invoices.filter(i => i.status === 'PendingSync').length}
          onNewAction={() => { setDocumentToEdit(null); handleNavigate(AppView.WIZARD); }}
          onSelectInvoice={(inv) => { setSelectedInvoice(inv); handleNavigate(AppView.INVOICE_DETAIL); }}
          onNavigate={handleNavigate}
          currentUser={currentUser!}
        />
      )}

      {activeView === AppView.WIZARD && (
        <InvoiceWizard
          currentUser={currentUser}
          isOffline={isOffline}
          onSave={handleSaveInvoice}
          onCancel={() => { setDocumentToEdit(null); handleNavigate(AppView.DASHBOARD); }}
          onViewDetail={() => handleNavigate(AppView.INVOICES)}
          onSelectInvoiceForDetail={(inv) => {
            setSelectedInvoice(inv);
            handleNavigate(AppView.INVOICE_DETAIL);
          }}
          initialData={documentToEdit}
          dbClients={dbClients}
          invoices={invoices}
          catalogItems={catalogItems} // Pass the fresh catalog state
        />
      )}

      {activeView === AppView.INVOICES && (
        <DocumentList
          invoices={invoices}
          onSelectInvoice={(inv) => handleNavigate(AppView.INVOICE_DETAIL, { id: inv.id })}
          onCreateNew={() => { setDocumentToEdit(null); handleNavigate(AppView.WIZARD); }}
          onUpdateStatus={handleUpdateStatus}
          onSaveInvoice={handleSaveInvoice}
          dbClients={dbClients}
          currencySymbol={currentUser.defaultCurrency === 'EUR' ? '€' : '$'}
          currentUser={currentUser}
          currentType={docType}
          currentStage={docStage}
          onTypeChange={(type) => handleNavigate(AppView.INVOICES, { type })}
          onStageChange={(stage) => handleNavigate(AppView.INVOICES, { stage })}
        />
      )}

      {activeView === AppView.INVOICE_DETAIL && selectedInvoice && (
        <InvoiceDetail
          invoice={selectedInvoice}
          issuer={currentUser}
          onBack={() => handleNavigate(AppView.INVOICES)}
          onUpdateInvoice={(updated) => {
            setInvoices(invoices.map(i => i.id === updated.id ? updated : i));
            setSelectedInvoice(updated);
            saveInvoiceToDb({ ...updated, userId: currentUser.id });
          }}
          onUpdateStatus={handleUpdateStatus}
          onEdit={handleEditInvoice}
          onDelete={handleDeleteInvoice}
        />
      )}

      {activeView === AppView.CLIENTS && (
        <ClientList
          invoices={invoices}
          dbClients={dbClients}
          onCreateDocument={(client) => {
            if (client) {
              handleCreateDocumentForClient(client, 'Invoice');
            } else {
              setDocumentToEdit(null);
              handleNavigate(AppView.WIZARD);
            }
          }}
          onCreateClient={() => handleNavigate(AppView.CLIENT_WIZARD)}
          currencySymbol={currentUser.defaultCurrency === 'EUR' ? '€' : '$'}
          currentUser={currentUser}
          currentFilter={clientFilter}
          onFilterChange={(filter) => handleNavigate(AppView.CLIENTS, { filter })}
          onSelectClient={(name) => handleNavigate(AppView.CLIENT_DETAIL, { name })}
          onRefresh={async () => {
            if (currentUser) {
              const [clients, docs] = await Promise.all([
                fetchClientsFromDb(currentUser.id),
                fetchInvoicesFromDb(currentUser.id)
              ]);
              setDbClients(clients);
              if (docs) setInvoices(docs);
            }
          }}
        />
      )}

      {activeView === AppView.CLIENT_WIZARD && (
        <ClientWizard
          onSave={handleSaveNewClient}
          onCancel={() => handleNavigate(AppView.CLIENTS)}
        />
      )}

      {/* --- ACCOUNTANT VIEWS --- */}
      {activeView === AppView.ACCOUNTANT_DASHBOARD && (
        <AccountantDashboard
          currentUser={currentUser!}
          managedCompanies={managedCompanies}
          onSelectCompany={(c) => alert.addToast('info', 'Switching View', `Accediendo a ${c.name}...`)}
          onViewCalculator={(type) => { setCalcType(type); handleNavigate(AppView.FISCAL_CALCULATORS); }}
          onViewTasks={() => handleNavigate(AppView.AI_TASKS)}
          onViewCalendar={() => handleNavigate(AppView.TAX_CALENDAR)}
        />
      )}

      {activeView === AppView.AI_TASKS && (
        <AiTaskManager
          tasks={accountantTasks}
          onAddTask={() => { }}
          onUpdateStatus={(id, s) => setAccountantTasks(prev => prev.map(t => t.id === id ? { ...t, status: s } : t))}
        />
      )}

      {activeView === AppView.FISCAL_CALCULATORS && (
        <FiscalCalculators initialType={calcType} onBack={() => handleNavigate(AppView.ACCOUNTANT_DASHBOARD)} />
      )}

      {activeView === AppView.TAX_CALENDAR && (
        <TaxCalendar onBack={() => handleNavigate(AppView.ACCOUNTANT_DASHBOARD)} />
      )}

      {activeView === AppView.CLIENT_DETAIL && selectedClientName && currentUser && (
        <ClientDetail 
          clientName={selectedClientName}
          invoices={invoices}
          dbClientData={dbClients.find(c => c.name.trim().toLowerCase() === selectedClientName.trim().toLowerCase())}
          issuer={currentUser}
          onBack={() => {
            setSelectedClientName(null);
            handleNavigate(AppView.CLIENTS);
          }}
          onSelectInvoice={(inv) => {
            setSelectedInvoice(inv);
            handleNavigate(AppView.INVOICE_DETAIL);
          }}
          onUpdateClientContact={handleSaveClient}
          onCreateDocument={(type, data) => handleCreateDocumentForClient(data, type)}
          onDeleteClient={handleDeleteClient}
          currencySymbol={currentUser.defaultCurrency === 'EUR' ? '€' : '$'}
          stripeSecretKey={currentUser.paymentIntegration?.stripeSecretKey}
        />
      )}

      {activeView === AppView.EXPENSES && (
        <ExpenseTracker
          invoices={invoices}
          currencySymbol={currentUser.defaultCurrency === 'EUR' ? '€' : '$'}
          onCreateExpense={() => { setDocumentToEdit(null); handleNavigate(AppView.EXPENSE_WIZARD); }}
          onEditExpense={handleEditExpense}
          currentProfile={currentUser}
          onUpdateProfile={handleUpdateProfile}
        />
      )}

      {activeView === AppView.EXPENSE_WIZARD && (
        <ExpenseWizard
          currentUser={currentUser}
          onSave={(inv) => { handleSaveInvoice(inv); handleNavigate(AppView.EXPENSES); }}
          onCancel={() => handleNavigate(AppView.EXPENSES)}
          initialData={documentToEdit}
        />
      )}

      {activeView === AppView.CATALOG && (
        <CatalogDashboard
          items={catalogItems} // Use the new reliable state
          userCountry={currentUser.country || 'Global'}
          apiKey={currentUser.apiKeys}
          onSaveItem={handleSaveCatalogItem}
          onDeleteItem={handleDeleteCatalogItem}
          referenceHourlyRate={currentUser.hourlyRateConfig?.calculatedRate}
          currentUser={currentUser}
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

const App: React.FC = () => {
  return (
    <AlertProvider>
      <AppContent />
    </AlertProvider>
  );
};

export default App;
