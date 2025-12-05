
import React, { useState, useMemo } from 'react';
import { 
  TrendingDown, TrendingUp, Plus, DollarSign, 
  ArrowRight, Calculator, PieChart, Wallet,
  Calendar, Tag, MoreHorizontal, AlertCircle,
  Lightbulb, ArrowUpRight, ArrowDownRight,
  Receipt, Sparkles, Truck, Package, LayoutGrid, List, Briefcase, Star
} from 'lucide-react';
import { Invoice } from '../types';

interface ExpenseTrackerProps {
  invoices: Invoice[];
  currencySymbol: string;
  onCreateExpense: () => void;
}

interface ProviderStats {
  name: string;
  totalSpend: number;
  transactionCount: number;
  lastTransaction: string;
  avgTicket: number;
  category: string;
  isTopPartner: boolean;
}

const ExpenseTracker: React.FC<ExpenseTrackerProps> = ({ invoices, currencySymbol, onCreateExpense }) => {
  const [calculatorMode, setCalculatorMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'TRANSACTIONS' | 'PROVIDERS'>('TRANSACTIONS');
  
  // Calculator State
  const [targetIncome, setTargetIncome] = useState(3000);
  const [monthlyCosts, setMonthlyCosts] = useState(500);
  const [billableHours, setBillableHours] = useState(25); // Per week

  // --- STATS & DATA AGGREGATION ---
  const { totalIncome, totalExpenses, netProfit, expensesList, providers } = useMemo(() => {
    // 1. Income (Money In)
    const income = invoices
      .filter(i => i.type === 'Invoice' && i.status === 'Aceptada')
      .reduce((acc, curr) => acc + curr.total, 0);

    // 2. Expenses List (Raw)
    const expenses = invoices.filter(i => i.type === 'Expense');
    const expensesTotal = expenses.reduce((acc, curr) => acc + curr.total, 0);

    // 3. Providers Aggregation
    const providerMap = new Map<string, ProviderStats>();
    
    expenses.forEach(exp => {
      const name = exp.clientName || 'Proveedor General';
      
      if (!providerMap.has(name)) {
        providerMap.set(name, {
          name,
          totalSpend: 0,
          transactionCount: 0,
          lastTransaction: exp.date,
          avgTicket: 0,
          category: exp.items[0]?.description || 'General', // Naive category inference
          isTopPartner: false
        });
      }

      const p = providerMap.get(name)!;
      p.totalSpend += exp.total;
      p.transactionCount += 1;
      if (new Date(exp.date) > new Date(p.lastTransaction)) {
        p.lastTransaction = exp.date;
      }
    });

    // Calculate Averages & Top Partners
    const providerArray = Array.from(providerMap.values()).sort((a, b) => b.totalSpend - a.totalSpend);
    const topSpendThreshold = expensesTotal * 0.2; // If provider accounts for > 20% of spend (arbitrary heuristic)

    const refinedProviders = providerArray.map(p => ({
      ...p,
      avgTicket: p.totalSpend / p.transactionCount,
      isTopPartner: p.totalSpend > 0 && (p.totalSpend > topSpendThreshold || providerArray.indexOf(p) < 3) // Top 3 or High Spend
    }));

    return {
      totalIncome: income,
      totalExpenses: expensesTotal,
      netProfit: income - expensesTotal,
      expensesList: expenses.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      providers: refinedProviders
    };
  }, [invoices]);

  // --- CALCULATOR LOGIC ---
  const calculatedHourlyRate = useMemo(() => {
    const totalNeeded = targetIncome + monthlyCosts;
    const monthlyHours = billableHours * 4; 
    return monthlyHours > 0 ? totalNeeded / monthlyHours : 0;
  }, [targetIncome, monthlyCosts, billableHours]);

  // --- HELPER: Random Color for Avatar (Warm Tones for Suppliers) ---
  const getProviderColor = (name: string) => {
    const colors = ['bg-orange-100 text-orange-600', 'bg-amber-100 text-amber-600', 'bg-rose-100 text-rose-600', 'bg-slate-100 text-slate-600'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in pb-12">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-6 border-b border-slate-100 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1c2938] tracking-tight">Control de Gastos</h1>
          <p className="text-slate-500 mt-1 text-lg font-light">
             Optimiza cada centavo para maximizar tu libertad.
          </p>
        </div>
        
        <div className="flex gap-3">
           <button 
             onClick={() => setCalculatorMode(!calculatorMode)}
             className={`px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 border ${calculatorMode ? 'bg-white text-[#1c2938] border-slate-200 shadow-sm' : 'bg-white text-slate-500 border-transparent hover:bg-slate-50'}`}
           >
             <Calculator className="w-5 h-5" />
             <span className="hidden md:inline">{calculatorMode ? 'Ocultar Calculadora' : 'Simular Costos'}</span>
           </button>

           <button 
             onClick={onCreateExpense}
             className="bg-[#1c2938] text-white px-6 py-3 rounded-2xl font-bold hover:bg-rose-500 transition-all flex items-center gap-2 shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 group"
           >
             <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
             <span>Nuevo Gasto</span>
           </button>
        </div>
      </div>

      {/* FINANCIAL HEALTH FLOW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
         
         {/* 1. INCOME CARD */}
         <div className="lg:col-span-4 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-50 relative overflow-hidden group hover:shadow-md transition-all duration-500">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#27bea5] rounded-full blur-[60px] opacity-10 group-hover:opacity-20 transition-opacity"></div>
            <div className="relative z-10 flex flex-col h-full justify-between">
               <div className="flex items-center gap-3 mb-8">
                  <div className="p-3 bg-teal-50 rounded-2xl text-[#27bea5]">
                     <ArrowUpRight className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ingresos Reales</p>
               </div>
               <div>
                 <h2 className="text-4xl font-bold text-[#1c2938] tracking-tight mb-1">{currencySymbol} {totalIncome.toLocaleString()}</h2>
                 <p className="text-sm text-slate-400 font-medium">Solo facturas cobradas</p>
               </div>
            </div>
         </div>

         {/* 2. EXPENSES CARD */}
         <div className="lg:col-span-4 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-50 relative overflow-hidden group hover:shadow-md transition-all duration-500">
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500 rounded-full blur-[60px] opacity-10 group-hover:opacity-20 transition-opacity"></div>
            <div className="relative z-10 flex flex-col h-full justify-between">
               <div className="flex items-center gap-3 mb-8">
                  <div className="p-3 bg-rose-50 rounded-2xl text-rose-500">
                     <ArrowDownRight className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Gastos</p>
               </div>
               <div>
                 <h2 className="text-4xl font-bold text-[#1c2938] tracking-tight mb-1">
                    <span className="text-rose-500 text-2xl mr-1">-</span>
                    {currencySymbol} {totalExpenses.toLocaleString()}
                 </h2>
                 <p className="text-sm text-slate-400 font-medium">Costos Operativos</p>
               </div>
            </div>
         </div>

         {/* 3. PROFIT CARD (HERO) */}
         <div className="lg:col-span-4 bg-[#1c2938] p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden text-white group hover:scale-[1.02] transition-transform duration-500">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#27bea5] rounded-full blur-[80px] opacity-20 -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-600 rounded-full blur-[60px] opacity-20 translate-y-1/2 -translate-x-1/2"></div>
            
            <div className="relative z-10 flex flex-col h-full justify-between">
               <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-white/10 rounded-2xl text-[#27bea5] backdrop-blur-sm">
                       <Wallet className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Utilidad Neta</p>
                  </div>
                  <div className="px-3 py-1 bg-white/10 rounded-full border border-white/10 text-xs font-bold text-[#27bea5]">
                     {totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(0) : 0}% Margen
                  </div>
               </div>
               
               <div>
                 <h2 className="text-5xl font-bold tracking-tight mb-4">{currencySymbol} {netProfit.toLocaleString()}</h2>
                 
                 {/* Visual Progress Bar */}
                 <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                       className={`h-full rounded-full transition-all duration-1000 ease-out ${netProfit >= 0 ? 'bg-gradient-to-r from-[#27bea5] to-emerald-400' : 'bg-rose-500'}`}
                       style={{ width: `${Math.min(100, Math.max(0, (netProfit / (totalIncome || 1)) * 100))}%` }}
                    ></div>
                 </div>
                 <p className="text-xs text-slate-400 mt-3 font-medium">Disponible para reinversión o retiro</p>
               </div>
            </div>
         </div>
      </div>

      {/* CALCULATOR SECTION (Collapsible Dark Mode Tool) */}
      {calculatorMode && (
         <div className="bg-[#1c2938] rounded-[3rem] p-8 md:p-12 shadow-2xl animate-in slide-in-from-top-8 relative overflow-hidden text-white">
             {/* ... (Calculator Code kept same as before) ... */}
             <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600 rounded-full blur-[120px] opacity-20 pointer-events-none -translate-y-1/2 translate-x-1/2"></div>
             
             <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div className="space-y-8">
                   <div>
                      <div className="flex items-center gap-3 mb-3">
                         <div className="p-2 bg-[#27bea5] rounded-lg text-white">
                           <Calculator className="w-5 h-5" />
                         </div>
                         <h3 className="text-2xl font-bold">Simulador de Tarifas</h3>
                      </div>
                      <p className="text-slate-400 font-light leading-relaxed">
                         Define tus metas y deja que las matemáticas te digan cuánto vale tu hora de trabajo.
                      </p>
                   </div>

                   <div className="space-y-6">
                      <div className="space-y-2">
                         <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Meta de Ingreso Mensual</label>
                         <div className="relative group">
                            <DollarSign className="absolute left-4 top-4 w-5 h-5 text-slate-500 group-focus-within:text-[#27bea5] transition-colors" />
                            <input 
                              type="number" 
                              value={targetIncome}
                              onChange={(e) => setTargetIncome(Number(e.target.value))}
                              className="w-full pl-12 p-4 rounded-2xl bg-white/5 border border-white/10 focus:bg-white/10 focus:border-[#27bea5] focus:ring-1 focus:ring-[#27bea5] outline-none text-xl font-bold text-white transition-all"
                            />
                         </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                           <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Costos Fijos</label>
                           <div className="relative group">
                              <TrendingDown className="absolute left-4 top-4 w-5 h-5 text-rose-400 group-focus-within:text-rose-500 transition-colors" />
                              <input 
                                type="number" 
                                value={monthlyCosts}
                                onChange={(e) => setMonthlyCosts(Number(e.target.value))}
                                className="w-full pl-12 p-4 rounded-2xl bg-white/5 border border-white/10 focus:bg-white/10 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none text-xl font-bold text-white transition-all"
                              />
                           </div>
                        </div>

                        <div className="space-y-2">
                           <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Horas Semanales</label>
                           <div className="relative group">
                              <Calendar className="absolute left-4 top-4 w-5 h-5 text-blue-400 group-focus-within:text-blue-500 transition-colors" />
                              <input 
                                type="number" 
                                value={billableHours}
                                onChange={(e) => setBillableHours(Number(e.target.value))}
                                className="w-full pl-12 p-4 rounded-2xl bg-white/5 border border-white/10 focus:bg-white/10 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-xl font-bold text-white transition-all"
                              />
                           </div>
                        </div>
                      </div>
                   </div>
                </div>

                {/* Result Card */}
                <div className="bg-white text-[#1c2938] rounded-[2.5rem] p-10 shadow-2xl flex flex-col justify-center items-center text-center relative overflow-hidden">
                   <div className="absolute inset-0 bg-gradient-to-br from-white to-slate-100 opacity-50"></div>
                   <div className="relative z-10">
                      <div className="w-16 h-16 bg-[#1c2938] rounded-full flex items-center justify-center mb-6 text-white shadow-xl mx-auto">
                          <Lightbulb className="w-8 h-8 text-[#27bea5]" />
                      </div>
                      <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-3">Tarifa Mínima Sugerida</p>
                      <h2 className="text-6xl font-bold tracking-tighter mb-4 text-[#1c2938]">
                          <span className="text-3xl align-top opacity-50 mr-1">{currencySymbol}</span>
                          {calculatedHourlyRate.toFixed(0)}
                          <span className="text-xl text-slate-400 font-medium ml-2">/hr</span>
                      </h2>
                      <div className="bg-slate-100 rounded-xl p-4 mt-2">
                         <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
                            Cubre tus costos de <strong>{currencySymbol}{monthlyCosts}</strong> y alcanza tu meta de <strong>{currencySymbol}{targetIncome}</strong>.
                         </p>
                      </div>
                   </div>
                </div>
             </div>
         </div>
      )}

      {/* CONTENT TABS */}
      <div className="flex justify-center w-full">
         <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 flex overflow-x-auto max-w-full custom-scrollbar">
            <button
              onClick={() => setActiveTab('TRANSACTIONS')}
              className={`px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'TRANSACTIONS'
                  ? 'text-white bg-[#1c2938] shadow-md' 
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
            >
              <List className="w-4 h-4" /> Movimientos
            </button>
            <button
              onClick={() => setActiveTab('PROVIDERS')}
              className={`px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'PROVIDERS'
                  ? 'text-white bg-[#1c2938] shadow-md' 
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Briefcase className="w-4 h-4" /> Proveedores
            </button>
         </div>
      </div>

      {/* TRANSACTIONS VIEW */}
      {activeTab === 'TRANSACTIONS' && (
        <div className="animate-in fade-in slide-in-from-bottom-4">
           <div className="flex items-center justify-between mb-6 px-4">
              <h3 className="font-bold text-[#1c2938] text-xl flex items-center gap-2">
                 <Receipt className="w-5 h-5 text-slate-400" />
                 Historial Detallado
              </h3>
           </div>

           <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-50 overflow-hidden min-h-[300px]">
              {expensesList.length > 0 ? (
                 <div className="divide-y divide-slate-50">
                    {expensesList.map(expense => (
                       <div key={expense.id} className="p-6 md:px-8 flex flex-col md:flex-row items-start md:items-center justify-between hover:bg-slate-50 transition-colors group gap-4">
                          <div className="flex items-center gap-5">
                             <div className="w-14 h-14 rounded-[1.2rem] bg-rose-50 text-rose-500 flex items-center justify-center group-hover:scale-110 group-hover:shadow-md transition-all duration-300 shadow-sm border border-rose-100">
                                <Tag className="w-6 h-6" />
                             </div>
                             <div>
                                <h4 className="font-bold text-[#1c2938] text-lg mb-1">{expense.items[0]?.description || 'Gasto Varios'}</h4>
                                <div className="flex items-center gap-3 text-xs text-slate-400 font-medium">
                                   <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(expense.date).toLocaleDateString()}</span>
                                   <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                   <span>{expense.clientName || 'Proveedor General'}</span>
                                </div>
                             </div>
                          </div>
                          <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                             <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wide rounded-lg">
                                {expense.status === 'Aceptada' ? 'Pagado' : 'Pendiente'}
                             </span>
                             <p className="font-bold text-[#1c2938] text-xl tracking-tight">
                                -{currencySymbol} {expense.total.toLocaleString()}
                             </p>
                          </div>
                       </div>
                    ))}
                 </div>
              ) : (
                 <div className="flex flex-col items-center justify-center h-[300px] text-center">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                       <PieChart className="w-8 h-8 text-slate-300" />
                    </div>
                    <h3 className="font-bold text-slate-700">Sin gastos registrados</h3>
                    <p className="text-slate-400 text-sm mt-1 mb-6">Mantén tus cuentas claras registrando tus costos.</p>
                    <button onClick={onCreateExpense} className="text-[#27bea5] font-bold text-sm hover:underline">
                       + Registrar primer gasto
                    </button>
                 </div>
              )}
           </div>
        </div>
      )}

      {/* PROVIDERS VIEW (GALLERY) */}
      {activeTab === 'PROVIDERS' && (
        <div className="animate-in fade-in slide-in-from-bottom-4">
           <div className="flex items-center justify-between mb-6 px-4">
              <h3 className="font-bold text-[#1c2938] text-xl flex items-center gap-2">
                 <Truck className="w-5 h-5 text-slate-400" />
                 Socios y Proveedores
              </h3>
           </div>

           {providers.length > 0 ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {providers.map(provider => (
                   <div 
                     key={provider.name}
                     className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 hover:shadow-lg hover:border-amber-200 transition-all duration-300 group flex flex-col justify-between h-[280px]"
                   >
                      <div className="flex justify-between items-start">
                         <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold shadow-sm ${getProviderColor(provider.name)}`}>
                            {provider.name.substring(0, 2).toUpperCase()}
                         </div>
                         {provider.isTopPartner && (
                            <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border border-amber-200">
                               <Star className="w-3 h-3 fill-amber-800" /> Top Partner
                            </span>
                         )}
                      </div>

                      <div className="flex-1 mt-6">
                         <h3 className="text-xl font-bold text-[#1c2938] leading-tight line-clamp-2 mb-1 group-hover:text-amber-700 transition-colors">{provider.name}</h3>
                         <p className="text-xs text-slate-400 flex items-center gap-1 mb-4">
                            <Package className="w-3 h-3" /> {provider.category}
                         </p>

                         <div className="space-y-3">
                            <div className="flex justify-between items-center text-sm">
                               <span className="text-slate-400 font-medium">Total Comprado</span>
                               <span className="font-bold text-[#1c2938]">{currencySymbol} {provider.totalSpend.toLocaleString()}</span>
                            </div>
                            
                            {/* Spend Bar */}
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                               <div 
                                 className="h-full bg-amber-400 rounded-full" 
                                 style={{ width: `${Math.min(100, (provider.totalSpend / totalExpenses) * 100)}%` }}
                               ></div>
                            </div>
                         </div>
                      </div>

                      <div className="pt-4 border-t border-slate-50 flex justify-between items-center mt-4">
                         <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 uppercase font-bold">Transacciones</span>
                            <span className="text-sm font-bold text-slate-600">{provider.transactionCount}</span>
                         </div>
                         <div className="text-right">
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Última Compra</span>
                            <span className="text-xs font-medium text-slate-600">
                               {new Date(provider.lastTransaction).toLocaleDateString()}
                            </span>
                         </div>
                      </div>
                   </div>
                ))}
             </div>
           ) : (
             <div className="flex flex-col items-center justify-center h-[300px] text-center border-2 border-dashed border-slate-200 rounded-[2.5rem] bg-slate-50/50">
                <Truck className="w-16 h-16 text-slate-300 mb-4 opacity-50" />
                <h3 className="font-bold text-slate-700">Directorio Vacío</h3>
                <p className="text-slate-400 text-sm mt-1">Registra gastos para crear perfiles de proveedores automáticamente.</p>
             </div>
           )}
        </div>
      )}

    </div>
  );
};

export default ExpenseTracker;
