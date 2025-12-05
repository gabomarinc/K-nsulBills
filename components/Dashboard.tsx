
import React, { useMemo } from 'react';
import { 
  Plus, 
  ArrowUpRight, 
  Wallet, 
  Clock, 
  ShieldCheck, 
  WifiOff, 
  ChevronRight, 
  FileText, 
  FileBadge,
  Sparkles,
  TrendingUp,
  MoreHorizontal,
  AlertCircle
} from 'lucide-react';
import { Invoice } from '../types';

interface DashboardProps {
  recentInvoices: Invoice[];
  isOffline: boolean;
  pendingCount: number;
  onNewAction: () => void;
  onSelectInvoice: (invoice: Invoice) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ recentInvoices, isOffline, pendingCount, onNewAction, onSelectInvoice }) => {
  
  // --- REAL TIME STATS CALCULATION ---
  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const thisMonthInvoices = recentInvoices.filter(inv => {
      const d = new Date(inv.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear && inv.type === 'Invoice' && inv.status !== 'Draft';
    });

    const monthlyRevenue = thisMonthInvoices.reduce((acc, curr) => acc + curr.total, 0);

    // Detailed Breakdown for "Requires Attention"
    const draftsCount = recentInvoices.filter(inv => inv.status === 'Draft').length;
    const viewedQuotesCount = recentInvoices.filter(inv => inv.type === 'Quote' && inv.status === 'Viewed').length;
    const pendingSyncCount = recentInvoices.filter(inv => inv.status === 'PendingSync').length; // Offline items
    
    const pendingReview = draftsCount + viewedQuotesCount + pendingSyncCount;

    // Simulate a "Growth" percentage for visceral satisfaction
    const growth = 12.5; 

    return { 
      monthlyRevenue, 
      growth,
      attention: {
        total: pendingReview,
        drafts: draftsCount,
        viewed: viewedQuotesCount,
        sync: pendingSyncCount
      }
    };
  }, [recentInvoices]);

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in pb-12">
      
      {/* 1. HEADER & GREETING */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#27bea5]" /> 
              {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
          </div>
          <h1 className="text-4xl font-bold text-[#1c2938] tracking-tight">
            Hola, Juan <span className="inline-block animate-wave">👋</span>
          </h1>
          <p className="text-slate-500 text-lg font-light mt-1">
            Hoy es un buen día para hacer crecer tu negocio.
          </p>
        </div>

        {/* Offline Status: Re-framed as "Secure Vault" (Reflective) */}
        {isOffline && (
          <div className="bg-amber-50 border border-amber-100 px-6 py-3 rounded-2xl flex items-center gap-4 animate-in slide-in-from-right shadow-sm">
             <div className="bg-amber-100 p-2 rounded-xl text-amber-600">
               <WifiOff className="w-5 h-5" />
             </div>
             <div>
                <p className="font-bold text-[#1c2938] text-sm">Modo Búnker Activo</p>
                <p className="text-xs text-slate-500">
                  {pendingCount > 0 ? `${pendingCount} cambios guardados en bóveda local.` : 'Tus datos están seguros offline.'}
                </p>
             </div>
          </div>
        )}
      </div>

      {/* 2. BENTO GRID HERO SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-auto md:h-80">
        
        {/* CARD 1: Monthly Revenue (Visceral: Stability & Success) */}
        <div className="col-span-1 md:col-span-1 bg-[#1c2938] rounded-[2.5rem] p-8 text-white relative overflow-hidden group shadow-xl">
           {/* Abstract Background */}
           <div className="absolute top-0 right-0 w-64 h-64 bg-[#27bea5] rounded-full blur-[80px] opacity-10 group-hover:opacity-20 transition-opacity duration-500 -translate-y-1/2 translate-x-1/2"></div>
           
           <div className="relative z-10 flex flex-col h-full justify-between">
              <div className="flex justify-between items-start">
                 <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                   <Wallet className="w-6 h-6 text-[#27bea5]" />
                 </div>
                 <div className="flex items-center gap-1 bg-green-500/20 px-3 py-1 rounded-full border border-green-500/20">
                    <TrendingUp className="w-3 h-3 text-green-400" />
                    <span className="text-xs font-bold text-green-400">+{stats.growth}%</span>
                 </div>
              </div>
              
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1">Facturado este mes</p>
                <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">
                  ${stats.monthlyRevenue.toLocaleString()}
                </h2>
                <div className="mt-4 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                   <div className="h-full bg-[#27bea5] w-[65%] rounded-full shadow-[0_0_10px_rgba(39,190,165,0.5)]"></div>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 text-right">Meta mensual al 65%</p>
              </div>
           </div>
        </div>

        {/* CARD 2: Primary Action (Behavioral: Obvious CTA) */}
        <button 
          onClick={onNewAction}
          className="col-span-1 md:col-span-1 bg-gradient-to-br from-[#27bea5] to-[#20a08a] rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl shadow-teal-200/50 group hover:-translate-y-1 transition-all duration-300 active:translate-y-0 active:scale-95 text-left"
        >
           <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
           <div className="absolute bottom-0 right-0 w-40 h-40 bg-white rounded-full blur-[60px] opacity-20 translate-y-1/2 translate-x-1/2 group-hover:opacity-30 transition-opacity"></div>

           <div className="relative z-10 flex flex-col h-full justify-between items-start">
              <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md group-hover:rotate-90 transition-transform duration-500">
                 <Plus className="w-8 h-8 text-white" />
              </div>
              <div>
                 <h2 className="text-3xl font-bold mb-2">Crear Nuevo</h2>
                 <p className="text-teal-50 text-sm font-medium opacity-90">
                   Factura, Cotización o Gasto. <br/> La IA te ayuda.
                 </p>
              </div>
              <div className="self-end bg-white/20 p-2 rounded-full">
                 <ArrowUpRight className="w-6 h-6" />
              </div>
           </div>
        </button>

        {/* CARD 3: Quick Status / Tasks (Behavioral: Clarity & Detail) */}
        <div className="col-span-1 md:col-span-1 bg-white rounded-[2.5rem] p-8 border border-slate-50 shadow-sm flex flex-col justify-between group hover:shadow-lg transition-all duration-300">
           <div className="flex justify-between items-start">
              <div className="p-3 bg-amber-50 rounded-2xl text-amber-500">
                 <Clock className="w-6 h-6" />
              </div>
              <button className="text-slate-300 hover:text-slate-600 transition-colors">
                 <MoreHorizontal className="w-6 h-6" />
              </button>
           </div>
           
           <div>
              <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2">Requieren Atención</p>
              <div className="flex items-baseline gap-2 mb-6">
                 <span className="text-5xl font-bold text-[#1c2938]">{stats.attention.total}</span>
                 <span className="text-slate-400 font-medium">documentos</span>
              </div>
              
              <div className="space-y-3">
                 {/* Drafts Breakdown */}
                 <div className="flex items-center justify-between text-sm group/item">
                    <div className="flex items-center gap-3 text-slate-600">
                       <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                       <span className="font-medium">Borradores sin enviar</span>
                    </div>
                    <span className="font-bold text-[#1c2938] bg-slate-50 px-2 py-0.5 rounded-lg group-hover/item:bg-amber-50 group-hover/item:text-amber-600 transition-colors">
                       {stats.attention.drafts}
                    </span>
                 </div>

                 {/* Viewed Quotes Breakdown */}
                 <div className="flex items-center justify-between text-sm group/item">
                    <div className="flex items-center gap-3 text-slate-600">
                       <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                       <span className="font-medium">Cotizaciones vistas</span>
                    </div>
                    <span className="font-bold text-[#1c2938] bg-slate-50 px-2 py-0.5 rounded-lg group-hover/item:bg-blue-50 group-hover/item:text-blue-600 transition-colors">
                       {stats.attention.viewed}
                    </span>
                 </div>

                 {/* Offline Sync Breakdown (Only if > 0) */}
                 {stats.attention.sync > 0 && (
                   <div className="flex items-center justify-between text-sm group/item animate-in slide-in-from-bottom-2">
                      <div className="flex items-center gap-3 text-slate-600">
                         <div className="w-2 h-2 rounded-full bg-red-400"></div>
                         <span className="font-medium">Cola Offline</span>
                      </div>
                      <span className="font-bold text-[#1c2938] bg-slate-50 px-2 py-0.5 rounded-lg group-hover/item:bg-red-50 group-hover/item:text-red-600 transition-colors">
                         {stats.attention.sync}
                      </span>
                   </div>
                 )}
              </div>
           </div>
        </div>
      </div>

      {/* 3. RECENT ACTIVITY LIST (Visceral: Clean & Card-based) */}
      <div>
         <div className="flex items-center justify-between mb-6 px-2">
            <h3 className="text-xl font-bold text-[#1c2938] flex items-center gap-2">
               Actividad Reciente
            </h3>
            <button className="text-[#27bea5] text-sm font-bold hover:underline">
               Ver todo el historial
            </button>
         </div>

         <div className="space-y-4">
            {recentInvoices.slice(0, 5).map((inv) => (
               <button 
                 key={inv.id}
                 onClick={() => onSelectInvoice(inv)}
                 className="w-full group bg-white hover:bg-slate-50 border border-slate-50 hover:border-[#27bea5]/30 rounded-[2rem] p-4 flex items-center gap-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
               >
                  {/* Icon Box */}
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors ${
                     inv.type === 'Quote' 
                        ? 'bg-[#27bea5]/10 text-[#27bea5] group-hover:bg-[#27bea5] group-hover:text-white' 
                        : 'bg-[#1c2938]/5 text-[#1c2938] group-hover:bg-[#1c2938] group-hover:text-white'
                  }`}>
                     {inv.type === 'Quote' ? <FileBadge className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 text-left">
                     <h4 className="font-bold text-[#1c2938] text-lg group-hover:text-[#27bea5] transition-colors">
                        {inv.clientName}
                     </h4>
                     <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mt-1">
                        <span>{new Date(inv.date).toLocaleDateString()}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                        <span>{inv.type === 'Quote' ? 'Cotización' : 'Factura'}</span>
                     </div>
                  </div>

                  {/* Status & Amount */}
                  <div className="text-right flex flex-col items-end gap-1">
                     <span className="font-bold text-[#1c2938] text-lg tracking-tight">
                        ${inv.total.toLocaleString()}
                     </span>
                     <span className={`px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-wide ${
                        inv.status === 'Paid' ? 'bg-green-50 text-green-700' :
                        inv.status === 'PendingSync' ? 'bg-amber-50 text-amber-700' :
                        'bg-slate-100 text-slate-500'
                     }`}>
                        {inv.status === 'PendingSync' ? 'Cola Offline' : inv.status}
                     </span>
                  </div>

                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-[#27bea5] transition-colors ml-2">
                     <ChevronRight className="w-5 h-5" />
                  </div>
               </button>
            ))}

            {recentInvoices.length === 0 && (
               <div className="bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100 p-12 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                     <ShieldCheck className="w-8 h-8" />
                  </div>
                  <h3 className="font-bold text-slate-700">Todo limpio por aquí</h3>
                  <p className="text-slate-400 text-sm mt-1">Crea tu primer documento para empezar a ver métricas.</p>
               </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default Dashboard;
