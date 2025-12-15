
import React, { useState, useEffect } from 'react';
import { AppView, Invoice, UserProfile, CatalogItem, InvoiceStatus, TimelineEvent, DbClient } from './types';
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
  fetchCatalogItemsFromDb,
  saveCatalogItemToDb,
  deleteCatalogItemFromDb
} from './services/neon';

// Wrapper Component to use Hooks
const AppContent: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeView, setActiveView] = useState<AppView>(AppView.DASHBOARD);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [dbClients, setDbClients] = useState<DbClient[]>([]); 
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedClientName, setSelectedClientName] = useState<string | null>(null);
  const [documentToEdit, setDocumentToEdit] = useState<Invoice | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  
  const alert = useAlert(); // Hook for alerts

  // SESSION RESTORATION LOGIC
  useEffect(() => {
    const initSession = async () => {
        // Check URL for Stripe return logic
        const params = new URLSearchParams(window.location.search);
        const paymentSuccess = params.get('payment_success');
        const sessionId = params.get('session_id');
        
        const storedUserStr = localStorage.getItem('konsul_user_data'); 
        const storedUserId = localStorage.getItem('konsul_session_id');

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
                    // If we have a fresh user from DB, it might be more up to date than cache
                    // But if we just did a stripe sync in this very session, cache might be newer for a split second
                    // Generally, prefer DB if available and online
                    setCurrentUser(prev => {
                        // Keep Stripe ID if DB doesn't have it yet (race condition safety)
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
        } else {
            setIsOffline(true);
        }

        // Fetch Clients (NEW)
        const clients = await fetchClientsFromDb(currentUser.id);
        if (clients) {
            setDbClients(clients);
        }

        // Fetch Catalog Items (NEW) and sync into current user profile for legacy compatibility
        const items = await fetchCatalogItemsFromDb(currentUser.id);
        if (items) {
            setCurrentUser(prev => {
                if (!prev) return null;
                // Only update if actually different to avoid render loops, or just update silently
                if (JSON.stringify(prev.defaultServices) !== JSON.stringify(items)) {
                    return { ...prev, defaultServices: items };
                }
                return prev;
            });
        }
      };
      loadData();
    }
  }, [currentUser?.id]); // Only re-run if ID changes

  const handleLoginSuccess = (user: UserProfile) => {
    localStorage.setItem('konsul_session_id', user.id);
    localStorage.setItem('konsul_user_data', JSON.stringify(user)); 
    setCurrentUser(user);
    alert.addToast('success', `Bienvenido, ${user.name}`, 'Tu sesión ha iniciado correctamente.');
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
       // Create User
       const success = await createUserInDb(data, data.password, data.email);
       if (success) {
         const user = await authenticateUser(data.email, data.password);
         if (user) {
             // If plan is paid, user object will have it, but we might redirect after this function returns
             // So we log them in locally first.
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
    
    // Check if this ID already exists in our invoices list
    const exists = invoices.find(i => i.id === invoice.id);
    let newInvoices = [];
    
    if (exists) {
      // UPDATE EXISTING
      newInvoices = invoices.map(i => i.id === invoice.id ? invoice : i);
    } else {
      // CREATE NEW
      newInvoices = [invoice, ...invoices];

      // Update sequence if needed based on the new ID number
      const currentSequences = currentUser.documentSequences || {
        invoicePrefix: 'FAC', invoiceNextNumber: 1,
        quotePrefix: 'COT', quoteNextNumber: 1
      };

      let updatedSequences = { ...currentSequences };
      let profileUpdated = false;

      // Extract number from ID (e.g., "FAC-0005" -> 5)
      const idParts = invoice.id.split('-');
      const idNum = parseInt(idParts[idParts.length - 1] || '0', 10);

      if (!isNaN(idNum)) {
          if (invoice.type === 'Invoice') {
              // Ensure next number is greater than current ID
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
          // Fallback if ID parsing fails (shouldn't happen with standard IDs)
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
    
    // Save Document
    await saveInvoiceToDb({ ...invoice, userId: currentUser.id });
    
    // Entity Management: Client vs Provider
    if (invoice.clientName) {
       const cleanName = invoice.clientName.trim();
       
       if (invoice.type === 'Expense') {
           // --- SAVE AS PROVIDER ---
           await saveProviderToDb({
               name: cleanName,
               // Expenses usually don't have taxId in basic form, but we pass if available later
               category: invoice.items[0]?.description || 'General' 
           }, currentUser.id);
           
       } else {
           // --- SAVE AS CLIENT OR PROSPECT ---
           const existingClient = dbClients.find(c => c.name.toLowerCase() === cleanName.toLowerCase());
           
           let clientStatus: 'CLIENT' | 'PROSPECT' = 'PROSPECT';

           if (invoice.type === 'Invoice') {
               clientStatus = 'CLIENT';
           } else if (existingClient && existingClient.status === 'CLIENT') {
               clientStatus = 'CLIENT';
           } else {
               clientStatus = 'PROSPECT';
           }

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
           }

           // Refresh clients regardless to get updated list
           const updatedClients = await fetchClientsFromDb(currentUser.id);
           setDbClients(updatedClients);
       }
    }

    setDocumentToEdit(null);
    alert.addToast('success', 'Documento Guardado', `El documento ${invoice.id} se ha guardado exitosamente.`);
  };

  const handleUpdateStatus = async (id: string, newStatus: InvoiceStatus) => {
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

        if(confirmed) {
            const sequences = currentUser.documentSequences || { invoicePrefix: 'FAC', invoiceNextNumber: 1, quotePrefix: 'COT', quoteNextNumber: 1 };
            
            // Generate unique invoice ID
            let nextNum = sequences.invoiceNextNumber;
            let newInvoiceId = `${sequences.invoicePrefix}-${String(nextNum).padStart(4, '0')}`;
            
            // Collision detection
            while(invoices.some(i => i.id === newInvoiceId)) {
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
    
    // Update Client Status if invoice becomes Paid
    if (updatedInvoice.type === 'Invoice' && (newStatus === 'Pagada' || newStatus === 'Aceptada')) {
        const clientName = updatedInvoice.clientName.trim();
        const existing = dbClients.find(c => c.name.toLowerCase() === clientName.toLowerCase());
        
        // Ensure they are moved to CLIENT table if not already there
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

    setActiveView(AppView.CLIENTS);
    alert.addToast('success', 'Cliente Guardado', `${clientData.name} ha sido añadido a tu directorio.`);
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
         setActiveView(AppView.INVOICES);
      }
      
      await deleteInvoiceFromDb(id, currentUser.id);
      alert.addToast('info', 'Documento Eliminado', 'El registro ha sido borrado correctamente.');
    }
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setDocumentToEdit(invoice);
    setActiveView(AppView.WIZARD);
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
    setActiveView(AppView.WIZARD);
  };

  const handleUpdateProfile = async (updated: UserProfile) => {
    setCurrentUser(updated);
    localStorage.setItem('konsul_user_data', JSON.stringify(updated)); 
    await updateUserProfileInDb(updated);
    alert.addToast('success', 'Perfil Actualizado', 'Tus cambios se han guardado.');
  };

  // --- CATALOG HANDLERS ---
  const handleSaveCatalogItem = async (item: CatalogItem) => {
    if (!currentUser) return;
    
    const res = await saveCatalogItemToDb(item, currentUser.id);
    if (res.success) {
        // Refresh local state by fetching (to handle ID generation or DB triggers if any) or optimistic update
        const updatedList = await fetchCatalogItemsFromDb(currentUser.id);
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
        const updatedList = (currentUser.defaultServices || []).filter(i => i.id !== itemId);
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
          dbClients={dbClients}
          invoices={invoices}
        />
      )}

      {activeView === AppView.INVOICES && (
        <DocumentList 
          invoices={invoices}
          onSelectInvoice={(inv) => { setSelectedInvoice(inv); setActiveView(AppView.INVOICE_DETAIL); }}
          onCreateNew={() => { setDocumentToEdit(null); setActiveView(AppView.WIZARD); }}
          onDeleteInvoice={handleDeleteInvoice}
          onEditInvoice={handleEditInvoice} 
          onUpdateStatus={handleUpdateStatus} 
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
                setActiveView(AppView.WIZARD);
             }
          }}
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
           dbClientData={dbClients.find(c => c.name === selectedClientName)}
           onBack={() => setActiveView(AppView.CLIENTS)}
           onSelectInvoice={(inv) => { setSelectedInvoice(inv); setActiveView(AppView.INVOICE_DETAIL); }}
           currencySymbol={currentUser.defaultCurrency === 'EUR' ? '€' : '$'}
           onUpdateClientContact={async (oldName, updatedClient) => {
              const existing = dbClients.find(c => c.name === oldName);
              const currentStatus = existing?.status || 'PROSPECT';
              
              const res = await saveClientToDb(updatedClient, currentUser.id, currentStatus);
              if (res.success) {
                  const updated = await fetchClientsFromDb(currentUser.id);
                  setDbClients(updated);
                  alert.addToast('success', 'Cliente Actualizado');
              } else {
                  alert.addToast('error', 'Error', res.error);
              }
           }}
           onCreateDocument={(type) => {
              const client = dbClients.find(c => c.name === selectedClientName);
              if (client) {
                 handleCreateDocumentForClient(client, type);
              }
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
