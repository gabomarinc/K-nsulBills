
import React, { useMemo, useState } from 'react';
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
  AlertCircle,
  Users,
  BarChart3,
  Hourglass,
  Target,
  ArrowRight,
  Eye,
  CheckCircle2,
  XCircle,
  Ban,
  Archive
} from 'lucide-react';
import { Invoice, AppView, UserProfile } from '../types';

interface DashboardProps {
  recentInvoices: Invoice[];
  isOffline: boolean;
  pendingCount: number;
  onNewAction: () => void;
  onSelectInvoice: (invoice: Invoice) => void;
  onNavigate?: (view: AppView) => void; // Added for Mobile Nav
  currentUser: UserProfile;
}

const Dashboard: React.FC<DashboardProps> = ({ recentInvoices, isOffline, pendingCount, onNewAction, onSelectInvoice, onNavigate, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'INVOICES' | 'QUOTES'>('INVOICES');
  
  // --- REAL TIME STATS CALCULATION ---
  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // "Aceptada" OR "Pagada" counts as Revenue for Invoices
    const thisMonthInvoices = recentInvoices.filter(inv => {
      const d = new Date(inv.date);
      return d.getMonth() === currentMonth && 
             d.getFullYear() === currentYear && 
             inv.type === 'Invoice' && 
             (inv.status === 'Aceptada' || inv.status === 'Pagada');
    });

    const monthlyRevenue = thisMonthInvoices.reduce((acc, curr) => acc + curr.total, 0);

    // Pending (Sent but not Paid)
    const pendingAmount = recentInvoices
      .filter(inv => inv.type === 'Invoice' && (inv.status === 'Enviada' || inv.status === 'Seguimiento' || inv.status === 'Abonada' || inv.status === 'Creada'))
      .reduce((acc, curr) => acc + curr.total, 0);

    // Quotes
    const quotesCount = recentInvoices.filter(inv => inv.type === 'Quote').length;
    const quotesAmount = recentInvoices
      .filter(inv => inv.type === 'Quote')
      .reduce((acc, curr) => acc + curr.total, 0);

    // Active Clients
    const uniqueClients = new Set(recentInvoices.map(i => i.clientName)).size;

    // Growth calculation (Mock vs previous month or based on target)
    const monthlyTarget = currentUser.hourlyRateConfig?.targetIncome || 0;
    const progressPercent = monthlyTarget > 0 ? (monthlyRevenue / monthlyTarget) * 100 : 0;

    // --- DETAILED BREAKDOWN ---
    const invoiceStats = {
        drafts: recentInvoices.filter(i => i.type === 'Invoice' && i.status === 'Borrador').length,
        sent: recentInvoices.filter(i => i.type === 'Invoice' && i.status === 'Enviada').length,
        viewed: recentInvoices.filter(i => i.type === 'Invoice' && i.status === 'Seguimiento').length,
        partial: recentInvoices.filter(i => i.type === 'Invoice' && i.status === 'Abonada').length,
        paid: recentInvoices.filter(i => i.type === 'Invoice' && (i.status === 'Pagada' || i.status === 'Aceptada')).length,
        uncollectible: recentInvoices.filter(i => i.type === 'Invoice' && i.status === 'Incobrable').length,
        pendingSync: recentInvoices.filter(i => i.type === 'Invoice' && i.status === 'PendingSync').length
    };

    const quoteStats = {
        drafts: recentInvoices.filter(i => i.type === 'Quote' && i.status === 'Borrador').length,
        sent: recentInvoices.filter(i => i.type === 'Quote' && i.status === 'Enviada').length,
        viewed: recentInvoices.filter(i => i.type === 'Quote' && i.status === 'Seguimiento').length,
        negotiation: recentInvoices.filter(i => i.type === 'Quote' && i.status === 'Negociacion').length,
        accepted: recentInvoices.filter(i => i.type === 'Quote' && i.status === 'Aceptada').length,
        rejected: recentInvoices.filter(i => i.type === 'Quote' && i.status === 'Rechazada').length
    };

    return { 
      monthlyRevenue, 
      pendingAmount,
      quotesCount,
      quotesAmount,
      uniqueClients,
      monthlyTarget,
      progressPercent,
      invoiceStats,
      quoteStats
    };
  }, [recentInvoices, currentUser.hourlyRateConfig]);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Pagada': 
      case 'Aceptada': return 'bg-green-50 text-green-700';
      case 'Rechazada': 
      case 'Incobrable': return 'bg-red-50 text-red-700';
      case 'Negociacion': return 'bg-purple-50 text-purple-700';
      case 'Seguimiento': return 'bg-blue-50 text-blue-700';
      case 'Abonada': return 'bg-indigo-50 text-indigo-700';
      case 'Enviada': return 'bg-sky-50 text-sky-700';
      case 'PendingSync': return 'bg-amber-50 text-amber-700';
      default: return 'bg-slate-100 text-slate-500'; // Borrador, Creada
    }
  };

  // --- MOBILE LAYOUT ---
  const renderMobileLayout = () => (
    <div className="flex flex-col h-full pt-4 pb-24 px-4 space-y-8 animate-in fade-in">
       {/* Top: Income */}
       <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-1 text-slate-500 text-sm font-medium">
             <span>Ingresos este mes</span>
             <ChevronRight className="w-4 h-4 rotate-90" />
          </div>
          <h1 className="text-6xl font-black text-[#1c2938] tracking-tight">
             ${stats.monthlyRevenue.toLocaleString()}
          </h1>
          
          {/* Mobile Goal Progress */}
          {stats.monthlyTarget > 0 ? (
             <div className="flex justify-center items-center gap-2 pt-1">
                <div className="w-32 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                   <div className="h-full bg-[#27bea5]" style={{ width: `${Math.min(100, stats.progressPercent)}%` }}></div>
                </div>
                <span className="text-xs font-bold text-slate-400">{stats.progressPercent.toFixed(0)}%</span>
             </div>
          ) : (
             <button 
                onClick={() => onNavigate && onNavigate(AppView.EXPENSES)}
                className="text-xs font-bold text-[#27bea5] bg-[#27bea5]/10 px-3 py-1 rounded-full"
             >
                + Definir Meta
             </button>
          )}

          <div className="pt-4">
             <button 
               onClick={() => onNavigate && onNavigate(AppView.INVOICES)}
               className="bg-[#1c2938] text-white px-6 py-3 rounded-full text-sm font-bold shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2 mx-auto"
             >
                <FileText className="w-4 h-4" /> Ver facturas
             </button>
          </div>
       </div>

       {/* Grid: 2x2 Pastel Cards - Now Clickable Buttons */}
       <div className="grid grid-cols-2 gap-4">
          {/* Card 1: Revenue (Green) -> Invoices */}
          <button 
            onClick={() => onNavigate && onNavigate(AppView.INVOICES)}
            className="bg-[#ecfccb] p-5 rounded-[2rem] flex flex-col justify-between h-40 shadow-sm relative overflow-hidden text-left active:scale-95 transition-transform"
          >
             <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/30 rounded-full"></div>
             <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-[#1c2938] shadow-sm mb-2 relative z-10">
                <Wallet className="w-5 h-5" />
             </div>
             <div className="relative z-10">
                <p className="text-2xl font-black text-[#1c2938]">${stats.monthlyRevenue.toLocaleString()}</p>
                <p className="text-xs font-bold text-slate-700 mt-1">Facturas pagadas</p>
             </div>
          </button>

          {/* Card 2: Pending (Yellow) -> Invoices */}
          <button 
            onClick={() => onNavigate && onNavigate(AppView.INVOICES)}
            className="bg-[#fef9c3] p-5 rounded-[2rem] flex flex-col justify-between h-40 shadow-sm relative overflow-hidden text-left active:scale-95 transition-transform"
          >
             <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/30 rounded-full"></div>
             <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-[#1c2938] shadow-sm mb-2 relative z-10">
                <Hourglass className="w-5 h-5" />
             </div>
             <div className="relative z-10">
                <p className="text-2xl font-black text-[#1c2938]">${stats.pendingAmount.toLocaleString()}</p>
                <p className="text-xs font-bold text-slate-700 mt-1">Pendientes</p>
             </div>
          </button>

          {/* Card 3: Quotes (Blue) -> Invoices (Quotes view is part of invoice list usually) */}
          <button 
            onClick={() => onNavigate && onNavigate(AppView.INVOICES)}
            className="bg-[#dbeafe] p-5 rounded-[2rem] flex flex-col justify-between h-40 shadow-sm relative overflow-hidden text-left active:scale-95 transition-transform"
          >
             <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/30 rounded-full"></div>
             <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-[#1c2938] shadow-sm mb-2 relative z-10">
                <BarChart3 className="w-5 h-5" />
             </div>
             <div className="relative z-10">
                <p className="text-2xl font-black text-[#1c2938]">${stats.quotesAmount.toLocaleString()}</p>
                <p className="text-xs font-bold text-slate-700 mt-1">{stats.quotesCount} Cotizaciones</p>
             </div>
          </button>

          {/* Card 4: Clients (Purple) -> Clients */}
          <button 
            onClick={() => onNavigate && onNavigate(AppView.CLIENTS)}
            className="bg-[#f3e8ff] p-5 rounded-[2rem] flex flex-col justify-between h-40 shadow-sm relative overflow-hidden text-left active:scale-95 transition-transform"
          >
             <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/30 rounded-full"></div>
             <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-[#1c2938] shadow-sm mb-2 relative z-10">
                <Users className="w-5 h-5" />
             </div>
             <div className="relative z-10">
                <p className="text-2xl font-black text-[#1c2938]">{stats.uniqueClients}</p>
                <p className="text-xs font-bold text-slate-700 mt-1">Clientes activos</p>
             </div>
          </button>
       </div>

       {/* Bottom Button */}
       <div>
          <button 
            onClick={() => onNavigate && onNavigate(AppView.REPORTS)}
            className="w-full bg-white border border-slate-200 text-[#1c2938] py-4 rounded-2xl font-bold shadow-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 active:scale-95"
          >
             <BarChart3 className="w-5 h-5" /> Ver reportes completos
          </button>
       </div>
    </div>
  );

  return (
    <>
      {/* MOBILE VIEW */}
      <div className="md:hidden block h-full">
         {renderMobileLayout()}
      </div>

      {/* DESKTOP VIEW */}
      <div className="hidden md:block max-w-7xl mx-auto space-y-8 animate-in fade-in pb-12">
        
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
              Hola, {currentUser.name} <span className="inline-block animate-wave">👋</span>
            </h1>
            <p className="text-slate-500 text-lg font-light mt-1">
              Hoy es un buen día para hacer crecer tu negocio.
            </p>
          </div>

          {/* Offline Status */}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 h-auto lg:h-96">
          
          {/* CARD 1: Monthly Revenue (Dynamic Target) - HERO */}
          <div className="col-span-1 md:col-span-2 lg:col-span-2 bg-[#1c2938] rounded-[2.5rem] p-8 md:p-10 text-white relative overflow-hidden group shadow-2xl flex flex-col justify-between">
            {/* Abstract Background */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#27bea5] rounded-full blur-[100px] opacity-10 group-hover:opacity-20 transition-opacity duration-500 -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600 rounded-full blur-[80px] opacity-10 translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
            
            <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex justify-between items-start">
                  <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-md">
                    <Wallet className="w-8 h-8 text-[#27bea5]" />
                  </div>
                  {stats.monthlyTarget > 0 ? (
                    <div className="flex items-center gap-2 bg-green-500/20 px-4 py-2 rounded-full border border-green-500/20 backdrop-blur-sm">
                        <TrendingUp className="w-4 h-4 text-green-400" />
                        <span className="text-sm font-bold text-green-400">
                            {stats.progressPercent >= 100 ? '¡Meta Superada!' : 'En Camino'}
                        </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/10">
                        <Target className="w-4 h-4 text-slate-300" />
                        <span className="text-sm font-bold text-slate-300">Sin Meta Definida</span>
                    </div>
                  )}
                </div>
                
                <div className="mt-4">
                  <p className="text-slate-400 text-lg font-medium mb-1 flex items-center gap-2">
                    Facturado este mes
                    {stats.progressPercent > 0 && (
                        <span className="text-xs font-bold text-[#27bea5] bg-[#27bea5]/10 px-2 py-0.5 rounded-lg border border-[#27bea5]/20">
                            {stats.progressPercent.toFixed(0)}% Completado
                        </span>
                    )}
                  </p>
                  <h2 className="text-6xl lg:text-7xl font-black tracking-tighter text-white drop-shadow-sm">
                    ${stats.monthlyRevenue.toLocaleString()}
                  </h2>
                  
                  {/* Hero Progress Bar */}
                  <div className="mt-8 relative">
                    <div className="h-4 w-full bg-slate-800/50 rounded-full overflow-hidden border border-white/5">
                        <div 
                        className="h-full bg-gradient-to-r from-[#27bea5] to-teal-400 rounded-full shadow-[0_0_20px_rgba(39,190,165,0.6)] transition-all duration-1000 ease-out relative"
                        style={{ width: `${Math.min(100, Math.max(stats.monthlyTarget > 0 ? 5 : 0, stats.progressPercent))}%` }}
                        >
                            <div className="absolute inset-0 bg-white/20 animate-pulse-slow"></div>
                        </div>
                    </div>
                    {/* Tick marks or labels */}
                    {stats.monthlyTarget > 0 && (
                        <div className="flex justify-between mt-3 text-sm font-medium text-slate-400">
                            <span>$0</span>
                            <span className="text-slate-300">Meta: ${stats.monthlyTarget.toLocaleString()}</span>
                        </div>
                    )}
                  </div>
                  
                  {/* CTA if no goal */}
                  {stats.monthlyTarget <= 0 && (
                    <div className="mt-4">
                        <button 
                           onClick={() => onNavigate && onNavigate(AppView.EXPENSES)}
                           className="text-sm text-[#27bea5] font-bold hover:text-white hover:underline transition-colors flex items-center gap-1"
                        >
                           + Definir Meta Mensual para visualizar progreso
                        </button>
                    </div>
                  )}
                </div>
            </div>
          </div>

          {/* CARD 2: Primary Action */}
          <button 
            onClick={onNewAction}
            className="col-span-1 md:col-span-1 lg:col-span-1 bg-gradient-to-br from-[#27bea5] to-[#20a08a] rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl shadow-teal-200/50 group hover:-translate-y-1 transition-all duration-300 active:translate-y-0 active:scale-95 text-left h-full"
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

          {/* CARD 3: TABBED STATUS (Clean & Emotional) */}
          <div className="col-span-1 md:col-span-1 lg:col-span-1 bg-white rounded-[2.5rem] p-6 border border-slate-50 shadow-sm flex flex-col relative overflow-hidden h-full">
            
            {/* Tab Switcher */}
            <div className="flex justify-between items-center mb-6">
               <h3 className="text-sm font-bold text-[#1c2938] uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" /> Estado
               </h3>
               
               <div className="bg-slate-100 p-1 rounded-xl flex items-center relative">
                  <button 
                    onClick={() => setActiveTab('INVOICES')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 relative z-10 ${activeTab === 'INVOICES' ? 'text-[#1c2938] bg-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Facturas
                  </button>
                  <button 
                    onClick={() => setActiveTab('QUOTES')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 relative z-10 ${activeTab === 'QUOTES' ? 'text-[#1c2938] bg-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Cotizaciones
                  </button>
               </div>
            </div>

            {/* Content Area - Scrollable */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 -mr-2">
                
                {activeTab === 'INVOICES' && (
                   <div className="space-y-2 animate-in fade-in slide-in-from-right-8">
                      {/* Borradores */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                         <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-slate-200 text-slate-500 rounded-lg">
                               <FileText className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-bold text-slate-600">Borradores</span>
                         </div>
                         <span className="text-sm font-bold text-slate-600">{stats.invoiceStats.drafts}</span>
                      </div>

                      {/* Enviadas */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-blue-50 border border-blue-100">
                         <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                               <ArrowRight className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-bold text-[#1c2938]">Enviadas</span>
                         </div>
                         <span className="text-sm font-bold text-blue-600">{stats.invoiceStats.sent}</span>
                      </div>

                      {/* Vistas */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-sky-50 border border-sky-100">
                         <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-sky-100 text-sky-600 rounded-lg">
                               <Eye className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-bold text-[#1c2938]">Vistas</span>
                         </div>
                         <span className="text-sm font-bold text-sky-600">{stats.invoiceStats.viewed}</span>
                      </div>

                      {/* Parciales */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-indigo-50 border border-indigo-100">
                         <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                               <Wallet className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-bold text-[#1c2938]">Parciales</span>
                         </div>
                         <span className="text-sm font-bold text-indigo-600">{stats.invoiceStats.partial}</span>
                      </div>

                      {/* Pagadas */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-green-50 border border-green-100">
                         <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-green-100 text-green-600 rounded-lg">
                               <CheckCircle2 className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-bold text-[#1c2938]">Pagadas</span>
                         </div>
                         <span className="text-sm font-bold text-green-600">{stats.invoiceStats.paid}</span>
                      </div>

                      {/* Incobrables */}
                      {stats.invoiceStats.uncollectible > 0 && (
                        <div className="flex items-center justify-between p-2 rounded-xl bg-red-50 border border-red-100">
                           <div className="flex items-center gap-3">
                              <div className="p-1.5 bg-red-100 text-red-600 rounded-lg">
                                 <Ban className="w-4 h-4" />
                              </div>
                              <span className="text-sm font-bold text-[#1c2938]">Incobrables</span>
                           </div>
                           <span className="text-sm font-bold text-red-600">{stats.invoiceStats.uncollectible}</span>
                        </div>
                      )}
                   </div>
                )}

                {activeTab === 'QUOTES' && (
                   <div className="space-y-2 animate-in fade-in slide-in-from-right-8">
                      {/* Borradores */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                         <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-slate-200 text-slate-500 rounded-lg">
                               <Archive className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-bold text-slate-600">Borradores</span>
                         </div>
                         <span className="text-sm font-bold text-slate-600">{stats.quoteStats.drafts}</span>
                      </div>

                      {/* Enviadas */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-fuchsia-50 border border-fuchsia-100">
                         <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-fuchsia-100 text-fuchsia-600 rounded-lg">
                               <ArrowRight className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-bold text-[#1c2938]">Enviadas</span>
                         </div>
                         <span className="text-sm font-bold text-fuchsia-600">{stats.quoteStats.sent}</span>
                      </div>

                      {/* Vistas */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-sky-50 border border-sky-100">
                         <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-sky-100 text-sky-600 rounded-lg">
                               <Eye className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-bold text-[#1c2938]">Vistas</span>
                         </div>
                         <span className="text-sm font-bold text-sky-600">{stats.quoteStats.viewed}</span>
                      </div>

                      {/* Negociacion */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-purple-50 border border-purple-100">
                         <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-purple-100 text-purple-600 rounded-lg">
                               <MoreHorizontal className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-bold text-[#1c2938]">Negociación</span>
                         </div>
                         <span className="text-sm font-bold text-purple-600">{stats.quoteStats.negotiation}</span>
                      </div>

                      {/* Aceptadas */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-green-50 border border-green-100">
                         <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-green-100 text-green-600 rounded-lg">
                               <CheckCircle2 className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-bold text-[#1c2938]">Aceptadas</span>
                         </div>
                         <span className="text-sm font-bold text-green-600">{stats.quoteStats.accepted}</span>
                      </div>

                      {/* Rechazadas */}
                      {stats.quoteStats.rejected > 0 && (
                        <div className="flex items-center justify-between p-2 rounded-xl bg-red-50 border border-red-100">
                           <div className="flex items-center gap-3">
                              <div className="p-1.5 bg-red-100 text-red-600 rounded-lg">
                                 <XCircle className="w-4 h-4" />
                              </div>
                              <span className="text-sm font-bold text-[#1c2938]">Rechazadas</span>
                           </div>
                           <span className="text-sm font-bold text-red-600">{stats.quoteStats.rejected}</span>
                        </div>
                      )}
                   </div>
                )}
            </div>
          </div>
        </div>

        {/* 3. RECENT ACTIVITY LIST (Visceral: Clean & Card-based) */}
        <div>
          <div className="flex items-center justify-between mb-6 px-2">
              <h3 className="text-xl font-bold text-[#1c2938] flex items-center gap-2">
                Actividad Reciente
              </h3>
              <button 
                onClick={() => onNavigate && onNavigate(AppView.INVOICES)}
                className="text-[#27bea5] text-sm font-bold hover:underline"
              >
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
                      <span className={`px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-wide ${getStatusColor(inv.status)}`}>
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
    </>
  );
};

export default Dashboard;
