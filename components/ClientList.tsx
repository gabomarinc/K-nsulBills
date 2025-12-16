
import React, { useState, useMemo } from 'react';
import { 
  Search, Users, Wallet, Activity, LayoutList, LayoutGrid, 
  Plus, Crown, Sparkles, TrendingUp, Target, 
  Trophy, Percent, ArrowUpRight, BarChart3, Star, Lock, UserPlus
} from 'lucide-react';
import { Invoice, UserProfile, DbClient } from '../types';

interface ClientListProps {
  invoices: Invoice[];
  dbClients?: any[]; // NEW: Clients fetched from DB directly
  onSelectClient?: (clientName: string) => void;
  onCreateDocument: (client?: DbClient) => void; // Updated signature
  onCreateClient?: () => void;
  currencySymbol: string;
  currentUser?: UserProfile;
}

interface AggregatedClient {
  name: string;
  taxId: string;
  totalInvoiced: number; // For Clients (Invoices)
  totalQuoted: number;   // For Prospects (Quotes)
  totalCollected: number; 
  invoiceCount: number;
  quoteCount: number;
  quotesWon: number; 
  lastInteraction: Date;
  status: 'CLIENT' | 'PROSPECT';
  avgTicket: number;
  displayValue: number; // Polymorphic value (Invoiced vs Projected)
  isVip: boolean; 
  winRate: number;
  fullData: any; 
}

const ClientList: React.FC<ClientListProps> = ({ invoices, dbClients = [], onSelectClient, onCreateDocument, onCreateClient, currencySymbol, currentUser }) => {
  const [viewMode, setViewMode] = useState<'LIST' | 'GALLERY'>('GALLERY');
  const [filter, setFilter] = useState<'ALL' | 'CLIENT' | 'PROSPECT' | 'VIP'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Check AI Access
  const hasAiAccess = !!currentUser?.apiKeys?.gemini || !!currentUser?.apiKeys?.openai;

  // --- AGGREGATION LOGIC ---
  const { clients, stats } = useMemo(() => {
    const clientMap = new Map<string, AggregatedClient>();
    let totalPipelineValue = 0;
    let openOpportunitiesCount = 0;

    // 1. Process DB Clients (Base Layer)
    dbClients.forEach(dbClient => {
        const nameKey = dbClient.name.trim();
        clientMap.set(nameKey, {
            name: nameKey,
            taxId: dbClient.taxId || 'N/A',
            totalInvoiced: 0,
            totalQuoted: 0,
            totalCollected: 0,
            invoiceCount: 0,
            quoteCount: 0,
            quotesWon: 0,
            lastInteraction: new Date(), // Created recently
            status: dbClient.status || 'PROSPECT',
            avgTicket: 0,
            displayValue: 0,
            isVip: false,
            winRate: 0,
            fullData: dbClient
        });
    });

    // 2. Process Invoices (Overlay Layer - Revenue)
    invoices.forEach(inv => {
      // STRICT FILTER: Exclude Expenses completely. 
      // Providers from expenses should not appear in the Client Directory.
      if (inv.type === 'Expense') return;

      const nameKey = inv.clientName.trim();
      
      if (!clientMap.has(nameKey)) {
        clientMap.set(nameKey, {
          name: nameKey,
          taxId: inv.clientTaxId || 'N/A',
          totalInvoiced: 0,
          totalQuoted: 0,
          totalCollected: 0,
          invoiceCount: 0,
          quoteCount: 0,
          quotesWon: 0,
          lastInteraction: new Date(0),
          status: 'PROSPECT',
          avgTicket: 0,
          displayValue: 0,
          isVip: false,
          winRate: 0,
          fullData: { name: nameKey, taxId: inv.clientTaxId } // Fallback
        });
      }

      const client = clientMap.get(nameKey)!;
      const invDate = new Date(inv.date);

      if (invDate > client.lastInteraction) client.lastInteraction = invDate;

      // Update basic info from invoice if available
      if (inv.clientTaxId) client.taxId = inv.clientTaxId;

      if (inv.type === 'Invoice') {
        // Only count valid invoices for "Invoiced" stats
        if (inv.status !== 'Borrador' && inv.status !== 'Rechazada') {
            client.invoiceCount++;
            client.totalInvoiced += inv.total; 
        }
        
        // Track Collection for Status Determination
        let collected = 0;
        if (inv.amountPaid && inv.amountPaid > 0) {
            collected = inv.amountPaid;
        } else if (inv.status === 'Pagada' || inv.status === 'Aceptada') {
            collected = inv.total;
        }

        if (collected > 0) {
          client.totalCollected += collected;
          client.status = 'CLIENT';
        }
      } else if (inv.type === 'Quote') {
        client.quoteCount++;
        client.totalQuoted += inv.total; // Accumulate Quotes for Prospects
        
        // GLOBAL STATS: Calculate Active Pipeline
        if (inv.status === 'Enviada' || inv.status === 'Seguimiento' || inv.status === 'Negociacion') {
            totalPipelineValue += inv.total;
            openOpportunitiesCount++;
        }

        if (inv.status === 'Aceptada') {
             client.status = 'CLIENT'; 
             client.quotesWon++;
        }
      }
    });

    const allClients = Array.from(clientMap.values());
    const sortedByRevenue = [...allClients].sort((a, b) => b.totalInvoiced - a.totalInvoiced);
    const vipCount = Math.ceil(allClients.length * 0.2); 
    const vipThreshold = sortedByRevenue[vipCount - 1]?.totalInvoiced || 0;

    const processedClients = allClients.map(c => {
      let avgTicket = 0;
      let displayValue = 0;

      // Logic Split: Prospect vs Client
      if (c.status === 'PROSPECT') {
          // For Prospects: Avg Ticket based on Quotes, Display Value based on Quoted pipeline
          avgTicket = c.quoteCount > 0 ? c.totalQuoted / c.quoteCount : 0;
          displayValue = c.totalQuoted;
      } else {
          // For Clients: Avg Ticket based on Invoices, Display Value based on Invoiced
          avgTicket = c.invoiceCount > 0 ? c.totalInvoiced / c.invoiceCount : 0;
          displayValue = c.totalInvoiced;
      }

      const winRate = c.quoteCount > 0 ? (c.quotesWon / c.quoteCount) * 100 : 0;
      const isVip = c.status === 'CLIENT' && c.totalInvoiced > 0 && c.totalInvoiced >= vipThreshold;
      
      return { ...c, avgTicket, displayValue, winRate, isVip };
    });

    // Global Stats
    const totalPortfolioValue = processedClients.filter(c => c.status === 'CLIENT').reduce((acc, c) => acc + c.totalInvoiced, 0); 
    const totalActiveClients = processedClients.filter(c => c.status === 'CLIENT').length;
    
    // Global Avg Ticket (Weighted by total invoice count)
    const totalInvoicesCount = processedClients.reduce((acc, c) => acc + c.invoiceCount, 0);
    const avgGlobalTicket = totalInvoicesCount > 0 ? totalPortfolioValue / totalInvoicesCount : 0;
    
    return { 
      clients: processedClients, 
      stats: { 
          totalPortfolioValue, 
          totalActiveClients, 
          avgGlobalTicket, 
          totalPipelineValue, 
          openOpportunitiesCount 
      } 
    };

  }, [invoices, dbClients]);

  const filteredClients = clients.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.taxId.toLowerCase().includes(searchTerm.toLowerCase());
    let matchesType = true;
    if (filter === 'CLIENT') matchesType = c.status === 'CLIENT';
    if (filter === 'PROSPECT') matchesType = c.status === 'PROSPECT';
    if (filter === 'VIP') matchesType = c.isVip;
    return matchesSearch && matchesType;
  }).sort((a, b) => {
    if (a.isVip && !b.isVip) return -1;
    if (!a.isVip && b.isVip) return 1;
    if (b.displayValue === a.displayValue) return b.lastInteraction.getTime() - a.lastInteraction.getTime();
    return b.displayValue - a.displayValue;
  });

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const getRandomColor = (name: string) => {
    const colors = ['bg-rose-100 text-rose-600', 'bg-blue-100 text-blue-600', 'bg-teal-100 text-teal-600', 'bg-indigo-100 text-indigo-600'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in pb-12">
       
       {/* HEADER */}
       <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1c2938] tracking-tight">Directorio de Clientes</h1>
          <p className="text-slate-500 mt-1 text-lg font-light">Tus relaciones comerciales, organizadas.</p>
        </div>
        
        <button 
            onClick={onCreateClient || (() => onCreateDocument())} 
            className="bg-[#1c2938] text-white px-6 py-3.5 rounded-2xl font-bold hover:bg-[#27bea5] transition-all flex items-center gap-2 shadow-xl group"
        >
            <UserPlus className="w-5 h-5 group-hover:scale-110 transition-transform" /> <span>Nuevo Cliente</span>
        </button>
       </div>

       {/* KPI GRID */}
       <div className="hidden md:grid grid-cols-4 gap-6">
          {/* Card 1: Active Clients */}
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 relative overflow-hidden group hover:shadow-md transition-all">
             <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full -translate-y-1/2 translate-x-1/2"></div>
             <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                   <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><Users className="w-6 h-6" /></div>
                </div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Clientes Activos</p>
                <h3 className="text-2xl font-bold text-[#1c2938] mt-1 tracking-tight">{stats.totalActiveClients}</h3>
             </div>
          </div>

          {/* Card 2: Portfolio Value (INVOICED BASED) */}
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 relative overflow-hidden group hover:shadow-md transition-all">
             <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-full -translate-y-1/2 translate-x-1/2"></div>
             <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                   <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl"><Wallet className="w-6 h-6" /></div>
                </div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Valor Cartera (Fac.)</p>
                <h3 className="text-2xl font-bold text-[#1c2938] mt-1 tracking-tight">{currencySymbol} {stats.totalPortfolioValue.toLocaleString()}</h3>
             </div>
          </div>

          {/* Card 3: Avg Ticket (INVOICED BASED) */}
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 relative overflow-hidden group hover:shadow-md transition-all">
             <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-full -translate-y-1/2 translate-x-1/2"></div>
             <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                   <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl"><BarChart3 className="w-6 h-6" /></div>
                </div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Ticket Promedio</p>
                <h3 className="text-2xl font-bold text-[#1c2938] mt-1 tracking-tight">{currencySymbol} {stats.avgGlobalTicket.toLocaleString(undefined, {maximumFractionDigits: 0})}</h3>
             </div>
          </div>

          {/* Card 4: Radar (REAL DATA) */}
          <div className="bg-[#1c2938] p-6 rounded-[2rem] shadow-lg relative overflow-hidden group text-white">
             <div className="absolute top-0 right-0 w-32 h-32 bg-[#27bea5] rounded-full blur-[40px] opacity-20 -translate-y-1/2 translate-x-1/2"></div>
             <div className="relative z-10 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                   <div className="p-2.5 bg-white/10 text-[#27bea5] rounded-xl"><Sparkles className="w-6 h-6" /></div>
                   {!hasAiAccess && <Lock className="w-4 h-4 text-slate-400" />}
                </div>
                
                <div>
                   <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Radar de Oportunidad</p>
                   {stats.totalPipelineValue > 0 ? (
                      <>
                         <h3 className="text-2xl font-bold leading-tight mb-1">{currencySymbol} {stats.totalPipelineValue.toLocaleString()}</h3>
                         <p className="text-xs text-[#27bea5] font-medium flex items-center gap-1">
                            <Target className="w-3 h-3" /> {stats.openOpportunitiesCount} Cotizaciones en curso
                         </p>
                      </>
                   ) : (
                      <>
                         <h3 className="text-lg font-bold leading-tight mb-2 text-slate-300">Sin Datos Suficientes</h3>
                         <p className="text-[10px] text-slate-400 font-medium">Genera cotizaciones para activar el radar.</p>
                      </>
                   )}
                </div>
             </div>
          </div>
       </div>

       {/* FILTERS & SEARCH */}
       <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-2 rounded-[2rem] border border-slate-50 shadow-sm">
          <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full md:w-auto overflow-x-auto">
             {(['ALL', 'VIP', 'CLIENT', 'PROSPECT'] as const).map(f => (
               <button 
                 key={f}
                 onClick={() => setFilter(f)}
                 className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${filter === f ? (f === 'VIP' ? 'bg-white text-amber-600 shadow-sm' : 'bg-white text-[#1c2938] shadow-sm') : 'text-slate-400'}`}
               >
                 {f === 'ALL' ? 'Todos' : f === 'VIP' ? 'VIP' : f === 'CLIENT' ? 'Clientes' : 'Prospectos'}
               </button>
             ))}
          </div>
          <div className="flex-1 relative group w-full">
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-[#27bea5] transition-colors" />
            <input type="text" placeholder="Buscar cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full h-full pl-12 pr-6 py-3 bg-transparent border-none rounded-2xl text-sm font-medium text-[#1c2938] focus:bg-slate-50 focus:ring-0 outline-none" />
          </div>
       </div>

       {filteredClients.length > 0 ? (
          <>
            {/* Desktop View (Grid/List) */}
            <div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredClients.map((client) => (
                  <div 
                    key={client.name} 
                    onClick={() => onSelectClient && onSelectClient(client.name)}
                    className={`rounded-[2rem] p-6 border shadow-sm hover:shadow-xl transition-all duration-300 group relative flex flex-col justify-between h-[340px] cursor-pointer ${client.isVip ? 'bg-gradient-to-br from-amber-50/50 to-white border-amber-100' : 'bg-white border-slate-50 hover:border-[#27bea5]/30'}`}
                  >
                      <div className="flex justify-between items-start mb-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold shadow-sm ${client.isVip ? 'bg-amber-100 text-amber-700' : getRandomColor(client.name)}`}>
                            {client.isVip ? <Crown className="w-6 h-6 fill-amber-700" /> : getInitials(client.name)}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {client.isVip && <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border border-amber-200"><Star className="w-3 h-3 fill-amber-800" /> VIP</span>}
                          {client.status === 'PROSPECT' && <span className="bg-purple-50 text-purple-600 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border border-purple-100"><Sparkles className="w-3 h-3" /> Prospecto</span>}
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-[#1c2938] leading-tight line-clamp-2 mb-1 group-hover:text-[#27bea5] transition-colors">{client.name}</h3>
                        <p className="text-xs text-slate-400 font-mono mb-4">{client.taxId}</p>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-400 font-medium">{client.status === 'PROSPECT' ? 'Valor Potencial' : 'Facturado Total'}</span>
                              <span className="font-bold text-[#1c2938]">{currencySymbol} {client.displayValue.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-slate-100/50 flex justify-between items-center mt-4">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 uppercase font-bold">Ticket Prom.</span>
                            <span className="text-sm font-bold text-slate-600">{currencySymbol} {client.avgTicket.toLocaleString()}</span>
                          </div>
                          {/* Pass the client data to the creation handler */}
                          <button 
                            onClick={(e) => { e.stopPropagation(); onCreateDocument(client.fullData); }} 
                            className={`p-2.5 rounded-xl transition-colors shadow-sm ${client.isVip ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-slate-50 text-slate-600 hover:bg-[#1c2938] hover:text-white'}`}
                            title="Crear Documento"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                      </div>
                  </div>
                ))}
            </div>
          </>
       ) : (
         <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-[3rem] bg-slate-50/50">
            <Users className="w-20 h-20 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-[#1c2938]">Sin resultados</h3>
         </div>
       )}
    </div>
  );
};

export default ClientList;
