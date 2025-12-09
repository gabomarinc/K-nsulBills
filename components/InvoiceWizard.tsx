
import React, { useState, useEffect } from 'react';
import { 
  Mic, Send, Sparkles, Check, ArrowLeft, Edit2, Loader2, 
  FileText, FileBadge, Calendar, User, Search, Plus, Trash2, 
  ShoppingBag, Calculator, ChevronDown, Building2, Eye,
  Coins, Lock, AlertTriangle, Settings, Save, Archive
} from 'lucide-react';
import { Invoice, ParsedInvoiceData, UserProfile, InvoiceItem, InvoiceStatus } from '../types';
import { parseInvoiceRequest, AI_ERROR_BLOCKED } from '../services/geminiService';

interface InvoiceWizardProps {
  currentUser: UserProfile;
  isOffline: boolean;
  onSave: (invoice: Invoice) => void;
  onCancel: () => void;
  onViewDetail?: () => void;
  initialData?: Invoice | null; // NEW: Prop for editing
}

type Step = 'TYPE_SELECT' | 'AI_INPUT' | 'SMART_EDITOR' | 'SUCCESS';

const MOCK_CLIENTS = [
  { name: 'TechSolutions SRL', taxId: 'B12345678', email: 'billing@techsolutions.com' },
  { name: 'Restaurante El Sol', taxId: 'XEXX010101000', email: 'admin@elsol.mx' },
  { name: 'Agencia Creativa One', taxId: 'A98765432', email: 'finanzas@one.com' },
];

const InvoiceWizard: React.FC<InvoiceWizardProps> = ({ currentUser, isOffline, onSave, onCancel, onViewDetail, initialData }) => {
  // Initialize state based on initialData (Edit Mode)
  const [step, setStep] = useState<Step>(initialData ? 'SMART_EDITOR' : 'TYPE_SELECT');
  const [docType, setDocType] = useState<'Invoice' | 'Quote'>(initialData?.type as 'Invoice' | 'Quote' || 'Invoice');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  
  const [clientSearch, setClientSearch] = useState(initialData?.clientName || '');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  
  const [draft, setDraft] = useState<{
    clientName: string;
    clientTaxId: string;
    clientEmail?: string;
    items: InvoiceItem[];
    currency: string;
    discountRate: number; 
    notes: string;
    validityDate: string; 
  }>({
    clientName: initialData?.clientName || '',
    clientTaxId: initialData?.clientTaxId || '',
    clientEmail: initialData?.clientEmail || '',
    items: initialData?.items || [],
    currency: initialData?.currency || currentUser.defaultCurrency || 'USD',
    discountRate: 0,
    notes: '', 
    validityDate: initialData ? new Date(initialData.date).toISOString().split('T')[0] : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });

  const [generatedId, setGeneratedId] = useState(initialData?.id || '');
  const [savedStatus, setSavedStatus] = useState<InvoiceStatus>('Creada');

  // Check AI Access
  const hasAiAccess = !!currentUser.apiKeys?.gemini || !!currentUser.apiKeys?.openai;

  // --- LOGIC: Math & Fiscal ---
  const calculateTotals = () => {
    const subtotal = draft.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const discountAmount = subtotal * (draft.discountRate / 100);
    const taxableBase = subtotal - discountAmount;
    
    // Simplified Tax Logic (Demo)
    const taxRate = 0.21; // 21% IVA
    const taxAmount = taxableBase * taxRate;
    const total = taxableBase + taxAmount;

    return { subtotal, discountAmount, taxAmount, total };
  };

  const totals = calculateTotals();

  // --- LOGIC: Client Autocomplete ---
  const handleClientSelect = (client: typeof MOCK_CLIENTS[0]) => {
    setDraft(prev => ({ 
      ...prev, 
      clientName: client.name, 
      clientTaxId: client.taxId,
      clientEmail: client.email
    }));
    setClientSearch(client.name);
    setShowClientDropdown(false);
  };

  const handleNewClientTaxId = (id: string) => {
    setDraft(prev => ({ ...prev, clientTaxId: id }));
  };

  // --- LOGIC: AI Parsing ---
  const handleTypeSelect = (type: 'Invoice' | 'Quote') => {
    setDocType(type);
    setStep('AI_INPUT');
  };

  const handleAiSubmit = async () => {
    if (!input.trim()) return;
    setIsLoading(true);
    setAiError(null);
    try {
      const contextInput = `${docType === 'Quote' ? 'Cotización: ' : 'Factura: '} ${input}`;
      // Pass full apiKeys object for dual AI support
      const result = await parseInvoiceRequest(contextInput, currentUser.apiKeys);
      
      if (result) {
        // Construct items immediately
        const newItems = [{
          id: Date.now().toString(),
          description: result.concept || 'Servicios Profesionales',
          quantity: 1,
          price: result.amount || 0,
          tax: 21
        }];

        // Update draft state fully
        setDraft(prev => ({
          ...prev,
          clientName: result.clientName || prev.clientName,
          clientTaxId: result.clientName ? '' : prev.clientTaxId, // Clear ID if new name detected
          currency: result.currency || prev.currency,
          items: newItems
        }));
        
        // Update UI search field
        setClientSearch(result.clientName || '');
        
        // Move to editor
        setStep('SMART_EDITOR');
      }
    } catch (error: any) {
      console.error("AI Parsing Error", error);
      if (error.message === AI_ERROR_BLOCKED) {
          setAiError("Función bloqueada por falta de API Key.");
      } else {
          setAiError("No pude entender la solicitud. Intenta de nuevo.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const skipAi = () => {
    setStep('SMART_EDITOR');
  };

  const handleSave = (targetStatus: 'Borrador' | 'Creada') => {
    if (!draft.clientName) return;

    let newId = generatedId;
    
    // Only generate new ID if we are NOT editing
    if (!initialData) {
        const sequences = currentUser.documentSequences || {
        invoicePrefix: 'FAC', invoiceNextNumber: 1,
        quotePrefix: 'COT', quoteNextNumber: 1
        };
        if (docType === 'Invoice') {
        newId = `${sequences.invoicePrefix}-${String(sequences.invoiceNextNumber).padStart(4, '0')}`;
        } else {
        newId = `${sequences.quotePrefix}-${String(sequences.quoteNextNumber).padStart(4, '0')}`;
        }
    }

    const finalInvoice: Invoice = {
      id: newId,
      clientName: draft.clientName,
      clientTaxId: draft.clientTaxId,
      clientEmail: draft.clientEmail,
      date: initialData?.date || new Date().toISOString(), // Keep original date if editing
      items: draft.items,
      total: totals.total,
      // If offline, prioritize pending sync, otherwise use target status
      status: isOffline ? 'PendingSync' : targetStatus,
      currency: draft.currency,
      type: docType,
      // Preserve timeline if editing
      timeline: initialData?.timeline 
    };
    
    onSave(finalInvoice);
    setGeneratedId(newId);
    setSavedStatus(targetStatus);
    setStep('SUCCESS');
  };

  // --- COMPONENTS: Item Row ---
  const addItem = (catalogItem?: any) => {
    setDraft(prev => ({
      ...prev,
      items: [...prev.items, {
        id: Date.now().toString(),
        description: catalogItem?.name || '',
        quantity: 1,
        price: catalogItem?.price || 0,
        tax: 21
      }]
    }));
    setShowCatalog(false);
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...draft.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setDraft(prev => ({ ...prev, items: newItems }));
  };

  const removeItem = (index: number) => {
    setDraft(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  // --- RENDER ---
  if (step === 'SUCCESS') {
    const isDraft = savedStatus === 'Borrador';
    
    return (
      <div className="flex flex-col items-center justify-center h-full text-center animate-in zoom-in duration-300">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-lg ${isDraft ? 'bg-slate-100 text-slate-500 shadow-slate-200' : 'bg-green-100 text-green-600 shadow-green-200'}`}>
          {isDraft ? <Archive className="w-12 h-12" /> : <Check className="w-12 h-12" />}
        </div>
        <h2 className="text-3xl font-bold text-[#1c2938] mb-2">
          {initialData ? 'Cambios Guardados' : (isDraft ? 'Borrador Guardado' : (docType === 'Quote' ? 'Cotización Lista' : 'Factura Creada'))}
        </h2>
        <div className="bg-slate-50 px-4 py-2 rounded-lg border border-slate-200 mb-6">
           <span className="font-mono text-xl font-bold text-[#1c2938]">{generatedId}</span>
        </div>
        <p className="text-lg text-slate-500 mb-8 max-w-md">
          {initialData ? "El documento ha sido actualizado correctamente." : "Listo para el siguiente paso."}
        </p>
        <div className="flex gap-4">
           <button onClick={onCancel} className="text-slate-500 font-medium hover:text-slate-800 px-6">
             Cerrar
           </button>
           {!isDraft && (
             <button 
               onClick={() => onViewDetail && onViewDetail()}
               className="bg-[#27bea5] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#22a890] transition-all shadow-lg flex items-center gap-2"
             >
               <Eye className="w-5 h-5" /> Ver Documento
             </button>
           )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 px-4 lg:px-0">
        <div className="flex items-center gap-4">
          <button onClick={() => step === 'SMART_EDITOR' && !initialData ? setStep('AI_INPUT') : onCancel()} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-slate-500" />
          </button>
          {!initialData && (
            <div className="h-2 w-24 md:w-32 bg-slate-100 rounded-full overflow-hidden hidden md:block">
                <div 
                className="h-full bg-[#27bea5] transition-all duration-500 ease-out"
                style={{ width: step === 'TYPE_SELECT' ? '20%' : step === 'AI_INPUT' ? '50%' : '100%' }}
                />
            </div>
          )}
        </div>
        <div className="text-sm font-medium text-slate-400 uppercase tracking-wide">
          {step === 'SMART_EDITOR' ? (initialData ? 'Editando Documento' : (docType === 'Quote' ? 'Editando Cotización' : 'Editando Factura')) : 'Asistente'}
        </div>
      </div>

      {/* STEP 1: SELECT */}
      {step === 'TYPE_SELECT' && (
        <div className="flex-1 flex flex-col items-center justify-center animate-in slide-in-from-right-8 px-4">
          <h2 className="text-3xl font-bold text-[#1c2938] mb-8 text-center">¿Qué vamos a crear?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
            <button onClick={() => handleTypeSelect('Invoice')} className="group bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl border-2 border-transparent hover:border-[#27bea5] transition-all text-left">
              <div className="w-14 h-14 bg-[#27bea5]/10 text-[#27bea5] rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-[#1c2938]">Factura de Venta</h3>
              <p className="text-slate-500 mt-2">Para cobrar un trabajo ya realizado.</p>
            </button>

            <button onClick={() => handleTypeSelect('Quote')} className="group bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl border-2 border-transparent hover:border-[#27bea5] transition-all text-left">
              <div className="w-14 h-14 bg-[#1c2938]/10 text-[#1c2938] rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <FileBadge className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-[#1c2938]">Cotización</h3>
              <p className="text-slate-500 mt-2">Presupuesto formal para cerrar una venta.</p>
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: AI INPUT */}
      {step === 'AI_INPUT' && (
        <div className="flex-1 flex flex-col justify-center animate-in slide-in-from-right-8 px-4">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-[#1c2938]">Dímelo con tus palabras</h2>
            <p className="text-slate-500 mt-2">O salta este paso para hacerlo manualmente.</p>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100 max-w-2xl mx-auto w-full relative overflow-hidden">
            {hasAiAccess ? (
                <>
                    <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={docType === 'Quote' ? "Ej: Cotiza 3 laptops para TechSolutions..." : "Ej: Factura a Juan Pérez por consultoría..."}
                    className="w-full h-40 text-xl p-4 placeholder-slate-300 border-none focus:ring-0 resize-none rounded-xl"
                    autoFocus
                    />
                    {aiError && (
                        <div className="mx-4 mb-2 p-3 bg-red-50 text-red-600 rounded-xl text-sm flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" /> {aiError}
                        </div>
                    )}
                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-50">
                    <button onClick={skipAi} className="text-slate-500 font-medium hover:text-[#27bea5] px-4">
                        Saltar a Manual
                    </button>
                    <button 
                        onClick={handleAiSubmit}
                        disabled={!input.trim() || isLoading}
                        className="flex items-center gap-2 bg-[#27bea5] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#22a890] disabled:opacity-50 transition-all"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                        {isLoading ? 'Analizando...' : 'Generar Borrador'}
                    </button>
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        <Lock className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-bold text-[#1c2938] mb-2">Función de IA Bloqueada</h3>
                    <p className="text-slate-500 mb-6 max-w-md">
                        Para reducir costos y garantizar tu privacidad, debes configurar tu propia API Key (Gemini o OpenAI) en los Ajustes.
                    </p>
                    <div className="flex gap-4">
                        <button onClick={skipAi} className="text-slate-500 font-medium hover:text-[#1c2938] px-4">
                            Usar Modo Manual
                        </button>
                    </div>
                </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 3: SMART EDITOR (Fixed Layout) */}
      {step === 'SMART_EDITOR' && (
        <div className="flex-1 flex flex-col lg:flex-row gap-6 animate-in fade-in duration-300 h-[calc(100vh-140px)] min-h-[500px]">
          
          {/* LEFT: FORM INPUTS (Scrollable) */}
          <div className="flex-1 space-y-6 overflow-y-auto pb-20 pr-2 custom-scrollbar">
            
            {/* 1. Client Identity Section */}
            <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <User className="w-4 h-4" /> Cliente
              </h3>
              
              <div className="relative">
                <div className="flex items-center border rounded-xl px-3 py-3 focus-within:ring-2 focus-within:ring-[#27bea5] bg-slate-50">
                  <Search className="w-5 h-5 text-slate-400 mr-3" />
                  <input 
                    value={clientSearch}
                    onChange={(e) => {
                      setClientSearch(e.target.value);
                      setShowClientDropdown(true);
                      if (draft.clientName !== e.target.value) {
                         setDraft(prev => ({...prev, clientName: e.target.value}));
                      }
                    }}
                    placeholder="Buscar cliente o escribir nuevo..."
                    className="flex-1 bg-transparent outline-none font-medium text-[#1c2938] placeholder:font-normal"
                  />
                </div>

                {/* Autocomplete Dropdown */}
                {showClientDropdown && clientSearch && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden">
                    {MOCK_CLIENTS.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase())).map((c, idx) => (
                      <button 
                        key={idx}
                        onClick={() => handleClientSelect(c)}
                        className="w-full text-left px-4 py-3 hover:bg-[#27bea5]/10 transition-colors flex justify-between items-center group"
                      >
                        <div>
                          <p className="font-bold text-slate-800">{c.name}</p>
                          <p className="text-xs text-slate-500">{c.taxId}</p>
                        </div>
                        <Check className="w-4 h-4 text-[#27bea5] opacity-0 group-hover:opacity-100" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Smart ID Lookup for New Clients */}
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">ID Fiscal (RFC/NIF)</label>
                  <input 
                    value={draft.clientTaxId}
                    onChange={(e) => handleNewClientTaxId(e.target.value.toUpperCase())}
                    placeholder="Obligatorio"
                    className={`w-full p-3 rounded-xl border outline-none ${!draft.clientTaxId && draft.clientName ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}
                  />
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">Email (Opcional)</label>
                   <input 
                     value={draft.clientEmail || ''}
                     onChange={(e) => setDraft({...draft, clientEmail: e.target.value})}
                     placeholder="para@envio.com"
                     className="w-full p-3 rounded-xl border border-slate-200 bg-white outline-none"
                   />
                </div>
              </div>
            </section>

            {/* 2. Items Section */}
            <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4" /> Ítems
                </h3>
                <button 
                  onClick={() => setShowCatalog(!showCatalog)}
                  className="text-xs font-bold text-[#27bea5] bg-[#27bea5]/10 px-3 py-1.5 rounded-lg hover:bg-[#27bea5]/20 transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Catálogo
                </button>
              </div>

              {/* Catalog Popover */}
              {showCatalog && (
                <div className="mb-4 bg-slate-50 p-3 rounded-xl border border-slate-200 animate-in slide-in-from-top-2">
                  <p className="text-xs font-bold text-slate-500 mb-2 pl-1">Selecciona del catálogo:</p>
                  <div className="grid grid-cols-1 gap-2">
                    {currentUser.defaultServices?.map(svc => (
                      <button 
                        key={svc.id} 
                        onClick={() => addItem(svc)}
                        className="flex justify-between items-center p-2 bg-white rounded-lg border border-slate-100 hover:border-[#27bea5] text-left"
                      >
                        <span className="text-sm font-medium text-slate-700">{svc.name}</span>
                        <span className="text-sm font-bold text-[#1c2938]">${svc.price}</span>
                      </button>
                    ))}
                    <button 
                      onClick={() => addItem()}
                      className="text-center p-2 text-sm text-[#27bea5] font-medium hover:underline"
                    >
                      + Agregar ítem en blanco
                    </button>
                  </div>
                </div>
              )}

              {/* Items List */}
              <div className="space-y-3">
                {draft.items.map((item, idx) => (
                  <div key={item.id} className="flex gap-2 items-start group">
                    <div className="flex-1 space-y-2">
                      <input 
                        value={item.description}
                        onChange={(e) => updateItem(idx, 'description', e.target.value)}
                        placeholder="Descripción"
                        className="w-full p-2 font-medium border-b border-transparent focus:border-[#27bea5] bg-transparent outline-none placeholder:text-slate-300"
                      />
                      <div className="flex gap-2">
                         <div className="w-20">
                           <input 
                             type="number"
                             value={item.quantity}
                             onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value))}
                             className="w-full p-2 bg-slate-50 rounded-lg text-sm text-center outline-none focus:ring-1 focus:ring-[#27bea5]"
                             placeholder="Cant"
                           />
                         </div>
                         <div className="flex-1 relative">
                            <span className="absolute left-3 top-2 text-slate-400 text-sm">{draft.currency === 'EUR' ? '€' : '$'}</span>
                            <input 
                              type="number"
                              value={item.price}
                              onChange={(e) => updateItem(idx, 'price', parseFloat(e.target.value))}
                              className="w-full p-2 pl-6 bg-slate-50 rounded-lg text-sm outline-none focus:ring-1 focus:ring-[#27bea5]"
                              placeholder="Precio"
                            />
                         </div>
                      </div>
                    </div>
                    <button onClick={() => removeItem(idx)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* 3. Conditions Section */}
            <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Condiciones
              </h3>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                 <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">
                     {docType === 'Quote' ? 'Válida hasta' : 'Vencimiento'}
                   </label>
                   <input 
                       type="date"
                       value={draft.validityDate}
                       onChange={(e) => setDraft({...draft, validityDate: e.target.value})}
                       className="w-full p-2 rounded-xl border border-slate-200 bg-slate-50 outline-none text-sm"
                     />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">Moneda del Doc.</label>
                   <select 
                        value={draft.currency}
                        onChange={(e) => setDraft({...draft, currency: e.target.value})}
                        className="w-full p-2 rounded-xl border border-slate-200 bg-slate-50 outline-none text-sm"
                      >
                         {['USD', 'EUR', 'MXN', 'ARS', 'COP'].map(c => (
                            <option key={c} value={c}>{c}</option>
                         ))}
                      </select>
                 </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Notas / Condiciones</label>
                <textarea 
                   value={draft.notes}
                   onChange={(e) => setDraft({...draft, notes: e.target.value})}
                   placeholder="Notas visibles para el cliente..."
                   className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 outline-none text-sm h-20 resize-none"
                />
              </div>
            </section>
          </div>

          {/* RIGHT/BOTTOM: LIVE PREVIEW & MATH (Sticky & Fixed) */}
          <div className="lg:w-[380px] flex-shrink-0 z-10">
             <div className="bg-[#1c2938] text-white p-6 rounded-3xl shadow-xl lg:h-auto overflow-y-auto lg:overflow-visible flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                      <Calculator className="w-5 h-5 text-[#27bea5]" />
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Estimado</p>
                      <p className="text-3xl font-bold">{draft.currency === 'EUR' ? '€' : (draft.currency === 'USD' ? '$' : draft.currency)} {totals.total.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm border-t border-white/10 pt-4 mb-8">
                    <div className="flex justify-between text-slate-300">
                      <span>Subtotal</span>
                      <span>{totals.subtotal.toFixed(2)}</span>
                    </div>
                    {totals.discountAmount > 0 && (
                      <div className="flex justify-between text-green-400">
                        <span>Descuento ({draft.discountRate}%)</span>
                        <span>- {totals.discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-300">
                      <span>IVA (21%)</span>
                      <span>{totals.taxAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => handleSave('Borrador')}
                      disabled={!draft.clientName}
                      className="bg-transparent border border-slate-500 text-slate-300 py-3 rounded-xl font-bold hover:bg-white/5 disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-sm"
                    >
                      <Save className="w-4 h-4" /> Borrador
                    </button>
                    
                    <button 
                      onClick={() => handleSave('Creada')}
                      disabled={!draft.clientName || totals.total === 0}
                      className="bg-white text-[#1c2938] py-3 rounded-xl font-bold hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 group text-sm"
                    >
                      {initialData ? 'Guardar Cambios' : 'Finalizar'} <Check className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {isOffline && (
                    <p className="text-center text-xs text-amber-400 mt-2 font-medium">Modo Offline Activo ⚡️</p>
                  )}
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceWizard;
