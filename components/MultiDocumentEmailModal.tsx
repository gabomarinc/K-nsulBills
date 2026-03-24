
import React, { useState, useRef } from 'react';
import { 
  X, Send, Loader2, FileText, CheckCircle2, 
  ChevronRight, Mail, User, Info, AlertCircle
} from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { Invoice, UserProfile } from '../types';
import { sendEmail } from '../services/resendService';
import DocumentTemplate from './DocumentTemplate';
import { useAlert } from './AlertSystem';

interface MultiDocumentEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: {
    name: string;
    email: string;
  };
  selectedInvoices: Invoice[];
  issuer: UserProfile;
  onSuccess?: () => void;
}

const MultiDocumentEmailModal: React.FC<MultiDocumentEmailModalProps> = ({
  isOpen,
  onClose,
  client,
  selectedInvoices,
  issuer,
  onSuccess
}) => {
  const [subject, setSubject] = useState(`${selectedInvoices.length > 1 ? 'Documentos' : 'Documento'} de ${issuer.name}`);
  const [body, setBody] = useState(`Hola ${client.name},\n\nAdjunto enviamos los documentos solicitados.\n\nQuedamos a su disposición para cualquier duda.\n\nSaludos,\n${issuer.name}`);
  const [isSending, setIsSending] = useState(false);
  const [currentProcessing, setCurrentProcessing] = useState<string | null>(null);
  const [processedCount, setProcessedCount] = useState(0);

  const alert = useAlert();
  const hiddenRenderRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handleSend = async () => {
    setIsSending(true);
    setProcessedCount(0);
    
    try {
      const attachments: { filename: string, content: string }[] = [];

      for (const invoice of selectedInvoices) {
        setCurrentProcessing(invoice.id);
        
        // Wait for a tick to ensure rendering
        await new Promise(resolve => setTimeout(resolve, 500));

        if (!hiddenRenderRef.current) throw new Error("Error de renderizado.");

        const opt = {
          margin:       [10, 10, 10, 10] as [number, number, number, number],
          filename:     `${invoice.type === 'Quote' ? 'Cotizacion' : 'Factura'}_${invoice.id}.pdf`,
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

        // Generate PDF
        const pdfBase64 = await html2pdf().from(hiddenRenderRef.current).set(opt).outputPdf('datauristring');
        const pureBase64 = pdfBase64.split(',')[1];

        attachments.push({
          filename: `${invoice.type === 'Quote' ? 'Cotización' : 'Factura'}_${invoice.id}.pdf`,
          content: pureBase64
        });

        setProcessedCount(prev => prev + 1);
      }

      setCurrentProcessing("Enviando...");

      const result = await sendEmail({
        to: client.email,
        cc: issuer.email,
        subject: subject,
        html: body.replace(/\n/g, '<br>'),
        senderName: issuer.legalName || issuer.name,
        attachments: attachments,
        emailConfig: issuer.emailConfig
      });

      if (result.success) {
        alert.addToast('success', 'Correo Enviado', `Se enviaron ${selectedInvoices.length} documentos a ${client.email}`);
        if (onSuccess) onSuccess();
        onClose();
      } else {
        throw new Error(result.error || "Error al enviar el correo.");
      }

    } catch (error: any) {
      console.error("Batch send error:", error);
      alert.addToast('error', 'Error de Envío', error.message || "No se pudieron procesar los documentos.");
    } finally {
      setIsSending(false);
      setCurrentProcessing(null);
    }
  };

  const renderVariablesInfo = () => (
    <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex gap-3 text-blue-800 text-[11px] mb-4">
      <Info className="w-5 h-5 flex-shrink-0" />
      <div>
        <p className="font-bold mb-1 uppercase tracking-wider">Consejo Pro</p>
        <p>Los archivos se adjuntarán automáticamente como PDFs individuales. El destinatario verá un solo correo con {selectedInvoices.length} adjuntos.</p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-[#1c2938]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#1c2938] text-[#27bea5] rounded-2xl flex items-center justify-center shadow-lg">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-[#1c2938]">Preparar Correo Masivo</h3>
              <p className="text-sm text-slate-500 font-medium">Enviando a: <span className="text-[#1c2938] font-bold">{client.name}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors shadow-sm">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          
          {/* TO FIELD (Read Only) */}
          <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
             <div className="p-2 bg-white rounded-xl shadow-sm text-slate-400">
                <User className="w-4 h-4" />
             </div>
             <div className="flex-1">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest leading-none mb-1">Para</p>
                <p className="text-sm font-bold text-[#1c2938] leading-none">{client.email || 'Email no registrado'}</p>
             </div>
          </div>

          {/* SUBJECT */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Asunto del Correo</label>
            <input 
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-[#1c2938] outline-none focus:border-[#27bea5] focus:bg-white transition-all"
              placeholder="Asunto del correo..."
            />
          </div>

          {/* BODY */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Cuerpo del Mensaje</label>
            <textarea 
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[2rem] text-sm text-[#1c2938] outline-none focus:border-[#27bea5] focus:bg-white transition-all h-48 resize-none leading-relaxed"
              placeholder="Escribe tu mensaje aquí..."
            />
          </div>

          {/* SELECTED DOCUMENTS PREVIEW */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 mb-3 block">Documentos Adjuntos ({selectedInvoices.length})</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {selectedInvoices.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className={`p-2 rounded-lg ${doc.type === 'Quote' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-[#1c2938] truncate">{doc.type === 'Quote' ? 'Cotización' : 'Factura'} #{doc.id}</p>
                    <p className="text-[10px] text-slate-400">{doc.currency} {doc.total.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {!client.email && (
            <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex gap-3 text-red-700 text-[11px]">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="font-bold mb-1 uppercase tracking-wider">Error Crítico</p>
                <p>El cliente no tiene un correo electrónico configurado. Por favor, regístralo antes de continuar.</p>
              </div>
            </div>
          )}

          {renderVariablesInfo()}
        </div>

        {/* FOOTER */}
        <div className="p-8 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
          <div className="text-sm font-medium text-slate-400">
            {isSending ? (
               <div className="flex items-center gap-2 text-[#27bea5]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Procesando {processedCount} de {selectedInvoices.length}...</span>
               </div>
            ) : (
              <span>Listo para enviar</span>
            )}
          </div>
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              disabled={isSending}
              className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSend}
              disabled={isSending || !client.email}
              className="px-8 py-3 bg-[#1c2938] text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-[#27bea5] transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
              {isSending ? 'Enviando Correo...' : 'Enviar Ahora'}
            </button>
          </div>
        </div>

        {/* HIDDEN RENDER AREA FOR PDF GENERATION */}
        <div className="fixed -left-[2000px] top-0 opacity-0 pointer-events-none">
          <div ref={hiddenRenderRef} className="bg-white p-0">
             {currentProcessing && selectedInvoices.find(i => i.id === currentProcessing) && (
                <DocumentTemplate 
                  invoice={selectedInvoices.find(i => i.id === currentProcessing)!} 
                  issuer={issuer}
                  showPaymentButtons={true}
                />
             )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default MultiDocumentEmailModal;
