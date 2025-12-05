
import React, { useState, useMemo } from 'react';
import { 
  Search, Users, Wallet, Activity, LayoutList, LayoutGrid, 
  Plus, Crown, Sparkles, TrendingUp, Target, 
  Trophy, Percent, ArrowUpRight, BarChart3, Star
} from 'lucide-react';
import { Invoice } from '../types';

interface ClientListProps {
  invoices: Invoice[];
  onSelectClient?: (clientName: string) => void;
  onCreateDocument: () => void;
  currencySymbol: string;
}

// Extended Client Interface
interface AggregatedClient {
  name: string;
  taxId: string;
  totalRevenue: number;
  invoiceCount: number;
  quoteCount: number;
  quotesWon: number; // New for ROI
  lastInteraction: Date;
  status: 'CLIENT' | 'PROSPECT';
  avgTicket: number;
  isVip: boolean; // New logic
  winRate: number; // ROI Metric 1
}

const ClientList: React.FC<ClientListProps> = ({ invoices, onSelectClient, onCreateDocument, currencySymbol }) => {
  const [viewMode, setViewMode] = useState<'LIST' | 'GALLERY'>('GALLERY');
  const [filter, setFilter] = useState<'ALL' | 'CLIENT' | 'PROSPECT' | 'VIP'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // --- AGGREGATION LOGIC ---
  const { clients, stats } = useMemo(() => {
    const clientMap = new Map<string, AggregatedClient>();

    // 1. Accumulate Data
    invoices.forEach(inv => {
      const nameKey = inv.clientName.trim();
      
      if (!clientMap.has(nameKey)) {
        clientMap.set(nameKey, {
          name: nameKey,
          taxId: inv.clientTaxId || 'N/A',
          totalRevenue: 0,
          invoiceCount: 0,
          quoteCount: 0,
          quotesWon: 0,
          lastInteraction: new Date(0),
          status: 'PROSPECT',
          avgTicket: 0,
          isVip: false,
          winRate: 0
        });
      }

      const client = clientMap.get(nameKey)!;
      const invDate = new Date(inv.date);

      if (invDate > client.lastInteraction) client.lastInteraction = invDate;

      if (inv.type === 'Invoice') {
        client.invoiceCount++;
        if (inv.status === 'Aceptada') {
          client.totalRevenue += inv.total;
          client.status = 'CLIENT';
        }
      } else if (inv.type === 'Quote') {
        client.quoteCount++;
        if (inv.status === 'Aceptada') {
             client.status = 'CLIENT';
             client.quotesWon++;
        }
      }
    });

    // 2. Calculate Derived Metrics & VIP Threshold
    const allClients = Array.from(clientMap.values());
    
    // Sort by revenue to find VIPs (Top 20%)
    const sortedByRevenue = [...allClients].sort((a, b) => b.totalRevenue - a.totalRevenue);
    const vipCount = Math.ceil(allClients.length * 0.2); // Top 20%
    const vipThreshold = sortedByRevenue[vipCount - 1]?.totalRevenue || 0;

    const processedClients = allClients.map(c => {
      const totalDocs = c.invoiceCount + c.quoteCount;
      const avgTicket = c.invoiceCount > 0 ? c.totalRevenue / c.invoiceCount : 0;
      const winRate = c.quoteCount > 0 ? (c.quotesWon / c.quoteCount) * 100 : 0;
      
      // VIP Logic: Must be a Client AND in top 20% revenue AND have > 0 revenue
      const isVip = c.status === 'CLIENT' && c.totalRevenue > 0 && c.totalRevenue >= vipThreshold;

      return { ...c, avgTicket, winRate, isVip };
    });

    // 3. Global Stats for Dashboard
    const totalPortfolioValue = processedClients.reduce((acc, c) => acc + c.totalRevenue, 0);
    const totalActiveClients = processedClients.filter(c => c.status === 'CLIENT').length;
    const avgGlobalTicket = totalActiveClients > 0 ? totalPortfolioValue / totalActiveClients : 0;
    
    // Global Win Rate
    const totalQuotes = processedClients.reduce((acc, c) => acc + c.quoteCount, 0);
    const totalWon = processedClients.reduce((acc, c) => acc + c.quotesWon, 0);
    const globalWinRate = totalQuotes > 0 ? (totalWon / totalQuotes) * 100 : 0;

    return { 
      clients: processedClients, 
      stats: { totalPortfolioValue, totalActiveClients, avgGlobalTicket, globalWinRate } 
    };

  }, [invoices]);

  // --- FILTERING ---
  const filteredClients = clients.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.taxId.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesType = true;
    if (filter === 'CLIENT') matchesType = c.status === 'CLIENT';
    if (filter === 'PROSPECT') matchesType = c.status === 'PROSPECT';
    if (filter === 'VIP') matchesType = c.isVip;

    return matchesSearch && matchesType;
  }).sort((a, b) => {
    // Sort VIPs first, then by revenue
    if (a.isVip && !b.isVip) return -1;
    if (!a.isVip && b.isVip) return 1;
    return b.totalRevenue - a.totalRevenue;
  });

  // Helpers
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const getRandomColor = (name: string) => {
    const colors = ['bg-rose-100 text-rose-600', 'bg-blue-100 text-blue-600', 'bg-teal-100 text-teal-600', 'bg-indigo-100 text-indigo-600'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  // --- RENDERERS ---

  const renderGallery = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
       {filteredClients.map((client) => (
         <div 
           key={client.name} 
           className={`rounded-[2rem] p-6 border shadow-sm hover:shadow-xl transition-all duration-300 group relative flex flex-col justify-between h-[340px] ${
             client.isVip 
               ? 'bg-gradient-to-br from-amber-50/50 to-white border-amber-100 hover:border-amber-300' 
               : 'bg-white border-slate-50 hover:border-[#27bea5]/30'
           }`}
         >
            {/* Top Badge */}
            <div className="flex justify-between items-start mb-4">
               <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold shadow-sm ${
                 client.isVip ? 'bg-amber-100 text-amber-700' : getRandomColor(client.name)
               }`}>
                  {client.isVip ? <Crown className="w-6 h-6 fill-amber-700" /> : getInitials(client.name)}
               </div>
               
               <div className="flex flex-col items-end gap-1">
                 {client.isVip && (
                   <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border border-amber-200">
                     <Star className="w-3 h-3 fill-amber-800" /> VIP
                   </span>
                 )}
                 {client.status === 'PROSPECT' && (
                   <span className="bg-purple-50 text-purple-600 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border border-purple-100">
                     <Sparkles className="w-3 h-3" /> Prospecto
                   </span>
                 )}
               </div>
            </div>

            <div className="flex-1">
               <h3 className="text-xl font-bold text-[#1c2938] leading-tight line-clamp-2 mb-1 group-hover:text-[#27bea5] transition-colors">{client.name}</h3>
               <p className="text-xs text-slate-400 font-mono mb-4">{client.taxId}</p>
               
               {/* Client ROI / Stats */}
               <div className="space-y-3">
                 <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400 font-medium">Facturado Total</span>
                    <span className="font-bold text-[#1c2938]">{currencySymbol} {client.totalRevenue.toLocaleString()}</span>
                 </div>
                 
                 {/* Win Rate Bar */}
                 {client.quoteCount > 0 && (
                   <div>
                     <div className="flex justify-between items-end mb-1">
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tasa de Cierre</span>
                       <span className={`text-xs font-bold ${client.winRate >= 50 ? 'text-green-600' : 'text-slate-500'}`}>
                         {client.winRate.toFixed(0)}%
                       </span>
                     </div>
                     <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${client.winRate >= 50 ? 'bg-green-500' : 'bg-slate-400'}`} 
                          style={{ width: `${client.winRate}%` }}
                        ></div>
                     </div>
                   </div>
                 )}
               </div>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-slate-100/50 flex justify-between items-center mt-4">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Ticket Prom.</span>
                  <span className="text-sm font-bold text-slate-600">{currencySymbol} {client.avgTicket.toLocaleString()}</span>
                </div>
                
                <button 
                  onClick={() => onCreateDocument()}
                  className={`p-2.5 rounded-xl transition-colors shadow-sm ${
                    client.isVip ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-slate-50 text-slate-600 hover:bg-[#1c2938] hover:text-white'
                  }`}
                  title="Nueva Venta"
                >
                  <Plus className="w-4 h-4" />
                </button>
            </div>
         </div>
       ))}
    </div>
  );

  const renderList = () => (
    <div className="space-y-3">
       <div className="hidden md:grid grid-cols-12 px-8 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
          <div className="col-span-4">Cliente</div>
          <div className="col-span-2">Categoría</div>
          <div className="col-span-2 text-right">LTV (Total)</div>
          <div className="col-span-2 text-center">Eficiencia (ROI)</div>
          <div className="col-span-2"></div>
       </div>

       {filteredClients.map((client) => (
          <div key={client.name} className={`group rounded-3xl p-4 md:px-8 md:py-4 border shadow-sm hover:shadow-md transition-all duration-200 flex flex-col md:grid md:grid-cols-12 items-center gap-4 md:gap-0 ${client.isVip ? 'bg-amber-50/30 border-amber-100 hover:border-amber-300' : 'bg-white border-slate-50 hover:border-[#27bea5]/20'}`}>
             
             {/* Name & Avatar */}
             <div className="col-span-4 w-full flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${client.isVip ? 'bg-amber-100 text-amber-700' : getRandomColor(client.name)}`}>
                   {client.isVip ? <Crown className="w-4 h-4" /> : getInitials(client.name)}
                </div>
                <div>
                   <p className={`font-bold ${client.isVip ? 'text-amber-900' : 'text-[#1c2938]'}`}>{client.name}</p>
                   <p className="text-xs text-slate-400 font-mono">{client.taxId}</p>
                </div>
             </div>

             {/* Badge */}
             <div className="col-span-2 w-full">
               {client.isVip ? (
                 <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border border-amber-200">
                   <Star className="w-3 h-3 fill-current" /> VIP
                 </span>
               ) : client.status === 'CLIENT' ? (
                 <span className="inline-flex items-center gap-1.5 bg-[#27bea5]/10 text-[#27bea5] px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border border-[#27bea5]/20">
                   <Users className="w-3 h-3" /> Cliente
                 </span>
               ) : (
                 <span className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-600 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border border-purple-100">
                   <Sparkles className="w-3 h-3" /> Prospecto
                 </span>
               )}
             </div>

             {/* Revenue */}
             <div className="col-span-2 w-full text-left md:text-right">
                <span className={`font-bold text-base ${client.totalRevenue > 0 ? 'text-[#1c2938]' : 'text-slate-300'}`}>
                   {currencySymbol} {client.totalRevenue.toLocaleString()}
                </span>
             </div>

             {/* ROI / Efficiency */}
             <div className="col-span-2 w-full text-left md:text-center flex flex-col items-center justify-center">
                {client.quoteCount > 0 ? (
                  <div className="flex items-center gap-2">
                     <div className={`text-xs font-bold ${client.winRate > 50 ? 'text-green-600' : 'text-slate-500'}`}>
                        {client.winRate.toFixed(0)}% Cierre
                     </div>
                  </div>
                ) : (
                  <span className="text-xs text-slate-300">-</span>
                )}
             </div>

             {/* Actions */}
             <div className="col-span-2 w-full flex md:justify-end">
                <button 
                  onClick={() => onCreateDocument()}
                  className="px-4 py-2 bg-slate-50 hover:bg-[#1c2938] hover:text-white text-slate-600 rounded-xl text-xs font-bold transition-colors shadow-sm"
                >
                  Nueva Venta
                </button>
             </div>
          </div>
       ))}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in pb-12">
       
       {/* DASHBOARD HEADER (BENTO GRID STYLE) */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: Portfolio Value */}
          <div className="bg-[#1c2938] rounded-[2.5rem] p-8 text-white relative overflow-hidden group shadow-lg">
             <div className="absolute top-0 right-0 w-40 h-40 bg-[#27bea5] rounded-full blur-[60px] opacity-10 group-hover:opacity-20 transition-opacity"></div>
             <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                   <div className="p-3 bg-white/10 rounded-2xl text-[#27bea5]">
                      <Wallet className="w-6 h-6" />
                   </div>
                   <p className="text-sm font-bold text-slate-300 uppercase tracking-widest">Valor de Cartera</p>
                </div>
                <h2 className="text-4xl font-bold tracking-tight">{currencySymbol} {stats.totalPortfolioValue.toLocaleString()}</h2>
                <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                   <Users className="w-4 h-4" />
                   <span>{stats.totalActiveClients} Clientes activos contribuyendo</span>
                </div>
             </div>
          </div>

          {/* Card 2: Sales ROI (Win Rate) */}
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-50 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-full blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity"></div>
             <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                   <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
                      <Target className="w-6 h-6" />
                   </div>
                   <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Tasa de Cierre</p>
                </div>
                <div className="flex items-baseline gap-2">
                   <h2 className="text-4xl font-bold text-[#1c2938]">{stats.globalWinRate.toFixed(1)}%</h2>
                   <span className="text-sm font-medium text-slate-400">éxito</span>
                </div>
                <p className="mt-4 text-xs text-slate-500 font-medium leading-relaxed">
                   De cada 10 cotizaciones, cierras {Math.round(stats.globalWinRate / 10)}. <br/>
                   <span className="text-purple-600 font-bold">ROI Comercial Global.</span>
                </p>
             </div>
          </div>

          {/* Card 3: Avg Ticket (Efficiency) */}
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-50 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
             <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                   <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                      <BarChart3 className="w-6 h-6" />
                   </div>
                   <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Ticket Promedio</p>
                </div>
                <h2 className="text-4xl font-bold text-[#1c2938]">{currencySymbol} {stats.avgGlobalTicket.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h2>
                <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-bold uppercase tracking-wide">
                   <Trophy className="w-3 h-3" /> Eficiencia
                </div>
             </div>
          </div>
       </div>

       {/* TOOLBAR */}
       <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-2 rounded-[2rem] border border-slate-50 shadow-sm">
          {/* Filters */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full md:w-auto">
             {(['ALL', 'VIP', 'CLIENT', 'PROSPECT'] as const).map(f => (
               <button 
                 key={f}
                 onClick={() => setFilter(f)}
                 className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all duration-300 ${
                   filter === f 
                     ? f === 'VIP' ? 'bg-white text-amber-600 shadow-sm' 
                     : 'bg-white text-[#1c2938] shadow-sm'
                     : 'text-slate-400 hover:text-slate-600'
                 }`}
               >
                 {f === 'ALL' ? 'Todos' : f === 'VIP' ? 'VIP' : f === 'CLIENT' ? 'Clientes' : 'Prospectos'}
               </button>
             ))}
          </div>

          {/* Search */}
          <div className="flex-1 relative group w-full">
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-[#27bea5] transition-colors" />
            <input 
              type="text" 
              placeholder="Buscar cliente..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-full pl-12 pr-6 py-3 bg-transparent border-none rounded-2xl text-sm font-medium text-[#1c2938] focus:bg-slate-50 focus:ring-0 placeholder:text-slate-300 transition-all outline-none"
            />
          </div>

          {/* View Mode */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl">
              <button 
                onClick={() => setViewMode('LIST')}
                className={`p-2.5 rounded-xl transition-all ${viewMode === 'LIST' ? 'bg-[#1c2938] text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <LayoutList className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setViewMode('GALLERY')}
                className={`p-2.5 rounded-xl transition-all ${viewMode === 'GALLERY' ? 'bg-[#1c2938] text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <LayoutGrid className="w-5 h-5" />
              </button>
           </div>
       </div>

      {/* LIST CONTENT */}
      {filteredClients.length > 0 ? (
         viewMode === 'GALLERY' ? renderGallery() : renderList()
      ) : (
         <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-[3rem] bg-slate-50/50">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
               <Users className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-[#1c2938]">Sin resultados</h3>
            <p className="text-slate-400">Intenta ajustar los filtros o crea una nueva venta.</p>
         </div>
      )}

    </div>
  );
};

export default ClientList;
