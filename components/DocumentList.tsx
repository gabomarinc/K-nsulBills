
import React, { useState, useMemo } from 'react';
import { 
  Search, Plus, LayoutGrid, List, FileText, FileBadge, 
  Clock, CheckCircle2, ChevronRight, AlertCircle, Ban, ArrowRight, Eye, MoreHorizontal, Trash2,
  Wallet, Hourglass, Target, Archive, RefreshCcw
} from 'lucide-react';
import { Invoice, InvoiceStatus, UserProfile } from '../types';

interface DocumentListProps {
  invoices: Invoice[];
  onSelectInvoice: (invoice: Invoice) => void;
  onCreateNew: () => void;
  onDeleteInvoice: (id: string) => void;
  onEditInvoice: (invoice: Invoice) => void;
  onUpdateStatus: (id: string, status: InvoiceStatus) => void;
  currencySymbol: string;
  currentUser?: UserProfile;
}

type ViewMode = 'LIST' | 'GALLERY';
type FilterType = 'ALL' | 'INVOICE' | 'QUOTE';
type GalleryStage = 'DRAFT' | 'ALL_ACTIVE' | 'TO_COLLECT' | 'NEGOTIATION' | 'DONE';

const DocumentList: React.FC<DocumentListProps> = ({ 
  invoices, 
  onSelectInvoice, 
  onCreateNew, 
  onDeleteInvoice, 
  onEditInvoice,
  onUpdateStatus,
  currencySymbol
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('ALL');
  const [viewMode, setViewMode] = useState<ViewMode>('GALLERY');
  const [galleryStage, setGalleryStage] = useState<GalleryStage>('ALL_ACTIVE');

  // --- STATS CALCULATION (Restored) ---
  const stats = useMemo(() => {
    const activeInvoices = invoices.filter(i => i.type === 'Invoice' && i.status !== 'Borrador' && i.status !== 'Rechazada');
    const totalVolume = activeInvoices.reduce((acc, curr) => acc + curr.total, 0);
    
    const pendingInvoices = invoices.filter(i => i.type === 'Invoice' && (i.status === 'Enviada' || i.status === 'Seguimiento' || i.status === 'Abonada'));
    const pendingAmount = pendingInvoices.reduce((acc, curr) => acc + (curr.total - (curr.amountPaid || 0)), 0);

    const activeQuotes = invoices.filter(i => i.type === 'Quote' && (i.status === 'Enviada' || i.status === 'Seguimiento' || i.status === 'Negociacion'));
    const quotePipeline = activeQuotes.reduce((acc, curr) => acc + curr.total, 0);

    const draftCount = invoices.filter(i => i.status === 'Borrador').length;

    return { totalVolume, pendingAmount, quotePipeline, draftCount };
  }, [invoices]);

  // --- FILTERING LOGIC (Strict as requested) ---
  const filteredDocs = invoices.filter(doc => {
    // 1. Exclude Expenses
    if (doc.type === 'Expense') return false;

    const matchesSearch = doc.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          doc.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'ALL' 
      ? true 
      : filterType === 'INVOICE' 
        ? doc.type === 'Invoice' 
        : doc.type === 'Quote';
    
    // Check if technically paid
    const isTechnicallyPaid = doc.status === 'Pagada' || doc.status === 'Aceptada' || (doc.type === 'Invoice' && (doc.amountPaid || 0) >= (doc.total - 0.05));

    if (viewMode === 'GALLERY') {
       if (galleryStage === 'DRAFT') return matchesSearch && (doc.status === 'Borrador' || doc.status === 'PendingSync');
       
       if (galleryStage === 'ALL_ACTIVE') {
           // STRICT FILTER: Only 'Enviada' or 'Seguimiento'. Exclude 'Creada', 'Abonada', 'Negociacion'.
           // Must NOT be paid.
           const isActiveStatus = doc.status === 'Enviada' || doc.status === 'Seguimiento';
           return matchesSearch && isActiveStatus && !isTechnicallyPaid;
       }

       if (galleryStage === 'TO_COLLECT') {
           // Invoices only. Active status + Abonada.
           const isCollectableStatus = doc.status === 'Enviada' || doc.status === 'Seguimiento' || doc.status === 'Abonada';
           return matchesSearch && doc.type === 'Invoice' && isCollectableStatus && !isTechnicallyPaid;
       }

       if (galleryStage === 'NEGOTIATION') {
           // Quotes only. Must include 'Negociacion' explicitly, plus standard active quote states.
           return matchesSearch && doc.type === 'Quote' && (doc.status === 'Negociacion' || doc.status === 'Enviada' || doc.status === 'Seguimiento') && !isTechnicallyPaid;
       }

       if (galleryStage === 'DONE') {
           // History: Paid, Rejected, or Technically Paid items
           const isDoneStatus = doc.status === 'Rechazada' || doc.status === 'Incobrable';
           return matchesSearch && (isDoneStatus || isTechnicallyPaid);
       }
    }

    return matchesSearch && matchesType;
  });

  const getStatusColor = (status: string) => {
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
      default: return 'bg-slate-50 text-slate-500 border-slate-200';
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in pb-12">
      
      {/* HEADER & CONTROLS */}
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1c2938] tracking-tight">Mis Documentos</h1>
          <p className="text-slate-500 mt-1 text-lg font-light">Gestiona tus facturas y cotizaciones.</p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
           <div className="flex-1 md:w-64 bg-white p-1.5 pl-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 focus-within:ring-2 focus-within:ring-[#27bea5] transition-all">
             <Search className="w-5 h-5 text-slate-400" />
             <input 
               type="text" 
               placeholder="Buscar..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="flex-1 outline-none text-slate-700 font-medium bg-transparent"
             />
           </div>

           <button 
             onClick={onCreateNew}
             className="bg-[#1c2938] text-white px-6 py-3 rounded-2xl font-bold hover:bg-[#27bea5] transition-all flex items-center gap-2 shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 group whitespace-nowrap"
           >
             <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
             <span className="hidden md:inline">Nuevo</span>
           </button>
        </div>
      </div>

      {/* KPI CARDS (Restored) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         <div className="bg-white p-5 rounded-[2rem] border border-slate-50 shadow-sm flex flex-col justify-between h-32 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
               <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><Wallet className="w-5 h-5" /></div>
               <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Volumen</span>
            </div>
            <p className="text-2xl font-bold text-[#1c2938]">{currencySymbol}{stats.totalVolume.toLocaleString()}</p>
         </div>
         <div className="bg-white p-5 rounded-[2rem] border border-slate-50 shadow-sm flex flex-col justify-between h-32 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
               <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><Hourglass className="w-5 h-5" /></div>
               <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Por Cobrar</span>
            </div>
            <p className="text-2xl font-bold text-[#1c2938]">{currencySymbol}{stats.pendingAmount.toLocaleString()}</p>
         </div>
         <div className="bg-white p-5 rounded-[2rem] border border-slate-50 shadow-sm flex flex-col justify-between h-32 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
               <div className="p-2 bg-purple-50 text-purple-600 rounded-xl"><Target className="w-5 h-5" /></div>
               <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">En Juego</span>
            </div>
            <p className="text-2xl font-bold text-[#1c2938]">{currencySymbol}{stats.quotePipeline.toLocaleString()}</p>
         </div>
         <div className="bg-white p-5 rounded-[2rem] border border-slate-50 shadow-sm flex flex-col justify-between h-32 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
               <div className="p-2 bg-slate-100 text-slate-500 rounded-xl"><Archive className="w-5 h-5" /></div>
               <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Borradores</span>
            </div>
            <p className="text-2xl font-bold text-[#1c2938]">{stats.draftCount}</p>
         </div>
      </div>

      {/* VIEW TOGGLES & FILTERS */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-2 rounded-[2rem] border border-slate-50 shadow-sm sticky top-4 z-20">
         <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
            {viewMode === 'GALLERY' ? (
                <>
                    {(['ALL_ACTIVE', 'TO_COLLECT', 'NEGOTIATION', 'DRAFT', 'DONE'] as const).map(stage => (
                        <button
                            key={stage}
                            onClick={() => setGalleryStage(stage)}
                            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                galleryStage === stage ? 'bg-white text-[#1c2938] shadow-sm' : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            {stage === 'ALL_ACTIVE' ? 'En Movimiento' : 
                             stage === 'TO_COLLECT' ? 'Por Cobrar' : 
                             stage === 'NEGOTIATION' ? 'En Negociación' : 
                             stage === 'DRAFT' ? 'Borradores' : 'Historial'}
                        </button>
                    ))}
                </>
            ) : (
                <>
                    {(['ALL', 'INVOICE', 'QUOTE'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilterType(f)}
                            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                filterType === f ? 'bg-white text-[#1c2938] shadow-sm' : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            {f === 'ALL' ? 'Todos' : f === 'INVOICE' ? 'Facturas' : 'Cotizaciones'}
                        </button>
                    ))}
                </>
            )}
         </div>

         <div className="flex bg-slate-100 p-1 rounded-xl">
            <button onClick={() => setViewMode('GALLERY')} className={`p-2 rounded-lg ${viewMode === 'GALLERY' ? 'bg-white shadow-sm text-[#1c2938]' : 'text-slate-400'}`}>
                <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('LIST')} className={`p-2 rounded-lg ${viewMode === 'LIST' ? 'bg-white shadow-sm text-[#1c2938]' : 'text-slate-400'}`}>
                <List className="w-4 h-4" />
            </button>
         </div>
      </div>

      {/* DOCUMENT GRID/LIST */}
      {filteredDocs.length > 0 ? (
        <div className={`grid gap-6 ${viewMode === 'GALLERY' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
            {filteredDocs.map(doc => (
                <div 
                    key={doc.id}
                    onClick={() => onSelectInvoice(doc)}
                    className={`bg-white rounded-[2rem] border border-slate-50 shadow-sm hover:shadow-xl hover:border-[#27bea5]/30 transition-all duration-300 group cursor-pointer relative overflow-hidden flex flex-col ${viewMode === 'LIST' ? 'flex-row items-center p-4' : 'p-6 h-[280px]'}`}
                >
                    {/* Top Section */}
                    <div className={`flex justify-between items-start ${viewMode === 'LIST' ? 'w-1/3' : 'mb-6'}`}>
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                                doc.type === 'Quote' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                            }`}>
                                {doc.type === 'Quote' ? <FileBadge className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                            </div>
                            <div>
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${doc.type === 'Quote' ? 'text-purple-400' : 'text-blue-400'}`}>
                                    {doc.type === 'Quote' ? 'Cotización' : 'Factura'}
                                </span>
                                <h3 className="font-bold text-[#1c2938] leading-tight group-hover:text-[#27bea5] transition-colors">
                                    {doc.clientName}
                                </h3>
                            </div>
                        </div>
                    </div>

                    {/* Middle Section (Details) */}
                    <div className={`flex-1 ${viewMode === 'LIST' ? 'w-1/3 px-4' : ''}`}>
                        <p className="text-xs text-slate-400 font-mono mb-2">#{doc.id}</p>
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Clock className="w-3 h-3" /> {new Date(doc.date).toLocaleDateString()}
                            </div>
                            <div className="flex items-center gap-2 text-xl font-bold text-[#1c2938]">
                                {currencySymbol} {doc.total.toLocaleString()}
                            </div>
                        </div>
                    </div>

                    {/* Bottom/Right Section (Status) */}
                    <div className={`${viewMode === 'LIST' ? 'w-1/3 text-right' : 'mt-auto pt-4 border-t border-slate-50 flex justify-between items-center'}`}>
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border ${getStatusColor(doc.status)}`}>
                            {doc.status === 'PendingSync' ? 'Offline' : doc.status}
                        </span>
                        
                        {viewMode === 'GALLERY' && (
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={(e) => { e.stopPropagation(); onDeleteInvoice(doc.id); }} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-slate-200 rounded-[3rem] bg-slate-50/50">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm">
                <FileText className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-[#1c2938] mb-2">No se encontraron documentos</h3>
            <p className="text-slate-400 max-w-xs mx-auto mb-8">
                {searchTerm ? `No hay resultados para "${searchTerm}"` : 'Empieza creando tu primer documento.'}
            </p>
            {!searchTerm && (
                <button onClick={onCreateNew} className="text-[#27bea5] font-bold hover:underline">
                    Crear Nuevo
                </button>
            )}
        </div>
      )}
    </div>
  );
};

export default DocumentList;
