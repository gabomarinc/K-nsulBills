
import React, { useState } from 'react';
import { 
  Search, Plus, FileText, CheckCircle2, 
  Clock, TrendingUp, ChevronRight,
  ArrowUpRight, PieChart, Filter, CalendarDays, Wallet,
  FileBadge, LayoutList, LayoutGrid
} from 'lucide-react';
import { Invoice } from '../types';

interface DocumentListProps {
  invoices: Invoice[];
  onSelectInvoice: (invoice: Invoice) => void;
  onCreateNew: () => void;
  currencySymbol: string;
}

const DocumentList: React.FC<DocumentListProps> = ({ invoices, onSelectInvoice, onCreateNew, currencySymbol }) => {
  const [filterType, setFilterType] = useState<'ALL' | 'INVOICE' | 'QUOTE'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // --- STATS CALCULATION ---
  const totalPaid = invoices
    .filter(i => i.type === 'Invoice' && i.status === 'Paid')
    .reduce((acc, curr) => acc + curr.total, 0);

  const totalPending = invoices
    .filter(i => i.type === 'Invoice' && (i.status === 'Sent' || i.status === 'Viewed'))
    .reduce((acc, curr) => acc + curr.total, 0);

  const totalPipeline = invoices
    .filter(i => i.type === 'Quote')
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
    return matchesSearch && matchesType;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in pb-12">
      
      {/* HEADER: Visceral - Warm & Professional */}
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1c2938] tracking-tight">Tu Archivo Comercial</h1>
          <p className="text-slate-500 mt-1 text-lg font-light">Gestiona tu historia de éxito, documento a documento.</p>
        </div>
        <button 
          onClick={onCreateNew}
          className="bg-[#1c2938] text-white px-8 py-3.5 rounded-2xl font-bold hover:bg-[#27bea5] transition-all duration-300 flex items-center gap-2 shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 group"
        >
          <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
          <span>Crear Nuevo</span>
        </button>
      </div>

      {/* KPI SECTION: Reflective - "My Progress" */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card 1: Success (Paid) */}
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

        {/* Card 2: Pending (Action) */}
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
              <p className="text-xs text-amber-600 font-medium mt-1">Requiere seguimiento</p>
           </div>
        </div>

        {/* Card 3: Pipeline (Opportunity) */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 relative overflow-hidden group hover:shadow-md transition-all duration-300">
           <div className="absolute top-0 right-0 w-24 h-24 bg-[#27bea5]/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-[#27bea5]/20 transition-colors"></div>
           <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                 <div className="p-2.5 bg-[#27bea5]/10 text-[#27bea5] rounded-xl">
                   <TrendingUp className="w-6 h-6" />
                 </div>
              </div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Oportunidades (Cotizado)</p>
              <h3 className="text-2xl font-bold text-[#1c2938] mt-1 tracking-tight">{currencySymbol} {totalPipeline.toLocaleString()}</h3>
           </div>
        </div>

        {/* Card 4: Health (Identity) */}
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

      {/* CONTROL CENTER: Behavioral - Smooth Filtering */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-50 overflow-hidden flex flex-col md:flex-row p-2 gap-4">
        
        {/* Visual Tabs */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl md:w-auto w-full">
           <button 
             onClick={() => setFilterType('ALL')}
             className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${filterType === 'ALL' ? 'bg-white text-[#1c2938] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
           >
             <LayoutGrid className="w-4 h-4" /> Todos
           </button>
           <button 
             onClick={() => setFilterType('INVOICE')}
             className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${filterType === 'INVOICE' ? 'bg-white text-[#1c2938] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
           >
             <FileText className="w-4 h-4" /> Facturas
           </button>
           <button 
             onClick={() => setFilterType('QUOTE')}
             className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${filterType === 'QUOTE' ? 'bg-white text-[#1c2938] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
           >
             <FileBadge className="w-4 h-4" /> Cotizaciones
           </button>
        </div>

        {/* Search Bar - Floating Feel */}
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

      {/* DOCUMENT LIST: Visceral - Card Based Rows */}
      <div className="space-y-4">
        {/* Subtle Header */}
        <div className="hidden md:grid grid-cols-12 px-8 text-xs font-bold text-slate-400 uppercase tracking-wider">
           <div className="col-span-4">Cliente / Documento</div>
           <div className="col-span-3">Fecha</div>
           <div className="col-span-2 text-right">Monto</div>
           <div className="col-span-2 text-center">Estado</div>
           <div className="col-span-1"></div>
        </div>

        {filteredDocs.length > 0 ? (
          filteredDocs.map((doc) => (
            <div 
              key={doc.id}
              onClick={() => onSelectInvoice(doc)} 
              className="group bg-white rounded-3xl p-4 md:px-8 md:py-5 border border-slate-50 shadow-sm hover:shadow-lg hover:border-[#27bea5]/20 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer flex flex-col md:grid md:grid-cols-12 items-center gap-4 md:gap-0 relative overflow-hidden"
            >
              {/* Highlight Bar */}
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${doc.type === 'Quote' ? 'bg-[#27bea5]' : 'bg-[#1c2938]'}`}></div>

              {/* Col 1: Identity */}
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

              {/* Col 2: Date */}
              <div className="col-span-3 w-full flex items-center gap-2 text-sm text-slate-500 font-medium md:pl-2">
                 <CalendarDays className="w-4 h-4 text-slate-300" />
                 {new Date(doc.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>

              {/* Col 3: Amount */}
              <div className="col-span-2 w-full text-left md:text-right">
                <span className="font-bold text-[#1c2938] text-lg tracking-tight">{doc.currency} {doc.total.toLocaleString()}</span>
              </div>

              {/* Col 4: Status */}
              <div className="col-span-2 w-full flex md:justify-center">
                <span className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                  doc.status === 'Paid' ? 'bg-green-50 text-green-700 border-green-100 group-hover:bg-green-100' :
                  doc.status === 'Sent' ? 'bg-blue-50 text-blue-700 border-blue-100 group-hover:bg-blue-100' :
                  doc.status === 'PendingSync' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                  'bg-slate-50 text-slate-500 border-slate-100'
                }`}>
                  {doc.status === 'PendingSync' ? 'Cola Offline' : doc.status === 'Paid' ? 'Cobrado' : doc.status}
                </span>
              </div>

              {/* Col 5: Action */}
              <div className="col-span-1 hidden md:flex justify-end opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                 <div className="w-10 h-10 rounded-full bg-slate-50 text-[#1c2938] flex items-center justify-center hover:bg-[#27bea5] hover:text-white transition-colors">
                   <ChevronRight className="w-5 h-5" />
                 </div>
              </div>
            </div>
          ))
        ) : (
          /* Empty State - Reflective: Encouraging */
          <div className="py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
              <Filter className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-[#1c2938] mb-2">Tu lienzo está en blanco</h3>
            <p className="text-slate-500 max-w-sm mx-auto mb-8 font-light">
              No encontramos documentos con estos filtros. Es el momento perfecto para crear una nueva oportunidad.
            </p>
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="text-[#27bea5] font-bold hover:underline mb-4 block"
              >
                Limpiar búsqueda
              </button>
            )}
            <button 
              onClick={onCreateNew}
              className="bg-[#1c2938] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#27bea5] transition-all flex items-center gap-2 shadow-lg"
            >
               <Plus className="w-4 h-4" /> Crear Documento
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentList;
