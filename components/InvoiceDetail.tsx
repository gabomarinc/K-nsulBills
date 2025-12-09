
import React, { useState, useRef } from 'react';
import { 
  ArrowLeft, Printer, Share2, Download, Building2, 
  CheckCircle2, Loader2, Send, MessageCircle, Smartphone, Mail, Check, AlertTriangle, Edit2
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Invoice, UserProfile } from '../types';
import DocumentTimeline from './DocumentTimeline';
import { sendEmail, generateDocumentHtml } from '../services/resendService';

interface InvoiceDetailProps {
  invoice: Invoice;
  issuer: UserProfile;
  onBack: () => void;
  onEdit?: (invoice: Invoice) => void;
}

const InvoiceDetail: React.FC<InvoiceDetailProps> = ({ invoice, issuer, onBack, onEdit }) => {
  const [isSending, setIsSending] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  
  // Ref for PDF Generation
  const documentRef = useRef<HTMLDivElement>(null);

  // Re-calculate derived values for display
  const subtotal = invoice.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const taxTotal = invoice.items.reduce((acc, item) => acc + (item.price * item.quantity * (item.tax / 100)), 0);
  
  const isQuote = invoice.type === 'Quote';
  const branding = issuer.branding || { primaryColor: '#27bea5', templateStyle: 'Modern' };
  const color = branding.primaryColor;
  const logo = branding.logoUrl;

  const handleSend = async () => {
    // 1. Validation
    if (!invoice.clientEmail) {
        setSendError("El cliente no tiene un email registrado en el documento.");
        return;
    }

    setIsSending(true);
    setSendError(null);

    try {
        // 2. Generate PDF
        if (!documentRef.current) throw new Error("No se pudo capturar el documento.");
        
        // Use html2canvas to capture the visual component
        const canvas = await html2canvas(documentRef.current, {
            scale: 2, // Higher quality
            useCORS: true, // Allow cross-origin images (like logos)
            logging: false,
            backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        
        // Get raw base64 without data prefix
        const pdfBase64 = pdf.output('datauristring').split(',')[1];

        // 3. Generate HTML content locally (Guaranteed to work)
        const htmlContent = generateDocumentHtml(invoice, issuer);
        const docTypeName = isQuote ? 'Cotización' : 'Factura';
        const emailSubject = `${docTypeName} #${invoice.id} - ${issuer.name}`;

        // 4. Send Email with HTML payload
        const result = await sendEmail({
            to: invoice.clientEmail, 
            subject: emailSubject, 
            html: htmlContent, // Sending explicit HTML to satisfy Resend requirement
            attachments: [{
                filename: `${docTypeName}_${invoice.id}.pdf`,
                content: pdfBase64
            }]
        });

        if (result.success) {
            setShowSuccessModal(true);
        } else {
            throw new Error(result.error || 'Error al enviar el correo.');
        }
    } catch (error: any) {
        console.error("Error sending document:", error);
        setSendError(error.message || 'Error desconocido al procesar el envío.');
    } finally {
        setIsSending(false);
    }
  };

  const handleDownloadPdf = async () => {
      if (!documentRef.current) return;
      
      const canvas = await html2canvas(documentRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgProps = pdf.getImageProperties(imgData);
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${isQuote ? 'Cotizacion' : 'Factura'}_${invoice.id}.pdf`);
  };

  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'Aceptada': return 'bg-green-50 text-green-700 border-green-200';
      case 'Rechazada': return 'bg-red-50 text-red-700 border-red-200';
      case 'Negociacion': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Seguimiento': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Enviada': return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'PendingSync': return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200'; // Borrador, Creada
    }
  };

  // --- TEMPLATE RENDERERS ---

  const renderModern = () => (
    <div className="bg-white shadow-xl rounded-none md:rounded-lg overflow-hidden min-h-[800px] flex flex-col relative print:shadow-none h-full">
      {/* Decorative Top Bar */}
      <div className="h-4 w-full" style={{ backgroundColor: color }}></div>

      <div className="p-8 md:p-12 flex-1">
        {/* Header */}
        <div className="flex justify-between items-start mb-12">
          <div>
              <div className="flex items-center gap-3 mb-4">
                {logo ? (
                   <img src={logo} alt="Logo" className="h-24 max-w-[250px] object-contain" />
                ) : (
                  <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                    <Building2 className="w-8 h-8" />
                  </div>
                )}
                {!logo && (
                  <div>
                    <h1 className="text-xl font-bold text-[#1c2938]">{issuer.name}</h1>
                    <p className="text-sm text-slate-500">{issuer.taxId}</p>
                  </div>
                )}
              </div>
              <div className="text-sm text-slate-500 space-y-1">
                {logo && <p className="font-bold text-[#1c2938] text-lg mb-1">{issuer.name}</p>}
                <p>{issuer.address}</p>
                <p>{issuer.country}</p>
                <p className="text-xs mt-2">{issuer.fiscalRegime}</p>
              </div>
          </div>

          <div className="text-right">
            <h2 className="text-4xl font-bold text-slate-200 uppercase tracking-widest mb-2">
              {isQuote ? 'Cotización' : 'Factura'}
            </h2>
            <p className="font-mono text-xl font-semibold text-slate-700">#{invoice.id.toUpperCase()}</p>
            
            <div className="mt-4 space-y-1 text-sm">
              <div className="flex justify-end gap-4">
                <span className="text-slate-400">Fecha:</span>
                <span className="font-medium text-slate-800">
                  {new Date(invoice.date).toLocaleDateString()
                }</span>
              </div>
              {isQuote && (
                <div className="flex justify-end gap-4">
                  <span className="text-slate-400">Válido hasta:</span>
                  <span className="font-medium text-slate-800">
                    {new Date(Date.now() + 15 * 86400000).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            {/* Status Badge */}
            <div className="mt-4 flex justify-end">
              <span className={`px-4 py-1.5 rounded-full text-sm font-bold border uppercase tracking-wide ${getStatusStyle(invoice.status)}`}>
                {invoice.status === 'PendingSync' ? 'Offline' : invoice.status}
              </span>
            </div>
          </div>
        </div>

        {/* Client Info */}
        <div className="mb-12 bg-slate-50 rounded-xl p-8 border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Cliente</p>
            <h3 className="text-2xl font-bold text-[#1c2938]">{invoice.clientName}</h3>
            {invoice.clientTaxId && <p className="text-slate-600 font-mono text-base mt-1">{invoice.clientTaxId}</p>}
            {invoice.clientEmail && <p className="text-slate-500 text-sm mt-1">{invoice.clientEmail}</p>}
        </div>

        {/* Items Table */}
        <div className="mb-12">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b-2 border-slate-100">
                <th className="py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Descripción</th>
                <th className="py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center w-20">Cant</th>
                <th className="py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right w-32">Precio</th>
                <th className="py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right w-32">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {invoice.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-5 font-medium text-slate-800 text-lg">
                    {item.description}
                  </td>
                  <td className="py-5 text-center text-slate-600">{item.quantity}</td>
                  <td className="py-5 text-right text-slate-600">${item.price.toFixed(2)}</td>
                  <td className="py-5 text-right font-bold text-[#1c2938] text-lg">
                    ${(item.quantity * item.price).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals & Notes */}
        <div className="flex flex-col md:flex-row gap-12">
            <div className="flex-1 space-y-6">
              {isQuote ? (
                <div style={{ backgroundColor: color + '15', color: color }} className="p-6 rounded-xl text-sm border border-transparent">
                  <p className="font-bold mb-2 flex items-center gap-2 text-lg"><CheckCircle2 className="w-5 h-5"/> Condiciones</p>
                  <p className="opacity-90 text-[#1c2938] leading-relaxed">Esta cotización incluye impuestos. Para aprobar, favor de firmar y enviar respuesta a este correo.</p>
                </div>
              ) : (
                <div className="bg-slate-50 p-6 rounded-xl text-slate-700 text-sm">
                  <p className="font-bold mb-2 text-lg">Datos Bancarios</p>
                  <p className="font-mono text-base">{issuer.bankAccount || 'No configurado'}</p>
                </div>
              )}
            </div>

            <div className="w-full md:w-80 space-y-4">
              <div className="flex justify-between text-slate-500 text-lg">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-lg">
                <span>ITBMS (7%)</span>
                <span>${taxTotal.toFixed(2)}</span>
              </div>
              <div className="pt-6 border-t-2 border-slate-100 flex justify-between items-end">
                  <span className="font-bold text-[#1c2938] text-xl">Total</span>
                  <span className="font-bold text-[#1c2938] text-4xl" style={{ color: color }}>
                    {invoice.currency} ${invoice.total.toFixed(2)}
                  </span>
              </div>
            </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-slate-50 p-8 text-center border-t border-slate-100 mt-auto">
          <p className="text-slate-400 text-xs font-medium">Generado con Kônsul Bills</p>
      </div>
    </div>
  );

  const renderClassic = () => (
    <div className="bg-white shadow-xl min-h-[800px] flex flex-col relative print:shadow-none p-12 md:p-16 border-t-[12px] h-full" style={{ borderColor: color }}>
       
       <div className="text-center border-b-2 pb-8 mb-8" style={{ borderColor: color }}>
          {logo ? (
             <img src={logo} alt="Logo" className="h-32 mx-auto mb-6 object-contain" />
          ) : (
             <h1 className="font-serif text-5xl font-bold text-slate-900 mb-2">{issuer.name}</h1>
          )}
          <p className="font-serif text-slate-600 text-lg">{issuer.address} • {issuer.taxId}</p>
          {!logo && <p className="font-serif text-slate-600 text-sm">{issuer.country}</p>}
       </div>

       <div className="flex justify-between items-start mb-12">
          <div className="font-serif">
             <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Cobrar a:</p>
             <h3 className="text-2xl font-bold text-slate-900">{invoice.clientName}</h3>
             <p className="text-slate-600 text-lg">{invoice.clientTaxId}</p>
          </div>
          <div className="text-right font-serif">
             <h2 className="text-3xl font-bold text-slate-900 uppercase">{isQuote ? 'Cotización' : 'Factura'}</h2>
             <p className="text-slate-600 text-xl">No. {invoice.id}</p>
             <p className="text-slate-600 mt-2">{new Date(invoice.date).toLocaleDateString()}</p>
          </div>
       </div>

       <div className="mb-12">
         <table className="w-full text-left font-serif">
           <thead>
             <tr className="border-b-2 border-slate-900">
               <th className="py-3 text-base font-bold text-slate-900 uppercase">Concepto</th>
               <th className="py-3 text-base font-bold text-slate-900 text-center">Cant</th>
               <th className="py-3 text-base font-bold text-slate-900 text-right">Precio</th>
               <th className="py-3 text-base font-bold text-slate-900 text-right">Importe</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-slate-200">
             {invoice.items.map((item, idx) => (
               <tr key={idx}>
                 <td className="py-5 text-lg text-slate-800">{item.description}</td>
                 <td className="py-5 text-center text-lg text-slate-600">{item.quantity}</td>
                 <td className="py-5 text-right text-lg text-slate-600">${item.price.toFixed(2)}</td>
                 <td className="py-5 text-right text-lg text-slate-900 font-bold">${(item.quantity * item.price).toFixed(2)}</td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>

       <div className="flex justify-end font-serif">
          <div className="w-80 space-y-3">
            <div className="flex justify-between text-slate-600 text-lg">
               <span>Subtotal</span>
               <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600 text-lg">
               <span>ITBMS</span>
               <span>${taxTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-2xl font-bold text-slate-900 border-t-2 border-slate-900 pt-4 mt-2">
               <span>Total</span>
               <span>{invoice.currency} ${invoice.total.toFixed(2)}</span>
            </div>
          </div>
       </div>

       <div className="mt-auto pt-12 text-center font-serif text-slate-500 text-sm">
          <p>Gracias por su preferencia.</p>
       </div>
    </div>
  );

  const renderMinimal = () => (
    <div className="bg-white shadow-xl min-h-[800px] flex flex-col relative print:shadow-none p-12 h-full">
      <div className="flex justify-between items-start mb-20">
         <div>
            {logo ? (
              <img src={logo} alt="Logo" className="h-20 object-contain mb-8" />
            ) : (
              <div style={{ backgroundColor: color }} className="w-16 h-16 rounded-full mb-8"></div>
            )}
            <h1 className="font-bold text-base tracking-tight text-slate-900 uppercase">{issuer.name}</h1>
            <p className="text-sm text-slate-500 mt-1">{issuer.address}</p>
            <p className="text-sm text-slate-500">{issuer.taxId}</p>
         </div>
         <div className="text-right">
            <h2 className="text-8xl font-thin text-slate-900 tracking-tighter" style={{ color: color }}>
              {invoice.total.toFixed(0)}
            </h2>
            <p className="text-slate-400 uppercase tracking-widest text-sm font-bold mt-2">
              {invoice.currency} Total
            </p>
         </div>
      </div>

      <div className="grid grid-cols-2 gap-12 mb-16">
         <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Facturado A</p>
            <p className="text-2xl font-medium text-slate-900">{invoice.clientName}</p>
            <p className="text-slate-500 text-base mt-2">{invoice.clientTaxId}</p>
         </div>
         <div className="grid grid-cols-2 gap-6">
            <div>
               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Fecha</p>
               <p className="text-slate-900 font-medium text-lg">{new Date(invoice.date).toLocaleDateString()}</p>
            </div>
            <div>
               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Referencia</p>
               <p className="text-slate-900 font-medium text-lg">#{invoice.id}</p>
            </div>
         </div>
      </div>

      <div className="mb-12">
         {invoice.items.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center py-6 border-b border-slate-100 last:border-0">
               <div>
                  <p className="font-medium text-slate-900 text-xl">{item.description}</p>
                  <p className="text-sm text-slate-400 mt-1">{item.quantity} x ${item.price}</p>
               </div>
               <p className="font-medium text-slate-900 text-xl">${(item.quantity * item.price).toFixed(2)}</p>
            </div>
         ))}
      </div>

      <div className="flex justify-end mt-auto">
         <div className="text-right">
            <p className="text-base text-slate-500 mb-2">Subtotal: ${subtotal.toFixed(2)}</p>
            <p className="text-base text-slate-500 mb-2">ITBMS: ${taxTotal.toFixed(2)}</p>
            <p className="text-3xl font-bold text-slate-900 mt-6 border-t pt-6">
              Total: {invoice.currency} ${invoice.total.toFixed(2)}
            </p>
         </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto pb-12 animate-in slide-in-from-bottom-4 duration-500 relative">
      
      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-[#27bea5]"></div>
            
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-200">
              <Check className="w-10 h-10" />
            </div>
            
            <h3 className="text-2xl font-bold text-[#1c2938] mb-2">¡Enviado con Éxito!</h3>
            <p className="text-slate-500 mb-8">
              El correo y el PDF han sido entregados a {invoice.clientName} vía Resend.
            </p>

            <div className="space-y-3">
              <button onClick={() => setShowSuccessModal(false)} className="w-full bg-[#25D366] text-white py-3 px-4 rounded-xl font-bold hover:bg-[#20bd5a] transition-colors flex items-center justify-center gap-2 shadow-lg shadow-green-100">
                <MessageCircle className="w-5 h-5" /> Enviar por WhatsApp
              </button>
              
              <button onClick={() => setShowSuccessModal(false)} className="w-full bg-slate-100 text-slate-700 py-3 px-4 rounded-xl font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2">
                <Smartphone className="w-5 h-5" /> Enviar por SMS
              </button>
              
              <button 
                onClick={() => {
                   setShowSuccessModal(false);
                   onBack();
                }}
                className="block w-full text-sm text-slate-400 font-medium hover:text-slate-600 mt-4"
              >
                Cerrar y Volver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Notification */}
      {sendError && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-red-100 border border-red-200 text-red-800 px-6 py-3 rounded-full shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 max-w-lg text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{sendError}</span>
          <button onClick={() => setSendError(null)} className="ml-2 font-bold hover:text-red-950">✕</button>
        </div>
      )}

      {/* Navbar Actions */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-[#1c2938] font-medium transition-colors"
        >
          <ArrowLeft className="w-5 h-5" /> Volver
        </button>
        
        <div className="flex items-center gap-2">
           {/* EDIT BUTTON */}
           {onEdit && (
             <button onClick={() => onEdit(invoice)} className="p-3 text-slate-500 hover:bg-white hover:text-[#27bea5] hover:shadow-sm rounded-xl transition-all mr-2" title="Editar Documento">
               <Edit2 className="w-5 h-5" />
             </button>
           )}

           <button onClick={handleDownloadPdf} className="p-3 text-slate-500 hover:bg-white hover:shadow-sm rounded-xl transition-all" title="Descargar PDF">
             <Download className="w-5 h-5" />
           </button>
           <button onClick={() => window.print()} className="p-3 text-slate-500 hover:bg-white hover:shadow-sm rounded-xl transition-all" title="Imprimir">
             <Printer className="w-5 h-5" />
           </button>
           
           {/* PROTAGONIST SEND BUTTON */}
           <button 
             onClick={handleSend}
             disabled={isSending}
             className="ml-4 flex items-center gap-2 bg-[#1c2938] text-white px-8 py-3 rounded-xl hover:bg-[#27bea5] hover:scale-105 active:scale-95 font-bold shadow-lg transition-all disabled:opacity-70 disabled:scale-100 disabled:cursor-not-allowed text-lg group"
           >
             {isSending ? (
               <Loader2 className="w-5 h-5 animate-spin" />
             ) : (
               <Send className="w-5 h-5 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
             )}
             {isSending ? 'Enviando...' : (isQuote ? 'Enviar Cotización' : 'Enviar Factura')}
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* DOCUMENT VIEW (Left 2 cols) */}
        <div className="lg:col-span-2">
           {/* WRAPPED WITH REF FOR PDF GENERATION */}
           <div ref={documentRef} className="h-full">
              {branding.templateStyle === 'Classic' && renderClassic()}
              {branding.templateStyle === 'Minimal' && renderMinimal()}
              {(branding.templateStyle === 'Modern' || !branding.templateStyle) && renderModern()}
           </div>
        </div>

        {/* TIMELINE SIDEBAR (Right 1 col) */}
        <div className="hidden lg:block h-[800px]">
           <DocumentTimeline 
             events={invoice.timeline} 
             type={invoice.type} 
             successProbability={invoice.successProbability} 
           />
        </div>
      </div>

    </div>
  );
};

export default InvoiceDetail;
