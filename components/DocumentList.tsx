
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, Plus, FileText, CheckCircle2, 
  Clock, TrendingUp, ChevronRight,
  ArrowUpRight, PieChart, Filter, CalendarDays, Wallet,
  FileBadge, LayoutList, LayoutGrid, MoreHorizontal,
  Send, AlertCircle, Sparkles, DollarSign, Repeat, Eye,
  Activity, MessageCircle, Archive, Trash2, Lock, Edit2, XCircle,
  Landmark, Calculator, ShieldCheck, TrendingDown, RefreshCw, Loader2
} from 'lucide-react';
import { Invoice, InvoiceStatus, UserProfile } from '../types';
import { generateRevenueInsight } from '../services/geminiService'; // New import

interface DocumentListProps {
  invoices: Invoice[];
  onSelectInvoice: (invoice: Invoice) => void;
  onCreateNew: () => void;
  onUpdateStatus?: (id: string, status: InvoiceStatus) => void; // Replaces specific actions
  onDeleteInvoice?: (id: string) => void; 
  onEditInvoice?: (invoice: Invoice) => void; 
  // Legacy props kept optional to avoid break, but now handled by onUpdateStatus
  onMarkPaid?: (id: string) => void; 
  onConvertQuote?: (id: string) => void;
  currencySymbol: string;
  currentUser?: UserProfile;
}

type ViewMode = 'LIST' | 'GALLERY';
// Consolidated Stage Type for both flows
type DocStage = 'DRAFT' | 'ALL_ACTIVE' | 'TO_COLLECT' | 'NEGOTIATION' | 'SENT_QUOTES' | 'DONE';

const DocumentList: React.FC<DocumentListProps> = ({ 
  invoices, 
  onSelectInvoice, 
  onCreateNew, 
  onUpdateStatus,
  onMarkPaid, 
  onConvertQuote, 
  onDeleteInvoice, 
  onEditInvoice,
  currencySymbol,
  currentUser
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('GALLERY');
  
  // NEW: Master Filter for Document Type
  const [docTypeFilter, setDocTypeFilter] = useState<'INVOICE' | 'QUOTE'>('INVOICE');
  
  const [currentStage, setCurrentStage] = useState<DocStage>('ALL_ACTIVE');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Quick Action Menu State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Check AI Access
  const hasAiAccess = !!currentUser?.apiKeys?.gemini || !!currentUser?.apiKeys?.openai;

  // AI Prediction State
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);

  // Reset stage when switching doc type to avoid empty states
  useEffect(() => {
      if (docTypeFilter === 'INVOICE') {
          setCurrentStage('ALL_ACTIVE');
      } else {
          setCurrentStage('SENT_QUOTES'); // Default for quotes
      }
  }, [docTypeFilter]);

  // --- STATS CALCULATION ---
  const totalPaid = invoices
    .filter(i => i.type === 'Invoice')
    .reduce((acc, curr) => {
        if (curr.amountPaid && curr.amountPaid > 0) return acc + curr.amountPaid;
        if (curr.status === 'Aceptada' || curr.status === 'Pagada') return acc + curr.total;
        return acc;
    }, 0);

  const totalPending = invoices
    .filter(i => i.type === 'Invoice' && i.status !== 'Borrador' && i.status !== 'Rechazada' && i.status !== 'Incobrable')
    .reduce((acc, curr) => {
       if (curr.status === 'Pagada' || curr.status === 'Aceptada') return acc;
       const paid = curr.amountPaid || 0;
       const pending = Math.max(0, curr.total - paid);
       return acc + pending;
    }, 0);

  const totalPipeline = invoices
    .filter(i => i.type === 'Quote' && (i.status === 'Enviada' || i.status === 'Seguimiento' || i.status === 'Negociacion'))
    .reduce((acc, curr) => acc + curr.total, 0);

  // --- REVENUE TREND LOGIC ---
  const revenueTrend = useMemo(() => {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      const prevDate = new Date();
      prevDate.setMonth(now.getMonth() - 1);
      const prevMonth = prevDate.getMonth();
      const prevYear = prevDate.getFullYear();

      let currentRevenue = 0;
      let prevRevenue = 0;

      invoices.filter(i => i.type === 'Invoice').forEach(inv => {
          const d = new Date(inv.date);
          const invMonth = d.getMonth();
          const invYear = d.getFullYear();
          
          let amount = 0;
          if (inv.status !== 'Borrador' && inv.status !== 'Rechazada') {
              amount = inv.total;
          }

          if (invMonth === currentMonth && invYear === currentYear) {
              currentRevenue += amount;
          } else if (invMonth === prevMonth && invYear === prevYear) {
              prevRevenue += amount;
          }
      });

      let percentageChange = 0;
      if (prevRevenue > 0) {
          percentageChange = ((currentRevenue - prevRevenue) / prevRevenue) * 100;
      } else if (currentRevenue > 0) {
          percentageChange = 100; 
      }

      return { currentRevenue, prevRevenue, percentageChange };
  }, [invoices]);

  // --- TRIGGER AI INSIGHT (CACHED) ---
  useEffect(() => {
      const fetchInsight = async () => {
          if (!hasAiAccess || invoices.length === 0) return;

          // Generate a fingerprint for the current financial state
          // We use revenue numbers and invoice count. If these change (new invoice, status change), we need a new insight.
          const dataSignature = `${revenueTrend.currentRevenue.toFixed(2)}_${revenueTrend.prevRevenue.toFixed(2)}_${invoices.length}`;
          const cacheKey = `konsul_ai_insight_${currentUser?.id}_${dataSignature}`;
          
          // 1. Try to load from cache
          const cachedInsight = localStorage.getItem(cacheKey);
          
          if (cachedInsight) {
              setAiInsight(cachedInsight);
              return;
          }

          // 2. If no cache and not currently loading, fetch from AI
          setIsLoadingInsight(true);
          
          try {
            const result = await generateRevenueInsight(
                revenueTrend.currentRevenue, 
                revenueTrend.prevRevenue, 
                revenueTrend.percentageChange, 
                currentUser?.apiKeys
            );
            
            if (result) {
                setAiInsight(result);
                // 3. Save to cache
                localStorage.setItem(cacheKey, result);
                
                // 4. Cleanup old cache entries to prevent storage bloat
                // Remove any key starting with 'konsul_ai_insight_' that isn't the current one for this user
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith(`konsul_ai_insight_${currentUser?.id}_`) && key !== cacheKey) {
                        localStorage.removeItem(key);
                    }
                });
            }
          } catch (e) {
            console.error("AI Insight Error", e);
          } finally {
            setIsLoadingInsight(false);
          }
      };

      fetchInsight();
  }, [hasAiAccess, revenueTrend, invoices.length, currentUser?.id]); 

  // --- FISCAL REALITY ENGINE ---
  const fiscalReality = useMemo(() => {
    if (!currentUser?.fiscalConfig) return null;

    const config = currentUser.fiscalConfig;
    const isJuridica = config.entityType === 'JURIDICA';
    
    let grossCollected = 0;
    let collectedITBMS = 0;
    
    invoices.forEach(inv => {
        if (inv.type !== 'Invoice') return;
        let collectedAmount = 0;
        if (inv.amountPaid && inv.amountPaid > 0) collectedAmount = inv.amountPaid;
        else if (inv.status === 'Pagada' || inv.status === 'Aceptada') collectedAmount = inv.total;
        
        if (collectedAmount > 0) {
            grossCollected += collectedAmount;
            const totalTax = inv.items.reduce((sum, item) => sum + (item.price * item.quantity * (item.tax / 100)), 0);
            const totalBase = inv.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const effectiveTaxRate = totalBase > 0 ? totalTax / totalBase : 0;
            const base = collectedAmount / (1 + effectiveTaxRate);
            collectedITBMS += (collectedAmount - base);
        }
    });

    const netIncome = grossCollected - collectedITBMS;
    let estimatedISR = 0;
    let isrRateDisplay = '';

    if (isJuridica) {
        estimatedISR = netIncome * 0.25; 
        isrRateDisplay = '25% (Jurídica)';
    } else {
        if (netIncome > 50000) {
            estimatedISR = ((netIncome - 50000) * 0.25) + 5850; 
            isrRateDisplay = 'Escalonado 25%';
        } else if (netIncome > 11000) {
            estimatedISR = (netIncome - 11000) * 0.15;
            isrRateDisplay = 'Escalonado 15%';
        } else {
            estimatedISR = 0;
            isrRateDisplay = 'Exento (<11k)';
        }
    }

    const governmentShare = collectedITBMS + estimatedISR;
    const yourMoney = grossCollected - governmentShare;

    return { grossCollected, collectedITBMS, estimatedISR, yourMoney, isrRateDisplay, governmentShare };
  }, [invoices, currentUser?.fiscalConfig]);


  // --- FILTERING LOGIC ---
  const filteredDocs = invoices.filter(doc => {
    // 1. Exclude Expenses
    if (doc.type === 'Expense') return false;

    // 2. Master Filter: Invoice vs Quote
    const isInvoice = doc.type === 'Invoice';
    const isQuote = doc.type === 'Quote';

    if (docTypeFilter === 'INVOICE' && !isInvoice) return false;
    if (docTypeFilter === 'QUOTE' && !isQuote) return false;

    // 3. Search
    const matchesSearch = doc.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          doc.id.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    
    // NEW: If user is searching, ignore currentStage (Tabs) and search across ALL docs of this type
    if (searchTerm.trim() !== '') return true;

    // 4. Stage Filtering (Tabs) - Only apply if NOT searching
    const isTechnicallyPaid = doc.status === 'Pagada' || doc.status === 'Aceptada' || (doc.type === 'Invoice' && (doc.amountPaid || 0) >= (doc.total - 0.01));

    if (docTypeFilter === 'INVOICE') {
        if (currentStage === 'DRAFT') return doc.status === 'Borrador' || doc.status === 'PendingSync';
        if (currentStage === 'ALL_ACTIVE') return (doc.status === 'Enviada' || doc.status === 'Seguimiento') && !isTechnicallyPaid;
        if (currentStage === 'TO_COLLECT') return (doc.status === 'Enviada' || doc.status === 'Seguimiento' || doc.status === 'Abonada') && !isTechnicallyPaid;
        if (currentStage === 'DONE') return isTechnicallyPaid || doc.status === 'Incobrable' || doc.status === 'Rechazada';
    } 
    
    if (docTypeFilter === 'QUOTE') {
        if (currentStage === 'DRAFT') return doc.status === 'Borrador' || doc.status === 'PendingSync';
        if (currentStage === 'SENT_QUOTES') return (doc.status === 'Enviada' || doc.status === 'Seguimiento');
        if (currentStage === 'NEGOTIATION') return doc.status === 'Negociacion';
        if (currentStage === 'DONE') return doc.status === 'Aceptada' || doc.status === 'Rechazada';
    }

    return false;
  });

  // --- TABS CONFIGURATION ---
  const getTabs = () => {
      if (docTypeFilter === 'INVOICE') {
          return [
              { id: 'DRAFT', label: 'Borradores' },
              { id: 'ALL_ACTIVE', label: 'En Movimiento' }, // Sent, Viewed
              { id: 'TO_COLLECT', label: 'Por Cobrar' },   // + Partial
              { id: 'DONE', label: 'Histórico' }           // Paid, Uncollectible
          ] as { id: DocStage, label: string }[];
      } else {
          return [
              { id: 'DRAFT', label: 'Borradores' },
              { id: 'SENT_QUOTES', label: 'Enviadas' }, // Sent, Viewed
              { id: 'NEGOTIATION', label: 'En Negociación' }, // Explicit Negotiation
              { id: 'DONE', label: 'Histórico' } // Won/Lost
          ] as { id: DocStage, label: string }[];
      }
  };

  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'Pagada':
      case 'Aceptada': return 'bg-green-50 text-green-700 border-green-100 group-hover:bg-green-100';
      case 'Rechazada': 
      case 'Incobrable': return 'bg-red-50 text-red-700 border-red-100 group-hover:bg-red-100';
      case 'Negociacion': return 'bg-purple-50 text-purple-700 border-purple-100 group-hover:bg-purple-100';
      case 'Seguimiento': return 'bg-blue-50 text-blue-700 border-blue-100 group-hover:bg-blue-100';
      case 'Abonada': return 'bg-indigo-50 text-indigo-700 border-indigo-100 group-hover:bg-indigo-100';
      case 'Enviada': return 'bg-sky-50 text-sky-700 border-sky-100 group-hover:bg-sky-100';
      case 'PendingSync': return 'bg-amber-50 text-amber-700 border-amber-100';
      default: return 'bg-slate-50 text-slate-500 border-slate-100'; 
    }
  };

  const getCardColor = (status: string) => {
    switch(status) {
      case 'Pagada':
      case 'Aceptada': return '#22c55e';
      case 'Negociacion': return '#a855f7';
      case 'Seguimiento': return '#3b82f6';
      case 'Abonada': return '#6366f1';
      case 'Enviada': return '#0ea5e9';
      case 'Rechazada':
      case 'Incobrable': return '#ef4444';
      case 'PendingSync': return '#f59e0b';
      case 'Creada': return '#1c2938'; 
      default: return '#94a3b8';
    }
  };

  const renderStatusMenu = (doc: Invoice) => {
    if (!onUpdateStatus) return null;

    const isQuote = doc.type === 'Quote';
    const current = doc.status;

    const options: { label: string, status: InvoiceStatus, icon: React.ReactNode, colorClass: string }[] = [];

    if (isQuote) {
        if (current !== 'Aceptada') options.push({ label: 'Aceptar', status: 'Aceptada', icon: <CheckCircle2 className="w-4 h-4" />, colorClass: 'text-green-600 hover:bg-green-50' });
        if (current !== 'Rechazada') options.push({ label: 'Rechazar', status: 'Rechazada', icon: <XCircle className="w-4 h-4" />, colorClass: 'text-red-600 hover:bg-red-50' });
        if (current !== 'Negociacion') options.push({ label: 'En Negociación', status: 'Negociacion', icon: <MessageCircle className="w-4 h-4" />, colorClass: 'text-purple-600 hover:bg-purple-50' });
    } else {
        // Invoice Options
        if (current !== 'Pagada') options.push({ label: 'Marcar Pagada', status: 'Pagada', icon: <CheckCircle2 className="w-4 h-4" />, colorClass: 'text-green-600 hover:bg-green-50' });
        if (current !== 'Abonada' && current !== 'Pagada') options.push({ label: 'Abonada (Parcial)', status: 'Abonada', icon: <Wallet className="w-4 h-4" />, colorClass: 'text-indigo-600 hover:bg-indigo-50' });
        if (current !== 'Incobrable' && current !== 'Pagada') options.push({ label: 'Incobrable', status: 'Incobrable', icon: <AlertCircle className="w-4 h-4" />, colorClass: 'text-slate-600 hover:bg-slate-100' });
    }

    // Common options
    if (current === 'Borrador') options.push({ label: 'Marcar Enviada', status: 'Enviada', icon: <Send className="w-4 h-4" />, colorClass: 'text-sky-600 hover:bg-sky-50' });

    return (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in-95">
            {options.map((opt) => (
                <button
                    key={opt.status}
                    onClick={(e) => {
                        e.stopPropagation();
                        onUpdateStatus(doc.id, opt.status);
                        setActiveMenuId(null);
                    }}
                    className={`w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-2 transition-colors ${opt.colorClass}`}
                >
                    {opt.icon} {opt.label}
                </button>
            ))}
            
            {/* DELETE OPTION */}
            {onDeleteInvoice && (
                <div className="border-t border-slate-100 mt-1 pt-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDeleteInvoice(doc.id);
                            setActiveMenuId(null);
                        }}
                        className="w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-2 transition-colors text-red-500 hover:bg-red-50"
                    >
                        <Trash2 className="w-4 h-4" /> Eliminar
                    </button>
                </div>
            )}
        </div>
    );
  };

  const renderGalleryView = () => {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredDocs.length > 0 ? filteredDocs.map(doc => (
               <div 
                 key={doc.id}
                 className="group bg-white rounded-[2rem] border border-slate-100 hover:border-[#27bea5]/30 shadow-sm hover:shadow-xl transition-all duration-300 relative overflow-hidden flex flex-col hover:-translate-y-2 h-[280px]"
                 onMouseLeave={() => setActiveMenuId(null)} // Close menu on leave
               >
                  <div className="h-2 w-full transition-colors" style={{ backgroundColor: getCardColor(doc.status) }}></div>
                  
                  {/* ACTIONS OVERLAY - Positioned Top Right */}
                  <div className="absolute top-4 right-4 flex gap-2 z-20">
                     {/* Status Menu Button */}
                     {onUpdateStatus && (
                         <div className="relative">
                             <button
                                 onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === doc.id ? null : doc.id); }}
                                 className="p-2 bg-white text-slate-400 rounded-xl hover:bg-slate-50 hover:text-[#1c2938] transition-all shadow-sm border border-slate-100"
                             >
                                 <MoreHorizontal className="w-4 h-4" />
                             </button>
                             {activeMenuId === doc.id && renderStatusMenu(doc)}
                         </div>
                     )}

                     {/* Edit Button (Visible on Hover) */}
                     {onEditInvoice && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); onEditInvoice(doc); }}
                          className="p-2 bg-white text-slate-400 rounded-xl hover:bg-[#27bea5] hover:text-white transition-all shadow-md border border-slate-100 opacity-0 group-hover:opacity-100"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                     )}
                  </div>

                  <div className="p-6 flex-1 flex flex-col justify-between relative z-10">
                     {/* Header: Icon + Status grouped on LEFT to avoid button overlap */}
                     <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                           doc.type === 'Quote' ? 'bg-purple-50 text-purple-500' : 'bg-slate-50 text-slate-500'
                        }`}>
                           {doc.type === 'Quote' ? <FileBadge className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                        </div>
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border ${getStatusStyle(doc.status)}`}>
                           {doc.status}
                        </span>
                     </div>

                     <div className="space-y-1 my-4 cursor-pointer" onClick={() => onSelectInvoice(doc)}>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest line-clamp-1">{doc.clientName}</p>
                        <h3 className="text-3xl font-bold text-[#1c2938] tracking-tight">{doc.currency} {doc.total.toLocaleString()}</h3>
                        <p className="text-xs text-slate-400 font-medium">Doc #{doc.id}</p>
                     </div>

                     <div className="flex items-center gap-2 text-xs font-medium text-slate-400 pt-4 border-t border-slate-50 transition-opacity duration-300 group-hover:opacity-20">
                        <CalendarDays className="w-3.5 h-3.5" />
                        <span>{new Date(doc.date).toLocaleDateString()}</span>
                     </div>
                  </div>

                  <div className="absolute bottom-0 left-0 w-full bg-white/95 backdrop-blur-md border-t border-slate-100 p-4 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 z-20 flex gap-2">
                     {/* Primary Actions based on Status - SPECIFIC FOR QUOTES */}
                     {doc.type === 'Quote' && (doc.status === 'Enviada' || doc.status === 'Negociacion') && onUpdateStatus && (
                       <>
                          <button 
                            onClick={(e) => { e.stopPropagation(); onUpdateStatus(doc.id, 'Aceptada'); }}
                            className="flex-1 bg-green-500 text-white py-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 hover:bg-green-600 transition-colors"
                          >
                             <CheckCircle2 className="w-4 h-4" /> <span>Aceptar</span>
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); onUpdateStatus(doc.id, 'Rechazada'); }}
                            className="flex-1 bg-slate-100 text-red-500 py-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 hover:bg-red-50 transition-colors"
                          >
                             <XCircle className="w-4 h-4" /> <span>Rechazar</span>
                          </button>
                       </>
                     )}
                     
                     {/* Fallback View Button if no specific actions or for Invoices */}
                     {!(doc.type === 'Quote' && (doc.status === 'Enviada' || doc.status === 'Negociacion')) && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); onSelectInvoice(doc); }}
                          className="flex-1 bg-slate-100 text-[#1c2938] py-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 hover:bg-slate-200 transition-colors"
                        >
                            <Eye className="w-4 h-4" /> <span>Ver Detalle</span>
                        </button>
                     )}
                  </div>
               </div>
            )) : (
              <div className="col-span-full py-16 text-center">
                 <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <Clock className="w-8 h-8 text-slate-300" />
                 </div>
                 <h3 className="text-lg font-bold text-[#1c2938]">Nada en esta etapa</h3>
                 <p className="text-slate-400 text-sm mt-1">
                    {docTypeFilter === 'INVOICE' ? 'No hay facturas con este estado.' : 'No hay cotizaciones con este estado.'}
                 </p>
              </div>
            )}
         </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in pb-12">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1c2938] tracking-tight">Tu Archivo Comercial</h1>
          <p className="text-slate-500 mt-1 text-lg font-light">Gestiona tu historia de éxito, documento a documento.</p>
        </div>
        <div className="hidden md:flex items-center gap-3 w-full md:w-auto">
          <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-100 flex items-center">
             <button onClick={() => setViewMode('LIST')} className={`p-2.5 rounded-lg transition-all ${viewMode === 'LIST' ? 'bg-[#1c2938] text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}><LayoutList className="w-5 h-5" /></button>
             <button onClick={() => setViewMode('GALLERY')} className={`p-2.5 rounded-lg transition-all ${viewMode === 'GALLERY' ? 'bg-[#1c2938] text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid className="w-5 h-5" /></button>
          </div>
          <button onClick={onCreateNew} className="bg-[#1c2938] text-white px-6 py-3.5 rounded-2xl font-bold hover:bg-[#27bea5] transition-all flex items-center gap-2 shadow-xl group">
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" /> <span>Crear Nuevo</span>
          </button>
        </div>
      </div>

      {/* NEW: FISCAL REALITY CARD (Only shows if config exists) */}
      {fiscalReality && fiscalReality.grossCollected > 0 && (
        <div className="bg-gradient-to-r from-slate-900 to-[#1c2938] p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden text-white animate-in slide-in-from-bottom-4">
           {/* Decor */}
           <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500 rounded-full blur-[100px] opacity-10 -translate-y-1/2 translate-x-1/2"></div>
           
           <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
              {/* Left: Reality Check */}
              <div className="flex-1">
                 <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/20">
                       <Landmark className="w-6 h-6" />
                    </div>
                    <div>
                       <h3 className="text-xl font-bold">Realidad Fiscal</h3>
                       <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Desglose de Recaudo Actual</p>
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-3 gap-4 mt-6">
                    <div>
                       <p className="text-xs text-slate-400 mb-1">Recaudado (Bruto)</p>
                       <p className="text-2xl font-bold">{currencySymbol}{fiscalReality.grossCollected.toLocaleString()}</p>
                    </div>
                    <div>
                       <p className="text-xs text-slate-400 mb-1">Apartado Impuestos</p>
                       <p className="text-2xl font-bold text-amber-400">
                          {currencySymbol}{fiscalReality.governmentShare.toLocaleString(undefined, {maximumFractionDigits: 0})}
                       </p>
                       <p className="text-[10px] text-amber-400/70">ITBMS + ISR Est.</p>
                    </div>
                    <div>
                       <p className="text-xs text-slate-400 mb-1">Neto Disponible</p>
                       <p className="text-2xl font-bold text-[#27bea5]">{currencySymbol}{fiscalReality.yourMoney.toLocaleString()}</p>
                    </div>
                 </div>
              </div>

              {/* Right: Tax Breakdown Visualization */}
              <div className="w-full md:w-80 bg-white/5 rounded-2xl p-5 border border-white/10">
                 <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                       <span className="text-slate-300">ITBMS (7%)</span>
                       <span className="font-mono text-white">{currencySymbol}{fiscalReality.collectedITBMS.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                       <span className="text-slate-300">ISR ({fiscalReality.isrRateDisplay})</span>
                       <span className="font-mono text-white">{currencySymbol}{fiscalReality.estimatedISR.toLocaleString()}</span>
                    </div>
                    <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                       <span className="font-bold text-[#27bea5]">Dinero Tuyo</span>
                       <span className="font-bold text-2xl text-[#27bea5]">{currencySymbol}{fiscalReality.yourMoney.toLocaleString()}</span>
                    </div>
                 </div>
                 {/* Visual Bar */}
                 <div className="mt-4 flex h-2 rounded-full overflow-hidden w-full bg-slate-800">
                    <div className="h-full bg-amber-500" style={{ width: `${(fiscalReality.governmentShare / fiscalReality.grossCollected) * 100}%` }} title="Impuestos"></div>
                    <div className="h-full bg-[#27bea5]" style={{ width: `${(fiscalReality.yourMoney / fiscalReality.grossCollected) * 100}%` }} title="Tu Dinero"></div>
                 </div>
                 <div className="flex justify-between mt-1 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    <span>Estado</span>
                    <span>Empresa</span>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* KPI Section - Standard (Always Visible) */}
      <div className="hidden md:grid grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 relative overflow-hidden group hover:shadow-md transition-all">
             <div className="absolute top-0 right-0 w-24 h-24 bg-green-50 rounded-full -translate-y-1/2 translate-x-1/2"></div>
             <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                   <div className="p-2.5 bg-green-50 text-green-600 rounded-xl"><Wallet className="w-6 h-6" /></div>
                   <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex items-center"><ArrowUpRight className="w-3 h-3 mr-1" /> Real</span>
                </div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Impacto Real</p>
                <h3 className="text-2xl font-bold text-[#1c2938] mt-1 tracking-tight">{currencySymbol} {totalPaid.toLocaleString()}</h3>
             </div>
          </div>
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 relative overflow-hidden group hover:shadow-md transition-all">
             <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-full -translate-y-1/2 translate-x-1/2"></div>
             <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                   <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl"><Clock className="w-6 h-6" /></div>
                </div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Por Cobrar</p>
                <h3 className="text-2xl font-bold text-[#1c2938] mt-1 tracking-tight">{currencySymbol} {totalPending.toLocaleString()}</h3>
             </div>
          </div>
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 relative overflow-hidden group hover:shadow-md transition-all">
             <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-full -translate-y-1/2 translate-x-1/2"></div>
             <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                   <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl"><FileBadge className="w-6 h-6" /></div>
                </div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Pipeline</p>
                <h3 className="text-2xl font-bold text-[#1c2938] mt-1 tracking-tight">{currencySymbol} {totalPipeline.toLocaleString()}</h3>
             </div>
          </div>
          
          {/* AI PREDICTION CARD (Optimized with Real Math + AI Insight) */}
          <div className="bg-[#1c2938] p-6 rounded-[2rem] shadow-lg relative overflow-hidden group text-white">
             <div className="absolute top-0 right-0 w-32 h-32 bg-[#27bea5] rounded-full blur-[40px] opacity-20 -translate-y-1/2 translate-x-1/2"></div>
             <div className="relative z-10 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                   <div className="p-2.5 bg-white/10 text-[#27bea5] rounded-xl"><Sparkles className="w-6 h-6" /></div>
                   {!hasAiAccess && <Lock className="w-4 h-4 text-slate-400" />}
                   {/* Fallback Refresh Indicator for Loading */}
                   {isLoadingInsight && <Loader2 className="w-4 h-4 animate-spin text-[#27bea5]" />}
                </div>
                <div>
                   <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Tendencia Mensual</p>
                   {invoices.length > 0 ? (
                      <>
                         <h3 className="text-lg font-bold leading-tight mb-1 flex items-center gap-2">
                            {revenueTrend.percentageChange > 0 ? 'Crecimiento' : (revenueTrend.percentageChange < 0 ? 'Contracción' : 'Estable')}
                            <span className={`text-sm px-2 py-0.5 rounded-lg border ${revenueTrend.percentageChange >= 0 ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                                {revenueTrend.percentageChange > 0 ? '+' : ''}{revenueTrend.percentageChange.toFixed(1)}%
                            </span>
                         </h3>
                         
                         {/* AI Insight Text */}
                         {hasAiAccess ? (
                             <p className="text-xs text-[#27bea5] font-medium mt-2 leading-snug opacity-90 animate-in fade-in">
                                {isLoadingInsight ? 'Analizando datos...' : (aiInsight || "Generando estrategia...")}
                             </p>
                         ) : (
                             <p className="text-[10px] text-rose-400 font-bold bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20 inline-block mt-2">
                                Requiere API Key para análisis
                             </p>
                         )}
                      </>
                   ) : (
                      <>
                         <h3 className="text-lg font-bold leading-tight mb-2 text-slate-300">Sin Datos</h3>
                         <p className="text-[10px] text-slate-400 font-medium">Crea facturas para activar la IA.</p>
                      </>
                   )}
                </div>
             </div>
          </div>
      </div>

      {/* UNIFIED FILTERS & SEARCH */}
      <div className="bg-white p-2 rounded-[2rem] border border-slate-50 shadow-sm flex flex-col gap-2">
          
          {/* TOP ROW: DOCUMENT TYPE TOGGLE */}
          <div className="flex justify-center p-2 border-b border-slate-50 pb-4 mb-2">
             <div className="bg-slate-100 p-1.5 rounded-full flex gap-2">
                <button
                  onClick={() => setDocTypeFilter('INVOICE')}
                  className={`px-8 py-2.5 rounded-full text-sm font-bold transition-all duration-300 flex items-center gap-2 ${
                    docTypeFilter === 'INVOICE' 
                      ? 'bg-white text-[#1c2938] shadow-md' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <FileText className="w-4 h-4" /> Facturas
                </button>
                <button
                  onClick={() => setDocTypeFilter('QUOTE')}
                  className={`px-8 py-2.5 rounded-full text-sm font-bold transition-all duration-300 flex items-center gap-2 ${
                    docTypeFilter === 'QUOTE' 
                      ? 'bg-white text-[#1c2938] shadow-md' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <FileBadge className="w-4 h-4" /> Cotizaciones
                </button>
             </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-center">
            {/* TABS SCROLL CONTAINER */}
            <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full md:w-auto overflow-x-auto custom-scrollbar">
                {getTabs().map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setCurrentStage(tab.id)}
                        className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all whitespace-nowrap ${
                        currentStage === tab.id 
                            ? 'bg-white text-[#1c2938] shadow-sm' 
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* SEARCH INPUT */}
            <div className="flex-1 relative group w-full">
                <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-[#27bea5] transition-colors" />
                <input 
                type="text" 
                placeholder={docTypeFilter === 'INVOICE' ? "Buscar facturas..." : "Buscar cotizaciones..."} 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="w-full h-full pl-12 pr-6 py-3 bg-transparent border-none rounded-2xl text-sm font-medium text-[#1c2938] focus:bg-slate-50 focus:ring-0 outline-none" 
                />
            </div>
          </div>
      </div>

      {/* VIEWS */}
      {viewMode === 'GALLERY' ? renderGalleryView() : (
        <div className="space-y-4">
           {/* Mobile List Rendering */}
           <div className="md:hidden space-y-4">
              {filteredDocs.map((doc) => (
                 <div key={doc.id} onClick={() => onSelectInvoice(doc)} className="bg-white p-4 rounded-2xl border border-slate-50 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-4">
                       <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${doc.type === 'Quote' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                          {doc.type === 'Quote' ? <FileBadge className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                       </div>
                       <div>
                          <h4 className="font-bold text-[#1c2938] text-lg">{doc.clientName}</h4>
                          <p className="text-xs text-slate-400">{new Date(doc.date).toLocaleDateString()}</p>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="font-bold text-[#1c2938] text-lg">{doc.currency} {doc.total.toLocaleString()}</p>
                       <span className={`text-[10px] font-bold uppercase ${
                          doc.status === 'Aceptada' || doc.status === 'Pagada' ? 'text-green-600' : 
                          doc.status === 'PendingSync' ? 'text-amber-600' : 'text-slate-400'
                       }`}>{doc.status}</span>
                    </div>
                 </div>
              ))}
           </div>

           {/* Desktop List Rendering */}
           <div className="hidden md:block space-y-4">
              <div className="grid grid-cols-12 px-8 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <div className="col-span-4">Cliente / Documento</div>
                  <div className="col-span-3">Fecha</div>
                  <div className="col-span-2 text-right">Monto</div>
                  <div className="col-span-2 text-center">Estado</div>
                  <div className="col-span-1"></div>
              </div>
              {filteredDocs.map((doc) => (
                  <div key={doc.id} onClick={() => onSelectInvoice(doc)} className="group bg-white rounded-3xl p-4 md:px-8 md:py-5 border border-slate-50 shadow-sm hover:shadow-lg cursor-pointer grid grid-cols-12 items-center relative overflow-visible">
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${doc.type === 'Quote' ? 'bg-[#27bea5]' : 'bg-[#1c2938]'}`}></div>
                    <div className="col-span-4 w-full flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${doc.type === 'Quote' ? 'bg-[#27bea5]/10 text-[#27bea5]' : 'bg-[#1c2938]/5 text-[#1c2938]'}`}>
                        {doc.type === 'Quote' ? <FileBadge className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                      </div>
                      <div>
                        <p className="font-bold text-[#1c2938] text-lg">{doc.clientName}</p>
                        <p className="text-xs text-slate-400 font-medium">#{doc.id}</p>
                      </div>
                    </div>
                    <div className="col-span-3 w-full flex items-center gap-2 text-sm text-slate-500 font-medium pl-2">
                        <CalendarDays className="w-4 h-4 text-slate-300" />
                        {new Date(doc.date).toLocaleDateString()}
                    </div>
                    <div className="col-span-2 w-full text-right">
                      <span className="font-bold text-[#1c2938] text-lg tracking-tight">{doc.currency} {doc.total.toLocaleString()}</span>
                    </div>
                    <div className="col-span-2 w-full flex justify-center">
                      <span className={`px-4 py-1.5 rounded-full text-xs font-bold border ${getStatusStyle(doc.status)}`}>
                        {doc.status}
                      </span>
                    </div>
                    <div className="col-span-1 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity relative">
                       {onUpdateStatus && (
                          <>
                            <button onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === doc.id ? null : doc.id); }} className="w-10 h-10 rounded-full bg-slate-50 text-[#1c2938] flex items-center justify-center hover:bg-[#27bea5] hover:text-white transition-colors">
                                <MoreHorizontal className="w-5 h-5" />
                            </button>
                            {activeMenuId === doc.id && (
                                <div className="absolute top-10 right-0 w-48 z-50">
                                    {renderStatusMenu(doc)}
                                </div>
                            )}
                          </>
                       )}
                    </div>
                  </div>
              ))}
           </div>
        </div>
      )}
    </div>
  );
};

export default DocumentList;
