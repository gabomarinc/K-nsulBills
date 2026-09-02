
import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowLeft, Printer, Share2, Download, Building2, 
  CheckCircle2, Loader2, Send, MessageCircle, Smartphone, Mail, Check, AlertTriangle, Edit2, Sparkles, 
  ChevronDown, XCircle, Wallet, ArrowRight, X, Trash2, CreditCard, Clock, StickyNote, Lock, Link, Landmark, Coins, FileText
} from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { Invoice, UserProfile, TimelineEvent, InvoiceStatus } from '../types';
import DocumentTimeline from './DocumentTimeline';
import { sendEmail, generateDocumentHtml, getEmailStatus } from '../services/resendService';
import { useAlert } from './AlertSystem';
import DocumentTemplate from './DocumentTemplate';
import { getSafeYappyCheckoutUrl, createYappyV2Checkout } from '../services/yappyService';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'btn-yappy': any;
    }
  }
}

interface InvoiceDetailProps {
  invoice: Invoice;
  issuer: UserProfile;
  onBack: () => void;
  onEdit?: (invoice: Invoice) => void;
  onUpdateInvoice?: (invoice: Invoice) => void;
  onUpdateStatus?: (id: string, status: InvoiceStatus) => void;
  onDelete?: (id: string) => void;
}

const InvoiceDetail: React.FC<InvoiceDetailProps> = ({ invoice, issuer, onBack, onEdit, onUpdateInvoice, onUpdateStatus, onDelete }) => {
  const [isSending, setIsSending] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  
  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<'Banco'|'Tarjeta'|'Efectivo'|'Otro'>('Banco');
  const [paymentCurrency, setPaymentCurrency] = useState(invoice.currency);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [isProcessingYappy, setIsProcessingYappy] = useState(false);
  const yappyBtnRef = useRef<any>(null);

  // Ref for PDF Generation
  const documentRef = useRef<HTMLDivElement>(null);
  
  const alert = useAlert(); 

  // Poll for Resend Status Updates
  useEffect(() => {
    let isMounted = true;

    const checkStatus = async () => {
      if (!invoice.resendEmailId) return;
      
      const hasOpened = invoice.timeline?.some(e => e.type === 'OPENED');
      const hasClicked = invoice.timeline?.some(e => e.type === 'CLICKED');
      
      if (hasClicked) return; 

      const data = await getEmailStatus(invoice.resendEmailId);
      
      if (isMounted && data && data.last_event) {
          let newEvent: TimelineEvent | null = null;
          
          if (data.last_event === 'opened' && !hasOpened) {
               newEvent = {
                   id: Date.now().toString(),
                   type: 'OPENED',
                   title: 'Visto por el cliente',
                   description: 'El correo fue abierto.',
                   timestamp: new Date().toISOString()
               };
          } else if (data.last_event === 'clicked' && !hasClicked) {
               newEvent = {
                   id: Date.now().toString(),
                   type: 'CLICKED',
                   title: 'Clic en el documento',
                   description: 'El cliente hizo clic en el enlace.',
                   timestamp: new Date().toISOString()
               };
          }
          
          if (newEvent && onUpdateInvoice) {
              const updatedInvoice = {
                  ...invoice,
                  timeline: [...(invoice.timeline || []), newEvent]
              };
              onUpdateInvoice(updatedInvoice);
              alert.addToast('info', 'Actividad Detectada', newEvent.title);
          }
      }
    };
    
    checkStatus();
    const interval = setInterval(checkStatus, 30000);

    return () => {
        isMounted = false;
        clearInterval(interval);
    };
  }, [invoice.resendEmailId, invoice.timeline, onUpdateInvoice]);

  // --- CALCULATION LOGIC ---
  const subtotal = invoice.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const discountRate = invoice.discountRate || 0;
  const discountAmount = subtotal * (discountRate / 100);
  
  // Calculate Tax on the Discounted Base (Proportional)
  // Logic matches InvoiceWizard to ensure consistency
  const taxTotal = invoice.items.reduce((acc, item) => {
      const itemTotal = item.price * item.quantity;
      // Apply discount share to this item
      const itemTaxable = itemTotal * (1 - (discountRate / 100));
      return acc + (itemTaxable * (item.tax / 100));
  }, 0);

  const amountPaid = invoice.amountPaid || 0;
  const remainingBalance = Math.max(0, invoice.total - amountPaid);
  
  // Handle Legacy Payments (if they were added before the payments array existed)
  const displayPayments = invoice.payments && invoice.payments.length > 0 
    ? invoice.payments 
    : (amountPaid > 0 ? [{
        id: 'legacy-payment',
        date: invoice.date,
        amount: amountPaid,
        method: 'Otro' as const,
        currency: invoice.currency,
        notes: 'Cobro previo'
      }] : []);

  const isQuote = invoice.type === 'Quote';

  // Handle Yappy V2 Events
  const handleYappyClick = async () => {
    if (isProcessingYappy) return;
    
    try {
      setIsProcessingYappy(true);
      const directUrl = await getSafeYappyCheckoutUrl(
        invoice,
        issuer.paymentIntegration!,
        remainingBalance
      );
      
      if (directUrl) {
        window.location.href = directUrl;
      }
    } catch (err: any) {
      alert.addToast('error', err.message || 'Error al conectar con Yappy');
    } finally {
      setIsProcessingYappy(false);
    }
  };

  // --- PAYMENT HELPERS ---
  const handlePagueloFacil = () => {
      const cclw = issuer.paymentIntegration?.cclw;
      if (!cclw) return;
      
      // PagueloFacil Link Format (No Code Integration)
      // Doc: https://developers.paguelofacil.com/docs/link-de-pago
      const baseUrl = "https://tx.paguelofacil.com/service";
      const params = new URLSearchParams({
          cclw: cclw,
          amt: remainingBalance.toFixed(2),
          email: invoice.clientEmail || '',
          desc: `Factura ${invoice.id}`,
          // Add custom reference if needed, usually passed as order_id or similar depending on implementation
      });
      
      window.open(`${baseUrl}?${params.toString()}`, '_blank');
  };

  const handleYappy = async () => {
    // This is now handled by the <btn-yappy> event listener
    // But we keep this function if we want to add any secondary logic
  };

  const handleStripe = async (silent = false) => {
      try {
          if(!issuer.paymentIntegration?.stripeSecretKey) return null;
          const res = await fetch('/api/stripe-checkout', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  stripeSecretKey: issuer.paymentIntegration.stripeSecretKey,
                  invoiceId: invoice.id,
                  amount: remainingBalance,
                  currency: invoice.currency,
                  clientEmail: invoice.clientEmail,
                  invoiceDesc: `Pago Factura #${invoice.id} - ${issuer.name}`
              })
          });
          const data = await res.json();
          if(data.url) {
              if (!silent) window.location.href = data.url;
              return data.url;
          } else {
              if (!silent) alert.addToast('error', 'Error Stripe', data.error || 'Error al conectar con Stripe');
              return null;
          }
      } catch(error) {
          console.error(error);
          if (!silent) alert.addToast('error', 'Error Stripe', 'Error al inicializar Checkout');
          return null;
      }
  };

  const handleStatusChange = (newStatus: InvoiceStatus) => {
      if (onUpdateStatus) {
          onUpdateStatus(invoice.id, newStatus);
          setShowStatusMenu(false);
      }
  };

  const handleDelete = async () => {
      if (!onDelete) return;
      
      const confirmed = await alert.confirm({
          title: '¿Eliminar Documento?',
          message: 'Esta acción es irreversible. El documento se borrará permanentemente.',
          confirmText: 'Eliminar',
          cancelText: 'Cancelar',
          type: 'danger'
      });

      if (confirmed) {
          onDelete(invoice.id);
      }
  };

  const handleRegisterPayment = () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    let updatedPayments = [...displayPayments];

    if (editingPaymentId) {
        updatedPayments = updatedPayments.map(p => p.id === editingPaymentId ? {
            ...p, date: paymentDate, amount: amount, method: paymentMethod, currency: paymentCurrency
        } : p);
    } else {
        updatedPayments.push({
            id: Date.now().toString(),
            date: paymentDate,
            amount: amount,
            method: paymentMethod,
            currency: paymentCurrency,
            notes: ''
        });
    }

    const newTotalPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
    const newRemaining = invoice.total - newTotalPaid;
    
    // Auto-update status based on balance
    const newStatus: InvoiceStatus = newRemaining <= 0.01 ? 'Pagada' : 'Abonada';

    const paymentEvent: TimelineEvent = {
        id: Date.now().toString(),
        type: 'PAID',
        title: editingPaymentId ? `Cobro actualizado: ${paymentCurrency} ${amount.toFixed(2)}` : `Pago registrado: ${paymentCurrency} ${amount.toFixed(2)}`,
        description: newRemaining > 0.01 ? `Resta: ${invoice.currency} ${newRemaining.toFixed(2)}` : 'Deuda saldada',
        timestamp: new Date().toISOString()
    };

    const updatedInvoice: Invoice = {
        ...invoice,
        amountPaid: newTotalPaid,
        status: newStatus,
        timeline: [...(invoice.timeline || []), paymentEvent],
        payments: updatedPayments
    };

    if (onUpdateInvoice) {
        onUpdateInvoice(updatedInvoice);
    }
    
    closePaymentModal();
    alert.addToast('success', editingPaymentId ? 'Cobro Actualizado' : 'Pago Registrado', `Se ha guardado ${paymentCurrency} ${amount.toFixed(2)}`);
  };

  const handleDeletePayment = (paymentId: string) => {
    // We use displayPayments to handle the case where it's a legacy payment being deleted
    const currentPayments = displayPayments;
    const deletedPayment = currentPayments.find(p => p.id === paymentId);
    const updatedPayments = currentPayments.filter(p => p.id !== paymentId);
    
    const newTotalPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
    const newRemaining = invoice.total - newTotalPaid;
    
    let newStatus: InvoiceStatus = invoice.status;
    if (invoice.type === 'Invoice' && invoice.status !== 'Borrador') {
       if (newRemaining <= 0.01) {
           newStatus = 'Pagada';
       } else if (newTotalPaid > 0) {
           newStatus = 'Abonada';
       } else {
           newStatus = 'Enviada';
       }
    }

    const event: TimelineEvent = {
        id: Date.now().toString(),
        type: 'STATUS_CHANGE',
        title: 'Cobro Eliminado',
        description: `Se anuló el cobro de ${deletedPayment?.currency || invoice.currency} ${deletedPayment?.amount}`,
        timestamp: new Date().toISOString()
    };

    const updatedInvoice: Invoice = {
        ...invoice,
        amountPaid: newTotalPaid,
        status: newStatus,
        payments: updatedPayments,
        timeline: [...(invoice.timeline || []), event]
    };
    
    if (onUpdateInvoice) {
        onUpdateInvoice(updatedInvoice);
        alert.addToast('info', 'Cobro Eliminado', 'El registro ha sido eliminado exitosamente.');
    }
  };

  const closePaymentModal = () => {
      setIsPaymentModalOpen(false);
      setEditingPaymentId(null);
      setPaymentAmount('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
  };

  const handleEditPayment = (p: any) => {
      setEditingPaymentId(p.id);
      setPaymentAmount(p.amount.toString());
      setPaymentDate(p.date);
      setPaymentMethod(p.method || 'Banco');
      setPaymentCurrency(p.currency || invoice.currency);
  };

  const handleSend = async () => {
    if (!invoice.clientEmail) {
        alert.addToast('error', 'Falta Email', "El cliente no tiene un email registrado.");
        return;
    }

    setIsSending(true);

    try {
        if (!documentRef.current) throw new Error("No se pudo capturar el documento.");
        
        const opt = {
            margin:       [10, 10, 10, 10] as [number, number, number, number], 
            filename:     `${isQuote ? 'Cotizacion' : 'Factura'}_${invoice.id}.pdf`,
            image:        { type: 'jpeg' as const, quality: 0.98 },
            html2canvas:  { 
                scale: 2, 
                useCORS: true, 
                letterRendering: true,
                logging: false,
                backgroundColor: '#ffffff'
            },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
            pagebreak:    { mode: ['css', 'legacy'] }
        };

        const pdfBase64 = await html2pdf().from(documentRef.current).set(opt).outputPdf('datauristring');
        const pureBase64 = pdfBase64.split(',')[1];

        // Generate Stripe link if configured to include in Email button
        let paymentUrl = undefined;
        if (!isQuote && issuer.paymentIntegration?.stripeSecretKey) {
            paymentUrl = await handleStripe(true);
        }

        // Generate Yappy link if configured (Safe version with V1 fallback)
        let yappyPaymentUrl: string | undefined = undefined;
        if (!isQuote && issuer.paymentIntegration?.yappyApiKey) {
            try {
                yappyPaymentUrl = await getSafeYappyCheckoutUrl(invoice, issuer.paymentIntegration, remainingBalance);
            } catch (e) { /* ignore */ }
        }

        const htmlContent = generateDocumentHtml(invoice, issuer, paymentUrl, yappyPaymentUrl);
        const docTypeName = isQuote ? 'Cotización' : 'Factura';
        const emailSubject = `${docTypeName} #${invoice.id} - ${issuer.name}`;

        const result = await sendEmail({
            to: invoice.clientEmail,
            cc: issuer.email, // Carbon Copy to the User
            subject: emailSubject, 
            html: htmlContent, 
            senderName: issuer.legalName || issuer.name, 
            attachments: [{
                filename: `${docTypeName}_${invoice.id}.pdf`,
                content: pureBase64
            }],
            emailConfig: issuer.emailConfig
        });

        if (result.success) {
            if (result.id && onUpdateInvoice) {
                const sentEvent: TimelineEvent = {
                    id: Date.now().toString(),
                    type: 'SENT',
                    title: 'Enviado por Correo',
                    description: `Entregado a ${invoice.clientEmail} (ID: ${result.id.slice(0,8)}...)`,
                    timestamp: new Date().toISOString()
                };
                
                const updatedInvoice = {
                    ...invoice,
                    status: 'Enviada' as const, 
                    resendEmailId: result.id,
                    timeline: [...(invoice.timeline || []), sentEvent]
                };
                onUpdateInvoice(updatedInvoice);
            }
            setShowSuccessModal(true);
            alert.addToast('success', 'Correo Enviado', 'El documento ha sido enviado correctamente.');
        } else {
            throw new Error(result.error || 'Error al enviar el correo.');
        }
    } catch (error: any) {
        console.error("Error sending document:", error);
        alert.addToast('error', 'Error de Envío', error.message || 'No se pudo enviar el correo.');
    } finally {
        setIsSending(false);
    }
  };

  const handleDownloadPdf = async () => {
      if (!documentRef.current) return;
      
      const opt = {
          margin:       [10, 10, 10, 10] as [number, number, number, number],
          filename:     `${isQuote ? 'Cotizacion' : 'Factura'}_${invoice.id}.pdf`,
          image:        { type: 'jpeg' as const, quality: 0.98 },
          html2canvas:  { 
              scale: 2, 
              useCORS: true, 
              letterRendering: true,
              logging: false,
              backgroundColor: '#ffffff'
          },
          jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
          pagebreak:    { mode: ['css', 'legacy'] }
      };

      // To make the PDF interactive, we ensure the Stripe link is visible in the documentRef
      // Before capturing. Since we want it to be a real link, we've added it to the renderModern/renderClassic
      
      alert.addToast('info', 'Generando PDF', 'Preparando documento interactivo...');
      await html2pdf().from(documentRef.current).set(opt).save();
      alert.addToast('success', 'PDF Descargado');
  };

  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'Pagada':
      case 'Aceptada': return 'bg-green-50 text-green-700 border-green-200';
      case 'Rechazada': 
      case 'Incobrable': return 'bg-red-50 text-red-700 border-red-200';
      case 'Negociacion': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Seguimiento': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Abonada': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Enviada': return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'PendingSync': return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200'; 
    }
  };

  const renderStatusOptions = () => {
      const options = isQuote 
        ? ['Negociacion', 'Aceptada', 'Rechazada', 'Enviada']
        : ['Enviada', 'Seguimiento', 'Abonada', 'Pagada', 'Incobrable'];
      
      return (
          <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in-95">
              {options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleStatusChange(opt as InvoiceStatus)}
                    className="w-full text-left px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-[#1c2938] transition-colors"
                  >
                      {opt}
                  </button>
              ))}
          </div>
      );
  };

  // --- RENDER PAYMENT BUTTONS ---
  const renderPaymentButtons = () => {
      if (isQuote || !remainingBalance || remainingBalance <= 0) return null;
      
      const hasPaguelo = !!issuer.paymentIntegration?.cclw;
      const hasYappy = !!issuer.paymentIntegration?.yappyApiKey || !!issuer.paymentIntegration?.yappySecretKey; 
      const hasStripe = !!issuer.paymentIntegration?.stripeSecretKey;

      if (!hasPaguelo && !hasYappy && !hasStripe) return null;

      return (
          <div className="mt-6 pt-6 border-t border-slate-100">
              <p className="font-bold text-[#1c2938] mb-3 text-sm uppercase tracking-wide">Pagar Online</p>
              <div className="flex flex-wrap gap-3">
                  {hasPaguelo && (
                      <button 
                        onClick={handlePagueloFacil}
                        className="flex-1 bg-[#009ee3] text-white py-2.5 px-4 rounded-xl font-bold hover:bg-[#008cc9] transition-colors shadow-sm flex items-center justify-center gap-2"
                      >
                          <Lock className="w-4 h-4" /> PagueloFacil
                      </button>
                  )}
                  {hasYappy && (
                      <button 
                        onClick={handleYappyClick}
                        disabled={isProcessingYappy}
                        className="flex-1 bg-white border border-slate-200 text-slate-800 py-2.5 px-4 rounded-xl font-bold hover:bg-slate-50 transition-colors shadow-sm flex items-center justify-center gap-2"
                      >
                          {isProcessingYappy ? <Loader2 className="w-4 h-4 animate-spin" /> : <img src="https://konsul.digital/images/yappy-color-landscape.png" alt="Yappy" className="h-5" />} 
                      </button>
                  )}
                  {hasStripe && (
                      <button 
                        onClick={() => handleStripe()}
                        className="flex-1 bg-[#635BFF] text-white py-2.5 px-4 rounded-xl font-bold hover:bg-[#5249e5] transition-colors shadow-sm flex items-center justify-center gap-2"
                      >
                          <Lock className="w-4 h-4" /> Stripe
                      </button>
                  )}
              </div>
          </div>
      );
  };


  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-100px)] flex flex-col md:flex-row gap-6 animate-in fade-in pb-10">
      
      {/* LEFT: PREVIEW */}
      <div className="flex-1 flex flex-col h-full">
         {invoice.type === 'Invoice' && invoice.timeline?.some(e => e.title?.includes('Convertida desde')) && (
            <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 border border-emerald-200/80 rounded-2xl p-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold shadow-sm shrink-0">
                     <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                     <h4 className="font-bold text-[#1c2938] text-sm flex items-center gap-2">
                       Factura Generada Automáticamente
                     </h4>
                     <p className="text-xs text-slate-500">
                       Esta factura proviene de una cotización aceptada. Envía el correo al cliente para iniciar el cobro.
                     </p>
                  </div>
               </div>
               <button 
                 onClick={handleSend}
                 disabled={isSending}
                 className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50"
               >
                 {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                 <span>Enviar Factura e Iniciar Cobro</span>
               </button>
            </div>
         )}

         <div className="flex justify-between items-center mb-4 px-2">
            <button onClick={onBack} className="flex items-center text-slate-500 hover:text-[#1c2938] transition-colors gap-2 text-sm font-bold">
               <ArrowLeft className="w-4 h-4" /> Volver
            </button>
            <div className="flex gap-2">
               {invoice.timeline && invoice.timeline.length > 0 && (
                  <span className="text-xs text-slate-400 flex items-center gap-1 bg-white px-3 py-1 rounded-full shadow-sm">
                     <Clock className="w-3 h-3" /> Actualizado: {new Date(invoice.timeline[invoice.timeline.length - 1].timestamp).toLocaleTimeString()}
                  </span>
               )}
            </div>
         </div>

         {/* INCREASED PADDING BOTTOM TO pb-32 FOR BETTER SCROLLING */}
          <div className="flex-1 bg-slate-100 rounded-3xl p-4 md:p-8 overflow-y-auto custom-scrollbar shadow-inner border border-slate-200/50 pb-32 flex justify-center">
            <div ref={documentRef} className="w-[190mm] transition-all duration-500 min-h-full">
               <DocumentTemplate 
                 invoice={invoice} 
                 issuer={issuer} 
                 showPaymentButtons={true}
                 onPaymentClick={(provider) => {
                   if (provider === 'PagueloFacil') handlePagueloFacil();
                   if (provider === 'Yappy') handleYappyClick();
                   if (provider === 'Stripe') handleStripe();
                 }}
               />
            </div>
         </div>
      </div>

      {/* RIGHT: CONTROLS */}
      <div className="w-full md:w-[350px] flex flex-col gap-6 h-full overflow-y-auto custom-scrollbar pr-2 pb-20">
         
         {/* STATUS CARD */}
         <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-start mb-4">
               <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${getStatusStyle(invoice.status)}`}>
                  {invoice.status}
               </span>
               {invoice.type === 'Quote' && (
                  <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-lg">
                     {invoice.successProbability ? `${invoice.successProbability}% Éxito` : 'IA Pendiente'}
                  </span>
               )}
            </div>
            
            <h3 className="font-bold text-[#1c2938] text-2xl mb-1">{invoice.clientName}</h3>
            <p className="text-sm text-slate-500 mb-6">{invoice.type === 'Quote' ? 'Cotización' : 'Factura'} #{invoice.id}</p>

            <div className="grid grid-cols-2 gap-3">
               <button 
                 onClick={handleSend}
                 disabled={isSending || !invoice.clientEmail}
                 className="col-span-2 bg-[#1c2938] text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#27bea5] transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed group"
               >
                  {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                  {isSending ? 'Enviando...' : 'Enviar Email'}
               </button>
               
               <button 
                 onClick={handleDownloadPdf}
                 className="bg-slate-100 text-slate-600 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"
               >
                  <Download className="w-4 h-4" /> PDF
               </button>
               
               {onEdit && (
                  <button 
                    onClick={() => onEdit(invoice)}
                    className="bg-slate-100 text-slate-600 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"
                  >
                      <Edit2 className="w-4 h-4" /> Editar
                  </button>
               )}

               {/* QUICK STATUS EDIT AS A BUTTON IN THE GRID */}
               <div className="col-span-2 relative">
                   <div className="w-full bg-slate-100 text-slate-600 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors cursor-pointer">
                      <CheckCircle2 className="w-4 h-4" /> 
                      Cambiar Estado: <span className="text-[#1c2938] font-extrabold">{invoice.status}</span>
                      <ChevronDown className="w-4 h-4 ml-1" />
                   </div>
                   <select 
                     className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                     value={invoice.status}
                     onChange={(e) => {
                        const newStatus = e.target.value as InvoiceStatus;
                        if (newStatus !== invoice.status) {
                          handleStatusChange(newStatus);
                        }
                      }}
                   >
                     <option disabled>Cambiar Estado</option>
                     {invoice.type === 'Quote' ? (
                       <>
                         <option value="Borrador">Borrador</option>
                         <option value="Creada">Creada</option>
                         <option value="Enviada">Enviada</option>
                         <option value="Seguimiento">Seguimiento</option>
                         <option value="Negociacion">Negociación</option>
                         <option value="Aceptada">Aceptada</option>
                         <option value="Rechazada">Rechazada</option>
                       </>
                     ) : (
                       <>
                         <option value="Borrador">Borrador</option>
                         <option value="Creada">Creada</option>
                         <option value="Enviada">Enviada</option>
                         <option value="Seguimiento">Seguimiento</option>
                         <option value="Pagada">Pagada</option>
                         <option value="Abonada">Abonada</option>
                         <option value="Incobrable">Incobrable</option>
                       </>
                     )}
                   </select>
               </div>
            </div>

            {/* ACTION FOR INVOICES: REGISTER PAYMENT */}
            {!isQuote && (
                <button 
                    onClick={() => setIsPaymentModalOpen(true)}
                    className="w-full mt-3 bg-green-50 text-green-700 border border-green-100 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-green-100 transition-colors"
                >
                    <CreditCard className="w-4 h-4" /> Registrar Cobro
                </button>
            )}

            {/* DELETE BUTTON */}
            {onDelete && (
                <button 
                    onClick={handleDelete}
                    className="w-full mt-3 text-red-400 hover:text-red-600 py-2 text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                >
                    <Trash2 className="w-3 h-3" /> Eliminar Documento
                </button>
            )}
         </div>

         {/* TIMELINE */}
         <div className="flex-1 min-h-[300px]">
            <DocumentTimeline 
               events={invoice.timeline} 
               type={invoice.type} 
               successProbability={invoice.successProbability} 
            />
         </div>
      </div>

      {/* PAYMENT MODAL */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-[#1c2938]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-[2rem] p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95">
                
                {/* Header */}
                <div className="flex justify-between items-start mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
                            <CreditCard className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-[#1c2938]">Registrar Cobro</h3>
                            <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mt-0.5">Factura #{invoice.id}</p>
                        </div>
                    </div>
                    <button 
                        onClick={closePaymentModal}
                        className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors -mr-2"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-6">
                    {/* Lista de Cobros Anteriores */}
                    {displayPayments.length > 0 && (
                        <div className="bg-orange-50/50 border border-orange-100 rounded-2xl p-4 mb-6">
                            <label className="text-[10px] font-bold text-orange-600 uppercase tracking-widest block mb-3">Cobros Registrados</label>
                            <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                                {displayPayments.map((p, i) => (
                                    <div key={p.id} className="flex items-center justify-between bg-white border border-orange-200 rounded-xl p-3">
                                        <div>
                                            <p className="text-xs font-bold text-[#1c2938]">Cobro {i + 1}</p>
                                            <p className="text-[10px] text-slate-500 font-medium">{new Date(p.date).toLocaleDateString()} {p.method ? `• ${p.method}` : ''}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-[#1c2938]">{p.currency || invoice.currency} {p.amount.toFixed(2)}</p>
                                                <p className="text-[10px] font-bold text-green-600 uppercase">Pagado</p>
                                            </div>
                                            <button onClick={() => handleEditPayment(p)} className="text-slate-300 hover:text-blue-500 transition-colors p-1" title="Editar cobro">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDeletePayment(p.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1" title="Eliminar cobro">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Método de Pago */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Método de Pago</label>
                        <div className="grid grid-cols-4 gap-2">
                            {[{id: 'Banco', icon: Landmark}, {id: 'Tarjeta', icon: CreditCard}, {id: 'Efectivo', icon: Coins}, {id: 'Otro', icon: FileText}].map(method => (
                                <button 
                                    key={method.id}
                                    onClick={() => setPaymentMethod(method.id as any)}
                                    className={`flex flex-col items-center justify-center py-3 px-1 rounded-2xl border-2 transition-all ${paymentMethod === method.id ? 'border-green-500 text-green-600 bg-green-50 shadow-sm' : 'border-slate-50 text-slate-500 bg-slate-50 hover:bg-slate-100'}`}
                                >
                                    <method.icon className="w-5 h-5 mb-1" />
                                    <span className="text-[10px] font-bold">{method.id}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Monto Recibido */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Monto Recibido</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xl">$</span>
                            <input 
                                type="number" 
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                className="w-full pl-10 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-2xl font-bold text-[#1c2938] outline-none focus:border-green-500 focus:bg-white transition-all"
                                placeholder="0.00"
                                autoFocus
                            />
                        </div>
                    </div>
                    
                    {/* Fecha y Moneda */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Fecha Cobro</label>
                            <input 
                                type="date"
                                value={paymentDate}
                                onChange={(e) => setPaymentDate(e.target.value)}
                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-[#1c2938] outline-none focus:border-green-500 focus:bg-white transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Moneda</label>
                            <div className="relative">
                                <select 
                                    value={paymentCurrency}
                                    onChange={(e) => setPaymentCurrency(e.target.value)}
                                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-[#1c2938] outline-none focus:border-green-500 focus:bg-white transition-all appearance-none"
                                >
                                    {(issuer.billingCurrencies?.length ? issuer.billingCurrencies : ['USD', 'EUR', 'PAB']).map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                    </div>
                    
                    <button 
                        onClick={handleRegisterPayment}
                        className="w-full py-4 mt-2 bg-green-500 text-white rounded-2xl font-bold hover:bg-green-600 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 active:translate-y-0"
                    >
                        {editingPaymentId ? 'Actualizar Cobro' : 'Confirmar'}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* SUCCESS MODAL */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-[#1c2938]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
           <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm text-center shadow-2xl animate-in zoom-in-95">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                 <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold text-[#1c2938] mb-2">¡Enviado!</h3>
              <p className="text-slate-500 mb-6">El documento está en camino a {invoice.clientEmail}</p>
              <button 
                onClick={() => setShowSuccessModal(false)}
                className="w-full py-3 bg-[#1c2938] text-white rounded-xl font-bold hover:bg-[#27bea5] transition-colors"
              >
                 Entendido
              </button>
           </div>
        </div>
      )}

    </div>
  );
};

export default InvoiceDetail;
