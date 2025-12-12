
import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, Mic, Image as ImageIcon, ArrowRight, Loader2, 
  Check, X, DollarSign, Calendar, Tag, Building2, UploadCloud,
  ArrowLeft, Receipt, ScanLine, StopCircle, FileText, Lock,
  ShieldCheck, AlertTriangle, HelpCircle, Scale
} from 'lucide-react';
import { Invoice, ParsedInvoiceData, UserProfile, DeductibilityResult } from '../types';
import { parseInvoiceRequest, parseExpenseImage, analyzeExpenseDeductibility, AI_ERROR_BLOCKED } from '../services/geminiService';

interface ExpenseWizardProps {
  currentUser: UserProfile;
  onSave: (invoice: Invoice) => void;
  onCancel: () => void;
}

type Step = 'INPUT' | 'REVIEW' | 'SUCCESS';

const ExpenseWizard: React.FC<ExpenseWizardProps> = ({ currentUser, onSave, onCancel }) => {
  const [step, setStep] = useState<Step>('INPUT');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  
  // Check AI Access
  const hasAiAccess = !!currentUser.apiKeys?.gemini || !!currentUser.apiKeys?.openai;

  // Voice State
  const [isListening, setIsListening] = useState(false);
  
  // Data State
  const [textInput, setTextInput] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string>(''); // 'image' or 'pdf'
  
  const [expenseData, setExpenseData] = useState<Partial<ParsedInvoiceData>>({
    clientName: '',
    amount: 0,
    currency: currentUser.defaultCurrency || 'USD',
    concept: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Fiscal Analysis State
  const [fiscalAnalysis, setFiscalAnalysis] = useState<DeductibilityResult | null>(null);
  const [isAnalyzingFiscal, setIsAnalyzingFiscal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- EFFECT: TRIGGER FISCAL ANALYSIS ON REVIEW ---
  useEffect(() => {
    const runFiscalCheck = async () => {
        if (step === 'REVIEW' && expenseData.concept && hasAiAccess && !fiscalAnalysis && !isAnalyzingFiscal) {
            setIsAnalyzingFiscal(true);
            try {
                const entityType = currentUser.fiscalConfig?.entityType || 'NATURAL';
                const result = await analyzeExpenseDeductibility(
                    expenseData.concept, 
                    expenseData.amount || 0, 
                    entityType, 
                    currentUser.apiKeys
                );
                setFiscalAnalysis(result);
            } catch (e) {
                console.error("Fiscal analysis failed", e);
            } finally {
                setIsAnalyzingFiscal(false);
            }
        }
    };
    runFiscalCheck();
  }, [step, expenseData.concept, hasAiAccess]);

  // --- VOICE DICTATION ---
  const toggleListening = () => {
    if (!hasAiAccess) { alert("Configura tu API Key para usar funciones de IA."); return; }

    if (isListening) {
      setIsListening(false);
      return;
    }

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Tu navegador no soporta dictado por voz. Intenta usar Chrome.");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = 'es-ES';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setTextInput((prev) => prev + (prev ? ' ' : '') + transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.start();
  };

  // --- ACTIONS ---

  const handleTextSubmit = async () => {
    if (!textInput.trim()) return;
    if (!hasAiAccess) { alert("Configura tu API Key."); return; }

    setIsLoading(true);
    setLoadingMsg('Leyendo tu mente...');
    try {
      const result = await parseInvoiceRequest(`Gasto: ${textInput}`, currentUser.apiKeys);
      if (result) {
         setExpenseData({
            ...expenseData,
            clientName: result.clientName,
            amount: result.amount,
            concept: result.concept,
            currency: result.currency,
            date: result.date || new Date().toISOString().split('T')[0]
         });
         setStep('REVIEW');
      }
    } catch (e: any) {
      console.error(e);
      if (e.message === AI_ERROR_BLOCKED) {
          alert("Función Bloqueada: Falta API Key.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isPdf = file.type === 'application/pdf';
      setFileType(isPdf ? 'pdf' : 'image');

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        setUploadedImage(base64String);
        
        // Strip header for API if image
        const rawBase64 = base64String.split(',')[1];
        const mimeType = file.type;

        // If AI is available, try to parse it
        if (hasAiAccess && !isPdf) {
            setIsLoading(true);
            setLoadingMsg('Escaneando recibo con IA...');
            try {
                const result = await parseExpenseImage(rawBase64, mimeType, currentUser.apiKeys);
                if (result) {
                    setExpenseData({
                        clientName: result.clientName || 'Proveedor Desconocido',
                        amount: result.amount || 0,
                        currency: result.currency || 'USD',
                        concept: result.concept || 'Gasto Varios',
                        date: result.date || new Date().toISOString().split('T')[0]
                    });
                }
            } catch (err) {
                console.error("Vision Error", err);
            } finally {
                setIsLoading(false);
                setStep('REVIEW'); // Go to review anyway
            }
        } else {
            // Manual flow or PDF fallback
            setExpenseData({ ...expenseData, concept: file.name });
            setStep('REVIEW');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    const newExpense: Invoice = {
      id: `EXP-${Date.now()}`,
      clientName: expenseData.clientName || 'Proveedor',
      date: expenseData.date || new Date().toISOString(),
      items: [{
        id: '1',
        description: expenseData.concept || 'Gasto General',
        quantity: 1,
        price: expenseData.amount || 0,
        tax: 0
      }],
      total: expenseData.amount || 0,
      status: 'Aceptada', // Expenses are usually already paid
      currency: expenseData.currency || 'USD',
      type: 'Expense',
      receiptUrl: uploadedImage || undefined,
      timeline: [{
        id: '1',
        type: 'CREATED',
        title: 'Gasto Registrado',
        timestamp: new Date().toISOString()
      }]
    };
    
    onSave(newExpense);
    setStep('SUCCESS');
  };

  // --- RENDER ---

  if (step === 'SUCCESS') {
    return (
      <div className="h-full flex flex-col items-center justify-center animate-in zoom-in duration-300 p-8 text-center">
         <div className="w-24 h-24 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-rose-200">
            <Check className="w-12 h-12" />
         </div>
         <h2 className="text-3xl font-bold text-[#1c2938] mb-2">¡Gasto Registrado!</h2>
         <p className="text-slate-500 mb-8 max-w-md">
            Tu contabilidad se actualizó correctamente. <br/>
            Mantener el orden es la clave del crecimiento.
         </p>
         <button 
           onClick={onCancel}
           className="bg-[#1c2938] text-white px-8 py-3 rounded-2xl font-bold hover:bg-[#27bea5] transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
         >
           Volver al Panel
         </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto h-full flex flex-col pt-10">
       
       {/* NAV */}
       <div className="flex items-center gap-4 mb-8">
          <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-[#1c2938] transition-colors">
             <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
             <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full bg-rose-500 transition-all duration-500`} 
                  style={{ width: step === 'INPUT' ? '30%' : '80%' }}
                />
             </div>
          </div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            {step === 'INPUT' ? 'Captura' : 'Revisión'}
          </span>
       </div>

       {step === 'INPUT' && (
         <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-8">
            <div className="text-center mb-10">
               <h2 className="text-4xl font-bold text-[#1c2938] mb-2">Registrar Nuevo Gasto</h2>
               <p className="text-slate-500 text-lg">Arrastra tu factura o cuéntame qué compraste.</p>
            </div>

            <div className="space-y-6">
               {/* 1. TEXT INPUT */}
               <div className={`bg-white p-2 rounded-[2rem] shadow-xl shadow-slate-200 border transition-colors relative ${isListening ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-100'}`}>
                  <textarea 
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder={hasAiAccess ? (isListening ? "Te escucho..." : "Ej: Pagué 45 dólares de Uber...") : "⚠️ IA Desactivada. Escribe para registrar manualmente."}
                    className="w-full h-32 p-6 text-lg bg-transparent border-none outline-none resize-none placeholder:text-slate-300 text-[#1c2938]"
                    autoFocus
                  />
                  <div className="flex justify-between items-center px-4 pb-4">
                     <button 
                       onClick={toggleListening}
                       className={`p-3 rounded-xl transition-all flex items-center gap-2 ${isListening ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500'} ${!hasAiAccess ? 'opacity-50 cursor-not-allowed' : ''}`}
                       title="Dictar"
                       disabled={!hasAiAccess}
                     >
                        {isListening ? <StopCircle className="w-5 h-5" /> : (hasAiAccess ? <Mic className="w-5 h-5" /> : <Lock className="w-4 h-4" />)}
                        {isListening && <span className="text-xs font-bold">Escuchando...</span>}
                     </button>
                     <button 
                       onClick={() => hasAiAccess ? handleTextSubmit() : setStep('REVIEW')}
                       disabled={!textInput || isLoading}
                       className="bg-[#1c2938] text-white px-6 py-3 rounded-xl font-bold hover:bg-rose-500 transition-all disabled:opacity-50 flex items-center gap-2"
                     >
                       {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                       {isLoading ? 'Procesando...' : (hasAiAccess ? 'Analizar' : 'Continuar')}
                     </button>
                  </div>
               </div>

               {/* OR DIVIDER */}
               <div className="relative text-center py-4">
                  <div className="absolute top-1/2 w-full h-px bg-slate-200"></div>
                  <span className="relative bg-[#F8FAFC] px-4 text-slate-400 text-xs font-bold uppercase tracking-widest">O sube un comprobante</span>
               </div>

               {/* 2. FILE UPLOAD */}
               <div 
                 onClick={() => !isLoading && fileInputRef.current?.click()}
                 className={`border-3 border-dashed rounded-[2.5rem] p-10 flex flex-col items-center justify-center cursor-pointer transition-all group ${
                   isLoading 
                     ? 'border-slate-200 bg-slate-50 opacity-50 cursor-wait' 
                     : 'border-slate-200 hover:border-rose-400 hover:bg-rose-50 bg-white'
                 }`}
               >
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleImageUpload} disabled={isLoading} />
                  
                  {isLoading ? (
                    <div className="flex flex-col items-center gap-4 animate-pulse">
                       <ScanLine className="w-12 h-12 text-rose-400 animate-bounce" />
                       <p className="text-slate-500 font-medium">{loadingMsg}</p>
                    </div>
                  ) : (
                    <>
                       <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-rose-100 group-hover:text-rose-500 transition-colors text-slate-400">
                          <Receipt className="w-8 h-8" />
                       </div>
                       <h3 className="text-xl font-bold text-[#1c2938] group-hover:text-rose-600 transition-colors">Toca para escanear</h3>
                       <p className="text-slate-400 mt-2 text-sm">
                           {hasAiAccess ? 'La IA leerá los datos por ti' : 'Adjuntar imagen (Lectura IA desactivada)'}
                       </p>
                    </>
                  )}
               </div>
            </div>
         </div>
       )}

       {step === 'REVIEW' && (
          <div className="flex-1 flex flex-col animate-in slide-in-from-right-8">
             <div className="flex flex-col md:flex-row gap-8 h-full">
                
                {/* Left: Form */}
                <div className="flex-1 space-y-6">
                   <h3 className="text-2xl font-bold text-[#1c2938] flex items-center gap-2">
                     <Tag className="w-6 h-6 text-rose-500" /> Detalle del Gasto
                   </h3>
                   
                   <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-5">
                      <div>
                         <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Proveedor / Comercio</label>
                         <div className="relative group">
                            <Building2 className="absolute left-4 top-4 w-5 h-5 text-slate-400 group-focus-within:text-rose-500" />
                            <input 
                              value={expenseData.clientName}
                              onChange={(e) => setExpenseData({...expenseData, clientName: e.target.value})}
                              className="w-full pl-12 p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:ring-2 focus:ring-rose-500 font-bold text-[#1c2938]"
                            />
                         </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Monto</label>
                            <div className="relative group">
                                <DollarSign className="absolute left-4 top-4 w-5 h-5 text-slate-400 group-focus-within:text-rose-500" />
                                <input 
                                  type="number"
                                  value={expenseData.amount}
                                  onChange={(e) => setExpenseData({...expenseData, amount: parseFloat(e.target.value)})}
                                  className="w-full pl-12 p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:ring-2 focus:ring-rose-500 font-bold text-[#1c2938]"
                                />
                            </div>
                         </div>
                         <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Fecha</label>
                            <div className="relative group">
                                <Calendar className="absolute left-4 top-4 w-5 h-5 text-slate-400 group-focus-within:text-rose-500" />
                                <input 
                                  type="date"
                                  value={expenseData.date}
                                  onChange={(e) => setExpenseData({...expenseData, date: e.target.value})}
                                  className="w-full pl-12 p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:ring-2 focus:ring-rose-500 font-bold text-[#1c2938]"
                                />
                            </div>
                         </div>
                      </div>

                      <div>
                         <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Concepto</label>
                         <textarea 
                           value={expenseData.concept}
                           onChange={(e) => {
                               setExpenseData({...expenseData, concept: e.target.value});
                               setFiscalAnalysis(null); // Reset analysis if concept changes manually
                           }}
                           className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:ring-2 focus:ring-rose-500 font-medium text-slate-600 h-24 resize-none"
                         />
                      </div>
                   </div>

                   {/* FISCAL AUDITOR CARD (AI) */}
                   {hasAiAccess && (
                       <div className="relative overflow-hidden rounded-[2rem] border transition-all duration-500 animate-in fade-in slide-in-from-bottom-2">
                           {isAnalyzingFiscal ? (
                               <div className="p-6 bg-slate-50 flex items-center gap-3 text-slate-400">
                                   <Loader2 className="w-5 h-5 animate-spin text-[#27bea5]" />
                                   <span className="text-sm font-medium">Auditando deducibilidad fiscal...</span>
                               </div>
                           ) : fiscalAnalysis ? (
                               <div className={`p-6 border-l-8 ${
                                   fiscalAnalysis.isDeductible 
                                       ? (fiscalAnalysis.likelihood === 'HIGH' ? 'bg-green-50 border-green-500' : 'bg-amber-50 border-amber-400')
                                       : 'bg-red-50 border-red-500'
                               }`}>
                                   <div className="flex justify-between items-start mb-2">
                                       <h4 className={`font-bold text-lg flex items-center gap-2 ${
                                           fiscalAnalysis.isDeductible ? 'text-green-800' : 'text-red-800'
                                       }`}>
                                           {fiscalAnalysis.isDeductible ? <ShieldCheck className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                                           {fiscalAnalysis.isDeductible ? 'Gasto Deducible' : 'No Deducible'}
                                       </h4>
                                       <span className="text-[10px] uppercase font-bold tracking-wider bg-white/50 px-2 py-1 rounded">
                                           IA Fiscal
                                       </span>
                                   </div>
                                   <p className="text-sm text-slate-700 leading-relaxed mb-3">
                                       {fiscalAnalysis.explanation}
                                   </p>
                                   <div className="flex gap-2">
                                       <span className="text-xs font-bold bg-white px-3 py-1 rounded-full border border-slate-100 text-slate-500 flex items-center gap-1">
                                           <Scale className="w-3 h-3" /> {fiscalAnalysis.categorySuggestion}
                                       </span>
                                       {fiscalAnalysis.warning && (
                                           <span className="text-xs font-bold bg-amber-100 text-amber-700 px-3 py-1 rounded-full border border-amber-200">
                                               ⚠️ {fiscalAnalysis.warning}
                                           </span>
                                       )}
                                   </div>
                               </div>
                           ) : null}
                       </div>
                   )}

                   <button 
                     onClick={handleSave}
                     className="w-full bg-[#1c2938] text-white py-4 rounded-2xl font-bold text-lg hover:bg-rose-500 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0"
                   >
                     Confirmar Gasto
                   </button>
                </div>

                {/* Right: Preview (Image or PDF) */}
                {uploadedImage && (
                  <div className="w-full md:w-80 bg-slate-100 rounded-[2rem] border border-slate-200 flex items-center justify-center relative overflow-hidden group h-96">
                     {fileType === 'pdf' ? (
                        <embed 
                          src={uploadedImage} 
                          type="application/pdf" 
                          className="w-full h-full rounded-[2rem]" 
                        />
                     ) : (
                        <img 
                          src={uploadedImage} 
                          alt="Receipt" 
                          className="object-cover w-full h-full opacity-90 transition-opacity" 
                        />
                     )}
                     
                     {fileType !== 'pdf' && (
                       <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end p-4 pointer-events-none">
                          <p className="text-white text-xs font-bold flex items-center gap-1">
                             <ImageIcon className="w-3 h-3" /> Recibo Original
                          </p>
                       </div>
                     )}
                  </div>
                )}
             </div>
          </div>
       )}

    </div>
  );
};

export default ExpenseWizard;
