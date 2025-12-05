
import React, { useState } from 'react';
import { 
  Search, Plus, FileText, CheckCircle2, 
  Clock, TrendingUp, ChevronRight,
  ArrowUpRight, PieChart, Filter, CalendarDays, Wallet,
  FileBadge, LayoutList, LayoutGrid, MoreHorizontal,
  Send, AlertCircle, Sparkles, DollarSign, Repeat, Eye,
  Activity, MessageCircle, Archive, Trash2
} from 'lucide-react';
import { Invoice } from '../types';

interface DocumentListProps {
  invoices: Invoice[];
  onSelectInvoice: (invoice: Invoice) => void;
  onCreateNew: () => void;
  onMarkPaid?: (id: string) => void;
  onConvertQuote?: (id: string) => void;
  onDeleteInvoice?: (id: string) => void; // New Prop
  currencySymbol: string;
}

type ViewMode = 'LIST' | 'GALLERY';
// New granular stages for better focus
type GalleryStage = 'DRAFT' | 'ALL_ACTIVE' | 'TO_COLLECT' | 'NEGOTIATION' | 'DONE';

const DocumentList: React.FC<DocumentListProps> = ({ 
  invoices, 
  onSelectInvoice, 
  onCreateNew, 
  onMarkPaid, 
  onConvertQuote, 
  onDeleteInvoice,
  currencySymbol 
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('LIST');
  const [galleryStage, setGalleryStage] = useState<GalleryStage>('ALL_ACTIVE');
  const [filterType, setFilterType] = useState<'ALL' | 'INVOICE' | 'QUOTE'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

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
    
    // Base type filter for List View
    const matchesType = filterType === 'ALL' 
      ? true 
      : filterType === 'INVOICE' 
        ? doc.type === 'Invoice' 
        : doc.type === 'Quote';
    
    // Gallery Stage Logic (Advanced Filtering)
    if (viewMode === 'GALLERY') {
       // 1. DRAFTS: Creation Lab
       if (galleryStage === 'DRAFT') {
         return matchesSearch && (doc.status === 'Borrador' || doc.status === 'Creada' || doc.status === 'PendingSync');
       }
       // 2. ALL ACTIVE: "En Movimiento" (Unified View)
       if (galleryStage === 'ALL_ACTIVE') {
         return matchesSearch && (doc.status === 'Enviada' || doc.status === 'Seguimiento' || doc.status === 'Negociacion');
       }
       // 3. TO COLLECT: Only Invoices sent/viewed (Cash Flow Focus)
       if (galleryStage === 'TO_COLLECT') {
         return matchesSearch && doc.type === 'Invoice' && (doc.status === 'Enviada' || doc.status === 'Seguimiento' || doc.status === 'Negociacion');
       }
       // 4. NEGOTIATION: Only Quotes active (Sales Focus)
       if (galleryStage === 'NEGOTIATION') {
         return matchesSearch && doc.type === 'Quote' && (doc.status === 'Enviada' || doc.status === 'Seguimiento' || doc.status === 'Negociacion');
       }
       // 5. DONE: Archive
       if (galleryStage === 'DONE') {
         return matchesSearch && (doc.status === 'Aceptada' || doc.status === 'Rechazada');
       }
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
      case 'Aceptada': return '#22c55e'; // Green
      case 'Negociacion': return '#a855f7'; // Purple
      case 'Seguimiento': return '#3b82f6'; // Blue
      case 'Enviada': return '#0ea5e9'; // Sky
      case 'Rechazada': return '#ef4444'; // Red
      case 'PendingSync': return '#f59e0b'; // Amber
      default: return '#94a3b8'; // Slate
    }
  };

  // --- RENDERERS ---

  const renderGalleryView = () => {
    
    // Helper to define tabs config
    const tabs: { id: GalleryStage; label: string; icon: React.ReactNode }[] = [
      { id: 'DRAFT', label: 'Borradores', icon: <Sparkles className="w-4 h-4" /> },
      { id: 'ALL_ACTIVE', label: 'En Movimiento', icon: <Activity className="w-4 h-4" /> },
      { id: 'TO_COLLECT', label: 'Por Cobrar', icon: <Wallet className="w-4 h-4" /> },
      { id: 'NEGOTIATION', label: 'En Negociación', icon: <MessageCircle className="w-4 h-4" /> },
      { id: 'DONE', label: 'Histórico', icon: <Archive className="w-4 h-4" /> },
    ];

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
         {/* Stage Selector (Scrollable) */}
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

         {/* Cards Grid */}
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredDocs.length > 0 ? filteredDocs.map(doc => (
               <div 
                 key={doc.id}
                 className="group bg-white rounded-[2rem] border border-slate-100 hover:border-[#27bea5]/30 shadow-sm hover:shadow-xl transition-all duration-300 relative overflow-hidden flex flex-col hover:-translate-y-2 h-[280px]"
               >
                  {/* Top Color Strip */}
                  <div 
                    className="h-2 w-full transition-colors" 
                    style={{ backgroundColor: getCardColor(doc.status) }}
                  ></div>
                  
                  {/* Delete Button (Hover) */}
                  {onDeleteInvoice && (
                     <button 
                       onClick={(e) => { e.stopPropagation(); onDeleteInvoice(doc.id); }}
                       className="absolute top-4 right-4 p-2 bg-slate-50 text-slate-400 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all z-20"
                       title="Eliminar"
                     >
                       <Trash2 className="w-4 h-4" />
                     </button>
                  )}

                  {/* Main Content Area */}
                  <div className="p-6 flex-1 flex flex-col justify-between relative z-10">
                     {/* Header */}
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

                     {/* Body */}
                     <div className="space-y-1 my-4 cursor-pointer" onClick={() => onSelectInvoice(doc)}>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest line-clamp-1">{doc.clientName}</p>
                        <h3 className="text-3xl font-bold text-[#1c2938] tracking-tight">{doc.currency} {doc.total.toLocaleString()}</h3>
                        <p className="text-xs text-slate-400 font-medium">Doc #{doc.id}</p>
                     </div>

                     {/* Footer Info (Date) - Fades out on Hover */}
                     <div className="flex items-center gap-2 text-xs font-medium text-slate-400 pt-4 border-t border-slate-50 transition-opacity duration-300 group-hover:opacity-20">
                        <CalendarDays className="w-3.5 h-3.5" />
                        <span>{new Date(doc.date).toLocaleDateString()}</span>
                     </div>
                  </div>

                  {/* SLIDING ACTION BAR (Bottom) */}
                  <div className="absolute bottom-0 left-0 w-full bg-white/95 backdrop-blur-md border-t border-slate-100 p-4 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 z-20 flex gap-2">
                     
                     {/* ACTION: Convert Quote (If Quote + Active) */}
                     {doc.type === 'Quote' && (doc.status === 'Negociacion' || doc.status === 'Enviada' || doc.status === 'Seguimiento') && onConvertQuote && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); onConvertQuote(doc.id); }}
                          className="flex-1 bg-[#27bea5] text-white py-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 hover:bg-[#22a890] transition-colors"
                          title="Aprobar y Convertir"
                        >
                           <Repeat className="w-4 h-4" />
                           <span>Convertir</span>
                        </button>
                     )}

                     {/* ACTION: Register Payment (If Invoice + Active) */}
                     {doc.type === 'Invoice' && (doc.status === 'Enviada' || doc.status === 'Seguimiento') && onMarkPaid && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); onMarkPaid(doc.id); }}
                          className="flex-1 bg-green-500 text-white py-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 hover:bg-green-600 transition-colors"
                          title="Registrar Cobro"
                        >
                           <DollarSign className="w-4 h-4" />
                           <span>Cobrar</span>
                        </button>
                     )}

                     {/* ACTION: View Detail (Always) */}
                     <button 
                       onClick={(e) => { e.stopPropagation(); onSelectInvoice(doc); }}
                       className="flex-1 bg-slate-100 text-[#1c2938] py-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 hover:bg-slate-200 transition-colors"
                     >
                        <Eye className="w-4 h-4" />
                        <span>Ver Detalle</span>
                     </button>
                  </div>
               </div>
            )) : (
              <div className="col-span-full py-16 text-center">
                 <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                    {galleryStage === 'DRAFT' ? <Sparkles className="w-8 h-8 text-slate-300" /> : 
                     galleryStage === 'TO_COLLECT' ? <CheckCircle2 className="w-8 h-8 text-green-300" /> :
                     galleryStage === 'NEGOTIATION' ? <MessageCircle className="w-8 h-8 text-purple-300" /> :
                     <Clock className="w-8 h-8 text-slate-300" />}
                 </div>
                 <h3 className="text-lg font-bold text-[#1c2938]">
                   {galleryStage === 'DRAFT' ? 'Sin borradores pendientes' : 
                    galleryStage === 'TO_COLLECT' ? '¡Todo al día! No hay cobros pendientes.' :
                    galleryStage === 'NEGOTIATION' ? 'El pipeline está limpio.' :
                    galleryStage === 'DONE' ? 'Histórico vacío' :
                    'Nada en movimiento por ahora'}
                 </h3>
                 <p className="text-slate-400 text-sm mt-1">
                   {galleryStage === 'DRAFT' ? '¡Es un buen momento para crear nuevas oportunidades!' :
                    galleryStage === 'TO_COLLECT' ? 'Relájate, el flujo de caja está bajo control.' :
                    galleryStage === 'NEGOTIATION' ? '¡Hora de enviar más cotizaciones y cerrar tratos!' :
                    'Tus documentos aparecerán aquí según su estado.'}
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
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* View Toggle */}
          <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-100 flex items-center">
             <button 
               onClick={() => setViewMode('LIST')}
               className={`p-2.5 rounded-lg transition-all ${viewMode === 'LIST' ? 'bg-[#1c2938] text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
               title="Vista de Lista"
             >
               <LayoutList className="w-5 h-5" />
             </button>
             <button 
               onClick={() => setViewMode('GALLERY')}
               className={`p-2.5 rounded-lg transition-all ${viewMode === 'GALLERY' ? 'bg-[#1c2938] text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
               title="Vista de Galería"
             >
               <LayoutGrid className="w-5 h-5" />
             </button>
          </div>

          <button 
            onClick={onCreateNew}
            className="flex-1 md:flex-none bg-[#1c2938] text-white px-6 py-3.5 rounded-2xl font-bold hover:bg-[#27bea5] transition-all duration-300 flex items-center justify-center gap-2 shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 group"
          >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
            <span className="hidden md:inline">Crear Nuevo</span>
            <span className="md:hidden">Crear</span>
          </button>
        </div>
      </div>

      {/* KPI SECTION (Only visible in List view or if user wants context) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 relative overflow-hidden group hover:shadow-md transition-all duration-300">
           <div className="absolute top-0 right-0 w-24 h-24 bg-green-50 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-green-100 transition-colors"></div>
           <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                 <div className="p-2.5 bg-green-50 text-green-600 rounded-xl">
                   <Wallet className="w-6 h-6" />
                 </div>
                 <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex items-center">
                   <ArrowUpRight className="w-3 h-3 mr-1" /> Real
                 </span>
              </div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Impacto Real (Cobrado)</p>
              <h3 className="text-2xl font-bold text-[#1c2938] mt-1 tracking-tight">{currencySymbol} {totalPaid.toLocaleString()}</h3>
           </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 relative overflow-hidden group hover:shadow-md transition-all duration-300 hover:border-amber-100">
           <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-amber-100 transition-colors"></div>
           <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                 <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                   <Clock className="w-6 h-6" />
                 </div>
              </div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Por Materializar</p>
              <h3 className="text-2xl font-bold text-[#1c2938] mt-1 tracking-tight">{currencySymbol} {totalPending.toLocaleString()}</h3>
           </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 relative overflow-hidden group hover:shadow-md transition-all duration-300">
           <div className="absolute top-0 right-0 w-24 h-24 bg-[#27bea5]/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-[#27bea5]/20 transition-colors"></div>
           <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                 <div className="p-2.5 bg-[#27bea5]/10 text-[#27bea5] rounded-xl">
                   <TrendingUp className="w-6 h-6" />
                 </div>
              </div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Oportunidades</p>
              <h3 className="text-2xl font-bold text-[#1c2938] mt-1 tracking-tight">{currencySymbol} {totalPipeline.toLocaleString()}</h3>
           </div>
        </div>

        <div className="bg-gradient-to-br from-[#1c2938] to-slate-800 p-6 rounded-[2rem] shadow-lg relative overflow-hidden text-white group">
           <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#27bea5] rounded-full blur-[60px] opacity-20 translate-y-1/2 -translate-x-1/2 group-hover:opacity-30 transition-opacity duration-500"></div>
           <div className="relative z-10 flex flex-col h-full justify-between">
              <div className="flex justify-between items-start">
                 <div className="p-2.5 bg-white/10 text-[#27bea5] rounded-xl backdrop-blur-sm">
                   <PieChart className="w-6 h-6" />
                 </div>
                 <div className="text-right">
                    <span className="text-3xl font-bold tracking-tight">{avgSuccess > 0 ? avgSuccess.toFixed(0) : 0}%</span>
                 </div>
              </div>
              <div>
                 <p className="text-[#27bea5] font-bold text-sm">Salud Comercial</p>
                 <p className="text-slate-400 text-xs font-medium">Probabilidad de cierre promedio</p>
              </div>
           </div>
        </div>
      </div>

      {/* SEARCH BAR (Common) */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-50 overflow-hidden flex flex-col md:flex-row p-2 gap-4">
        {viewMode === 'LIST' && (
           <div className="flex bg-slate-100 p-1.5 rounded-2xl md:w-auto w-full">
             <button onClick={() => setFilterType('ALL')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${filterType === 'ALL' ? 'bg-white text-[#1c2938] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Todos</button>
             <button onClick={() => setFilterType('INVOICE')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${filterType === 'INVOICE' ? 'bg-white text-[#1c2938] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Facturas</button>
             <button onClick={() => setFilterType('QUOTE')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${filterType === 'QUOTE' ? 'bg-white text-[#1c2938] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Cotizaciones</button>
           </div>
        )}

        <div className="flex-1 relative group">
           <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-[#27bea5] transition-colors" />
           <input 
             type="text" 
             placeholder="Buscar por cliente, folio o monto..." 
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
             className="w-full h-full pl-12 pr-6 py-3 bg-transparent border-none rounded-2xl text-sm font-medium text-[#1c2938] focus:bg-slate-50 focus:ring-0 placeholder:text-slate-300 transition-all outline-none"
           />
        </div>
      </div>

      {/* VIEWS */}
      {viewMode === 'GALLERY' ? renderGalleryView() : (
        <div className="space-y-4">
           {/* Header for List */}
           <div className="hidden md:grid grid-cols-12 px-8 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <div className="col-span-4">Cliente / Documento</div>
              <div className="col-span-3">Fecha</div>
              <div className="col-span-2 text-right">Monto</div>
              <div className="col-span-2 text-center">Estado</div>
              <div className="col-span-1"></div>
           </div>

           {filteredDocs.length > 0 ? filteredDocs.map((doc) => (
               <div 
                 key={doc.id}
                 onClick={() => onSelectInvoice(doc)} 
                 className="group bg-white rounded-3xl p-4 md:px-8 md:py-5 border border-slate-50 shadow-sm hover:shadow-lg hover:border-[#27bea5]/20 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer flex flex-col md:grid md:grid-cols-12 items-center gap-4 md:gap-0 relative overflow-hidden"
               >
                 <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${doc.type === 'Quote' ? 'bg-[#27bea5]' : 'bg-[#1c2938]'}`}></div>
                 
                 <div className="col-span-4 w-full flex items-center gap-4">
                   <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors ${
                     doc.type === 'Quote' ? 'bg-[#27bea5]/10 text-[#27bea5] group-hover:bg-[#27bea5] group-hover:text-white' : 'bg-[#1c2938]/5 text-[#1c2938] group-hover:bg-[#1c2938] group-hover:text-white'
                   }`}>
                     {doc.type === 'Quote' ? <FileBadge className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                   </div>
                   <div>
                     <p className="font-bold text-[#1c2938] text-lg group-hover:text-[#27bea5] transition-colors">{doc.clientName}</p>
                     <p className="text-xs text-slate-400 font-medium flex items-center gap-2">
                       <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">#{doc.id}</span>
                       <span>{doc.type === 'Quote' ? 'Cotización' : 'Factura de Venta'}</span>
                     </p>
                   </div>
                 </div>

                 <div className="col-span-3 w-full flex items-center gap-2 text-sm text-slate-500 font-medium md:pl-2">
                    <CalendarDays className="w-4 h-4 text-slate-300" />
                    {new Date(doc.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                 </div>

                 <div className="col-span-2 w-full text-left md:text-right">
                   <span className="font-bold text-[#1c2938] text-lg tracking-tight">{doc.currency} {doc.total.toLocaleString()}</span>
                 </div>

                 <div className="col-span-2 w-full flex md:justify-center">
                   <span className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${getStatusStyle(doc.status)}`}>
                     {doc.status === 'PendingSync' ? 'Cola Offline' : doc.status}
                   </span>
                 </div>

                 <div className="col-span-1 hidden md:flex justify-end opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                    {onDeleteInvoice && (
                      <button 
                         onClick={(e) => { e.stopPropagation(); onDeleteInvoice(doc.id); }}
                         className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors mr-2"
                         title="Eliminar"
                       >
                         <Trash2 className="w-5 h-5" />
                       </button>
                    )}
                    <div className="w-10 h-10 rounded-full bg-slate-50 text-[#1c2938] flex items-center justify-center hover:bg-[#27bea5] hover:text-white transition-colors">
                      <ChevronRight className="w-5 h-5" />
                    </div>
                 </div>
               </div>
           )) : (
             <div className="py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center">
               <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                 <Filter className="w-10 h-10 text-slate-300" />
               </div>
               <h3 className="text-xl font-bold text-[#1c2938] mb-2">Tu lienzo está en blanco</h3>
               <p className="text-slate-500 max-w-sm mx-auto mb-8 font-light">
                 No encontramos documentos con estos filtros.
               </p>
               <button onClick={onCreateNew} className="bg-[#1c2938] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#27bea5] transition-all flex items-center gap-2 shadow-lg">
                  <Plus className="w-4 h-4" /> Crear Documento
               </button>
             </div>
           )}
        </div>
      )}
    </div>
  );
};

export default DocumentList;
