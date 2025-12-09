import React, { useState } from 'react';
import { 
  Search, Plus, FileText, CheckCircle2, 
  Clock, TrendingUp, ChevronRight,
  ArrowUpRight, PieChart, Filter, CalendarDays, Wallet,
  FileBadge, LayoutList, LayoutGrid, MoreHorizontal,
  Send, AlertCircle, Sparkles, DollarSign, Repeat, Eye,
  Activity, MessageCircle, Archive, Trash2, Lock
} from 'lucide-react';
import { Invoice, UserProfile } from '../types';

interface DocumentListProps {
  invoices: Invoice[];
  onSelectInvoice: (invoice: Invoice) => void;
  onCreateNew: () => void;
  onMarkPaid?: (id: string) => void;
  onConvertQuote?: (id: string) => void;
  onDeleteInvoice?: (id: string) => void; 
  currencySymbol: string;
  currentUser?: UserProfile;
}

type ViewMode = 'LIST' | 'GALLERY';
type GalleryStage = 'DRAFT' | 'ALL_ACTIVE' | 'TO_COLLECT' | 'NEGOTIATION' | 'DONE';

const DocumentList: React.FC<DocumentListProps> = ({ 
  invoices, 
  onSelectInvoice, 
  onCreateNew, 
  onMarkPaid, 
  onConvertQuote, 
  onDeleteInvoice,
  currencySymbol,
  currentUser
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('LIST');
  const [galleryStage, setGalleryStage] = useState<GalleryStage>('ALL_ACTIVE');
  const [filterType, setFilterType] = useState<'ALL' | 'INVOICE' | 'QUOTE'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Check AI Access
  const hasAiAccess = !!currentUser?.apiKeys?.gemini || !!currentUser?.apiKeys?.openai;

  // --- STATS CALCULATION ---
  const totalPaid = invoices
    .filter(i => i.type === 'Invoice' && i.status === 'Aceptada')
    .reduce((acc, curr) => acc + curr.total, 0);

  const totalPending = invoices
    .filter(i => i.type === 'Invoice' && (i.status === 'Enviada' || i.status === 'Seguimiento' || i.status === 'Negociacion'))
    .reduce((acc, curr) => acc + curr.total, 0);

  const totalPipeline = invoices
    .filter(i => i.type === 'Quote' && i.status !== 'Rechazada')
    .reduce((acc, curr) => acc + curr.total, 0);

  const avgSuccess = invoices
    .filter(i => i.type === 'Quote' && i.successProbability)
    .reduce((acc, curr, _, arr) => acc + (curr.successProbability || 0) / arr.length, 0);

  // --- FILTERING ---
  const filteredDocs = invoices.filter(doc => {
    const matchesSearch = doc.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          doc.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'ALL' 
      ? true 
      : filterType === 'INVOICE' 
        ? doc.type === 'Invoice' 
        : doc.type === 'Quote';
    
    if (viewMode === 'GALLERY') {
       if (galleryStage === 'DRAFT') return matchesSearch && (doc.status === 'Borrador' || doc.status === 'Creada' || doc.status === 'PendingSync');
       if (galleryStage === 'ALL_ACTIVE') return matchesSearch && (doc.status === 'Enviada' || doc.status === 'Seguimiento' || doc.status === 'Negociacion');
       if (galleryStage === 'TO_COLLECT') return matchesSearch && doc.type === 'Invoice' && (doc.status === 'Enviada' || doc.status === 'Seguimiento' || doc.status === 'Negociacion');
       if (galleryStage === 'NEGOTIATION') return matchesSearch && doc.type === 'Quote' && (doc.status === 'Enviada' || doc.status === 'Seguimiento' || doc.status === 'Negociacion');
       if (galleryStage === 'DONE') return matchesSearch && (doc.status === 'Aceptada' || doc.status === 'Rechazada');
    }

    return matchesSearch && matchesType;
  });

  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'Aceptada': return 'bg-green-50 text-green-700 border-green-100 group-hover:bg-green-100';
      case 'Rechazada': return 'bg-red-50 text-red-700 border-red-100 group-hover:bg-red-100';
      case 'Negociacion': return 'bg-purple-50 text-purple-700 border-purple-100 group-hover:bg-purple-100';
      case 'Seguimiento': return 'bg-blue-50 text-blue-700 border-blue-100 group-hover:bg-blue-100';
      case 'Enviada': return 'bg-sky-50 text-sky-700 border-sky-100 group-hover:bg-sky-100';
      case 'PendingSync': return 'bg-amber-50 text-amber-700 border-amber-100';
      default: return 'bg-slate-50 text-slate-500 border-slate-100'; // Borrador, Creada
    }
  };

  const getCardColor = (status: string) => {
    switch(status) {
      case 'Aceptada': return '#22c55e';
      case 'Negociacion': return '#a855f7';
      case 'Seguimiento': return '#3b82f6';
      case 'Enviada': return '#0ea5e9';
      case 'Rechazada': return '#ef4444';
      case 'PendingSync': return '#f59e0b';
      default: return '#94a3b8';
    }
  };

  // --- RENDERERS ---

  const renderGalleryView = () => {
    const tabs: { id: GalleryStage; label: string; icon: React.ReactNode }[] = [
      { id: 'DRAFT', label: 'Borradores', icon: <Sparkles className="w-4 h-4" /> },
      { id: 'ALL_ACTIVE', label: 'En Movimiento', icon: <Activity className="w-4 h-4" /> },
      { id: 'TO_COLLECT', label: 'Por Cobrar', icon: <Wallet className="w-4 h-4" /> },
      { id: 'NEGOTIATION', label: 'En Negociación', icon: <MessageCircle className="w-4 h-4" /> },
      { id: 'DONE', label: 'Histórico', icon: <Archive className="w-4 h-4" /> },
    ];

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
         <div className="flex justify-center w-full">
            <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 flex overflow-x-auto max-w-full custom-scrollbar">
               {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setGalleryStage(tab.id)}
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap flex items-center gap-2 ${
                      galleryStage === tab.id 
                        ? 'text-white bg-[#1c2938] shadow-md' 
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
               ))}
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredDocs.length > 0 ? filteredDocs.map(doc => (
               <div 
                 key={doc.id}
                 className="group bg-white rounded-[2rem] border border-slate-100 hover:border-[#27bea5]/30 shadow-sm hover:shadow-xl transition-all duration-300 relative overflow-hidden flex flex-col hover:-translate-y-2 h-[280px]"
               >
                  <div className="h-2 w-full transition-colors" style={{ backgroundColor: getCardColor(doc.status) }}></div>
                  
                  {onDeleteInvoice && (
                     <button 
                       onClick={(e) => { e.stopPropagation(); onDeleteInvoice(doc.id); }}
                       className="absolute top-4 right-4 p-2 bg-slate-50 text-slate-400 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all z-20"
                       title="Eliminar"
                     >
                       <Trash2 className="w-4 h-4" />
                     </button>
                  )}

                  <div className="p-6 flex-1 flex flex-col justify-between relative z-10">
                     <div className="flex justify-between items-start">
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
                     {doc.type === 'Quote' && (doc.status === 'Negociacion' || doc.status === 'Enviada' || doc.status === 'Seguimiento') && onConvertQuote && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); onConvertQuote(doc.id); }}
                          className="flex-1 bg-[#27bea5] text-white py-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 hover:bg-[#22a890] transition-colors"
                        >
                           <Repeat className="w-4 h-4" /> <span>Convertir</span>
                        </button>
                     )}
                     {doc.type === 'Invoice' && (doc.status === 'Enviada' || doc.status === 'Seguimiento') && onMarkPaid && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); onMarkPaid(doc.id); }}
                          className="flex-1 bg-green-500 text-white py-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 hover:bg-green-600 transition-colors"
                        >
                           <DollarSign className="w-4 h-4" /> <span>Cobrar</span>
                        </button>
                     )}
                     <button 
                       onClick={(e) => { e.stopPropagation(); onSelectInvoice(doc); }}
                       className="flex-1 bg-slate-100 text-[#1c2938] py-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 hover:bg-slate-200 transition-colors"
                     >
                        <Eye className="w-4 h-4" /> <span>Ver Detalle</span>
                     </button>
                  </div>
               </div>
            )) : (
              <div className="col-span-full py-16 text-center">
                 <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <Clock className="w-8 h-8 text-slate-300" />
                 </div>
                 <h3 className="text-lg font-bold text-[#1c2938]">Nada en esta etapa</h3>
                 <p className="text-slate-400 text-sm mt-1">Tus documentos aparecerán aquí según su estado.</p>
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

      {/* KPI SECTION (Restored with AI Lock) */}
      <div className="hidden md:grid grid-cols-4 gap-6">
        {/* Card 1: Real Income */}
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

        {/* Card 2: Pending */}
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

        {/* Card 3: Pipeline */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 relative overflow-hidden group hover:shadow-md transition-all">
           <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-full -translate-y-1/2 translate-x-1/2"></div>
           <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                 <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl"><FileBadge className="w-6 h-6" /></div>
              </div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">En Tubería</p>
              <h3 className="text-2xl font-bold text-[#1c2938] mt-1 tracking-tight">{currencySymbol} {totalPipeline.toLocaleString()}</h3>
           </div>
        </div>

        {/* Card 4: AI Insight (Locked if no key) */}
        <div className="bg-[#1c2938] p-6 rounded-[2rem] shadow-lg relative overflow-hidden group text-white">
           <div className="absolute top-0 right-0 w-32 h-32 bg-[#27bea5] rounded-full blur-[40px] opacity-20 -translate-y-1/2 translate-x-1/2"></div>
           <div className="relative z-10 h-full flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                 <div className="p-2.5 bg-white/10 text-[#27bea5] rounded-xl"><Sparkles className="w-6 h-6" /></div>
                 {!hasAiAccess && <Lock className="w-4 h-4 text-slate-400" />}
              </div>
              
              <div>
                 <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Predicción Inteligente</p>
                 {hasAiAccess ? (
                    <>
                       <h3 className="text-lg font-bold leading-tight mb-1">Tendencia Positiva</h3>
                       <p className="text-xs text-[#27bea5] font-medium flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> Se estima +15% vs mes anterior
                       </p>
                    </>
                 ) : (
                    <>
                       <h3 className="text-lg font-bold leading-tight mb-2 text-slate-300">Función Bloqueada</h3>
                       <p className="text-[10px] text-rose-400 font-bold bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20 inline-block">
                          Requiere API Key
                       </p>
                    </>
                 )}
              </div>
           </div>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-50 overflow-hidden flex flex-col md:flex-row p-2 gap-4">
        {viewMode === 'LIST' && (
           <div className="hidden md:flex bg-slate-100 p-1.5 rounded-2xl md:w-auto w-full">
             <button onClick={() => setFilterType('ALL')} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${filterType === 'ALL' ? 'bg-white text-[#1c2938] shadow-sm' : 'text-slate-400'}`}>Todos</button>
             <button onClick={() => setFilterType('INVOICE')} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${filterType === 'INVOICE' ? 'bg-white text-[#1c2938] shadow-sm' : 'text-slate-400'}`}>Facturas</button>
             <button onClick={() => setFilterType('QUOTE')} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${filterType === 'QUOTE' ? 'bg-white text-[#1c2938] shadow-sm' : 'text-slate-400'}`}>Cotizaciones</button>
           </div>
        )}
        <div className="flex-1 relative group">
           <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-[#27bea5] transition-colors" />
           <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full h-full pl-12 pr-6 py-3 bg-transparent border-none rounded-2xl text-sm font-medium text-[#1c2938] focus:bg-slate-50 focus:ring-0 outline-none" />
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
                          doc.status === 'Aceptada' ? 'text-green-600' : 
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
                  <div key={doc.id} onClick={() => onSelectInvoice(doc)} className="group bg-white rounded-3xl p-4 md:px-8 md:py-5 border border-slate-50 shadow-sm hover:shadow-lg cursor-pointer grid grid-cols-12 items-center relative overflow-hidden">
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
                    <div className="col-span-1 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-10 h-10 rounded-full bg-slate-50 text-[#1c2938] flex items-center justify-center hover:bg-[#27bea5] hover:text-white transition-colors">
                          <ChevronRight className="w-5 h-5" />
                        </div>
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