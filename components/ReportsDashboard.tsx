
import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  Sparkles, TrendingUp, DollarSign, AlertCircle, Loader2, 
  BrainCircuit, ArrowRight, Activity, Target, Lightbulb,
  X, CheckCircle2, TrendingDown, Wallet, FileText, Share2, Download, MessageCircle, Mail,
  Calendar, Filter, ChevronDown
} from 'lucide-react';
import { Invoice, FinancialAnalysisResult, DeepDiveReport } from '../types';
import { generateFinancialAnalysis, generateDeepDiveReport } from '../services/geminiService';

interface ReportsDashboardProps {
  invoices: Invoice[];
  currencySymbol: string;
  apiKey?: string;
}

type TimeRange = '30D' | '90D' | '12M' | 'CUSTOM';

const ReportsDashboard: React.FC<ReportsDashboardProps> = ({ invoices, currencySymbol, apiKey }) => {
  // AI State
  const [analysis, setAnalysis] = useState<FinancialAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Drill-down State
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  // Filter State - Default to 12M for a full reflective view of progress
  const [timeRange, setTimeRange] = useState<TimeRange>('12M');
  const [customStart, setCustomStart] = useState<string>(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [customEnd, setCustomEnd] = useState<string>(new Date().toISOString().split('T')[0]);

  // Deep Dive Report State
  const [deepDiveReport, setDeepDiveReport] = useState<DeepDiveReport | null>(null);
  const [isDeepDiving, setIsDeepDiving] = useState<string | null>(null); // Stores chart ID
  const [showShareOptions, setShowShareOptions] = useState(false);

  // --- 1. FILTER LOGIC ---
  const filteredInvoices = useMemo(() => {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    if (timeRange === '30D') {
      startDate.setDate(now.getDate() - 30);
    } else if (timeRange === '90D') {
      startDate.setDate(now.getDate() - 90);
    } else if (timeRange === '12M') {
      startDate.setDate(now.getDate() - 365);
    } else if (timeRange === 'CUSTOM') {
      startDate = new Date(customStart);
      endDate = new Date(customEnd);
      // Adjust end date to include the full day
      endDate.setHours(23, 59, 59, 999);
    }

    return invoices.filter(inv => {
      const d = new Date(inv.date);
      return d >= startDate && d <= endDate;
    });
  }, [invoices, timeRange, customStart, customEnd]);

  // --- 2. DATA AGGREGATION (Dynamic) ---
  const data = useMemo(() => {
    // A. Chart Trends (Timeline)
    const now = new Date();
    const start = timeRange === 'CUSTOM' ? new Date(customStart) : 
                  timeRange === '30D' ? new Date(now.getTime() - 30 * 86400000) :
                  timeRange === '90D' ? new Date(now.getTime() - 90 * 86400000) :
                  new Date(now.getTime() - 365 * 86400000); // 12M
    
    const end = timeRange === 'CUSTOM' ? new Date(customEnd) : new Date();
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    // Auto-grouping logic: If viewing 12 months, group by month. If 30 days, group by day.
    const groupBy = diffDays > 45 ? 'MONTH' : 'DAY';

    const timelineMap = new Map<string, { ingresos: number, gastos: number, date: Date }>();

    // Initialize Map keys to ensure continuous axis (No gaps in chart)
    let d = new Date(start);
    if (groupBy === 'DAY') {
      while (d <= end) {
        const key = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
        timelineMap.set(key, { ingresos: 0, gastos: 0, date: new Date(d) });
        d.setDate(d.getDate() + 1);
      }
    } else {
      // Align to first of month for cleaner loops if needed, but simple iteration works for keys
      while (d <= end) {
        const key = d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
        if (!timelineMap.has(key)) {
            timelineMap.set(key, { ingresos: 0, gastos: 0, date: new Date(d) });
        }
        d.setDate(d.getDate() + 15); // Jump 15 days to efficiently traverse months without skipping short ones
      }
    }

    // Populate Data
    filteredInvoices.forEach(inv => {
      const d = new Date(inv.date);
      const key = groupBy === 'DAY' 
        ? d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
        : d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
      
      // Only aggregate if key exists (falls within generated range) or simply add if logic permits
      if (!timelineMap.has(key) && groupBy === 'MONTH') {
          // Edge case: invoice falls in a month bucket not pre-generated (e.g. boundary days)
          timelineMap.set(key, { ingresos: 0, gastos: 0, date: d });
      }

      if (timelineMap.has(key)) {
        const entry = timelineMap.get(key)!;
        if (inv.type === 'Invoice' && (inv.status === 'Paid' || inv.status === 'Sent')) {
          entry.ingresos += inv.total;
        } else if (inv.type === 'Expense') {
          entry.gastos += inv.total;
        }
      }
    });

    // Sort strictly by date object to ensure chronological order in charts
    const monthlyData = Array.from(timelineMap.entries())
      .map(([name, val]) => ({
        name,
        ingresos: val.ingresos,
        gastos: val.gastos,
        _date: val.date
      }))
      .sort((a, b) => a._date.getTime() - b._date.getTime());

    // B. Status Distribution
    const paid = filteredInvoices.filter(i => i.status === 'Paid').length;
    const pending = filteredInvoices.filter(i => i.status === 'Sent' || i.status === 'Viewed').length;
    const draft = filteredInvoices.filter(i => i.status === 'Draft' || i.status === 'PendingSync').length;
    
    const statusData = [
      { name: 'Cobrado', value: paid || 0, color: '#27bea5', key: 'PAID' },
      { name: 'Pendiente', value: pending || 0, color: '#f59e0b', key: 'PENDING' },
      { name: 'Borrador', value: draft || 0, color: '#94a3b8', key: 'DRAFT' },
    ].filter(d => d.value > 0);

    // C. Top Products
    const productMap = new Map<string, number>();
    filteredInvoices.forEach(inv => {
      inv.items.forEach(item => {
        const current = productMap.get(item.description) || 0;
        productMap.set(item.description, current + (item.price * item.quantity));
      });
    });
    
    const topProducts = Array.from(productMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return { monthlyData, statusData, topProducts };
  }, [filteredInvoices, timeRange, customStart, customEnd]);


  // --- HANDLERS ---

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    const totalRevenue = data.monthlyData.reduce((acc, curr) => acc + curr.ingresos, 0);
    const totalExpense = data.monthlyData.reduce((acc, curr) => acc + curr.gastos, 0);
    const topProduct = data.topProducts[0]?.name || "N/A";
    
    const summary = `
      Periodo Analizado: ${timeRange === 'CUSTOM' ? `${customStart} a ${customEnd}` : timeRange}.
      Total Ingresos: ${currencySymbol}${totalRevenue}.
      Total Gastos: ${currencySymbol}${totalExpense}.
      Producto Top: ${topProduct}.
      Facturas Pendientes: ${data.statusData.find(d => d.name === 'Pendiente')?.value || 0}.
    `;

    const result = await generateFinancialAnalysis(summary, apiKey);
    setAnalysis(result);
    setIsAnalyzing(false);
  };

  const handleDeepDive = async (chartId: string, chartTitle: string, chartData: any) => {
    setIsDeepDiving(chartId);
    setDeepDiveReport(null);
    setShowShareOptions(false);
    
    const context = `Periodo: ${timeRange}. Data: ${JSON.stringify(chartData)}`;
    const report = await generateDeepDiveReport(chartTitle, context, apiKey);
    setDeepDiveReport(report);
    setIsDeepDiving(null);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-[#27bea5] border-[#27bea5]';
    if (score >= 50) return 'text-amber-400 border-amber-400';
    return 'text-red-400 border-red-400';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in pb-12">
      
      {/* HEADER WITH DATE FILTER */}
      <div className="flex flex-col xl:flex-row justify-between items-end xl:items-center gap-6 border-b border-slate-100 pb-6">
        <div>
           <h1 className="text-3xl font-bold text-[#1c2938] tracking-tight">Inteligencia de Negocio</h1>
           <p className="text-slate-500 mt-1 text-lg font-light">
             Viendo datos de: <span className="font-medium text-[#27bea5]">{filteredInvoices.length} documentos</span>
           </p>
        </div>

        {/* Date Filter Controls */}
        <div className="flex flex-col md:flex-row items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 px-3">
             <Calendar className="w-5 h-5 text-slate-400" />
             <span className="text-sm font-bold text-slate-500 uppercase tracking-wider hidden md:block">Periodo:</span>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl">
             {(['30D', '90D', '12M', 'CUSTOM'] as TimeRange[]).map((range) => (
               <button
                 key={range}
                 onClick={() => setTimeRange(range)}
                 className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                   timeRange === range 
                     ? 'bg-white text-[#1c2938] shadow-sm ring-1 ring-slate-200' 
                     : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                 }`}
               >
                 {range === '30D' ? '30 Días' : range === '90D' ? '3 Meses' : range === '12M' ? 'Último Año' : 'Personalizar'}
               </button>
             ))}
          </div>

          {/* Custom Date Inputs (Collapsible/Conditional) */}
          {timeRange === 'CUSTOM' && (
             <div className="flex items-center gap-2 animate-in slide-in-from-right-4 px-2">
                <input 
                  type="date" 
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="p-2 border border-slate-200 rounded-lg text-xs font-medium focus:ring-[#27bea5] outline-none"
                />
                <span className="text-slate-300">-</span>
                <input 
                  type="date" 
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="p-2 border border-slate-200 rounded-lg text-xs font-medium focus:ring-[#27bea5] outline-none"
                />
             </div>
          )}
        </div>
      </div>

      {/* SECTION 1: VIRTUAL CFO */}
      <div className={`relative overflow-hidden rounded-[2.5rem] bg-[#1c2938] shadow-2xl text-white group transition-all duration-500 ${analysis ? 'p-0' : 'p-0'}`}>
         {/* Abstract Decor */}
         <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#27bea5] rounded-full blur-[150px] opacity-10 -translate-y-1/2 translate-x-1/2 pointer-events-none transition-opacity duration-700 group-hover:opacity-20"></div>

         <div className="relative z-10 p-8 md:p-10">
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="flex items-center gap-4">
                 <div className="p-3.5 bg-white/10 rounded-2xl text-[#27bea5] backdrop-blur-sm shadow-inner border border-white/5">
                   <BrainCircuit className="w-8 h-8" />
                 </div>
                 <div>
                   <h2 className="text-2xl font-bold tracking-tight">CFO Virtual Kônsul</h2>
                   <p className="text-slate-400 font-light">Auditoría del periodo seleccionado</p>
                 </div>
              </div>
              
              {!analysis && (
                <button 
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="bg-[#27bea5] hover:bg-[#22a890] text-white px-8 py-3.5 rounded-2xl font-bold transition-all shadow-lg hover:shadow-[#27bea5]/20 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:transform-none flex items-center gap-3"
                >
                  {isAnalyzing ? <Loader2 className="animate-spin w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                  {isAnalyzing ? 'Conectando Cerebro...' : 'Analizar Mi Negocio'}
                </button>
              )}
           </div>

           {/* Results Container */}
           {analysis && (
             <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 mt-10 border-t border-white/10 pt-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                   
                   {/* Health Score */}
                   <div className="lg:col-span-4 bg-white/5 border border-white/10 rounded-[2rem] p-8 flex flex-col items-center justify-center text-center relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-50"></div>
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-6 relative z-10">Salud Financiera</p>
                      <div className={`w-40 h-40 rounded-full border-[12px] flex items-center justify-center mb-6 relative z-10 bg-[#1c2938] ${getScoreColor(analysis.healthScore)}`}>
                         <span className={`text-5xl font-bold ${getScoreColor(analysis.healthScore).split(' ')[0]}`}>
                           {analysis.healthScore}
                         </span>
                      </div>
                      <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide relative z-10 ${
                         analysis.healthStatus === 'Excellent' ? 'bg-[#27bea5]/20 text-[#27bea5]' : 
                         analysis.healthStatus === 'Good' ? 'bg-[#27bea5]/10 text-[#27bea5]' :
                         'bg-red-500/20 text-red-400'
                      }`}>
                        {analysis.healthStatus === 'Excellent' ? 'Excelente' : analysis.healthStatus === 'Good' ? 'Buena' : 'Crítica'}
                      </span>
                   </div>

                   {/* Analysis & Tips */}
                   <div className="lg:col-span-8 grid grid-cols-1 gap-6">
                      {/* Diagnosis */}
                      <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 backdrop-blur-sm">
                         <div className="flex items-start gap-4">
                           <div className="p-2 bg-[#27bea5]/10 rounded-xl text-[#27bea5] mt-1">
                              <Activity className="w-6 h-6" />
                           </div>
                           <div>
                             <h4 className="font-bold text-lg mb-2 text-white">Diagnóstico</h4>
                             <p className="text-slate-300 font-light leading-relaxed text-lg">{analysis.diagnosis}</p>
                           </div>
                         </div>
                      </div>

                      {/* Projection */}
                      <div className="bg-gradient-to-r from-[#27bea5]/10 to-transparent border border-[#27bea5]/20 rounded-[2rem] p-8">
                         <div className="flex items-start gap-4">
                           <div className="p-2 bg-[#27bea5]/20 rounded-xl text-[#27bea5] mt-1">
                              <Target className="w-6 h-6" />
                           </div>
                           <div>
                             <h4 className="font-bold text-lg mb-2 text-[#27bea5]">Proyección</h4>
                             <p className="text-slate-200 font-light">{analysis.projection}</p>
                           </div>
                         </div>
                      </div>
                   </div>
                </div>

                {/* Actionable Tips */}
                <div className="mt-8">
                   <h4 className="font-bold text-slate-500 text-xs uppercase tracking-widest mb-4 ml-2">Plan de Acción Recomendado</h4>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {analysis.actionableTips.map((tip, idx) => (
                        <div key={idx} className="bg-white/5 border border-white/10 p-6 rounded-2xl flex gap-4 hover:bg-white/10 transition-colors group">
                           <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                             <Lightbulb className="w-5 h-5" />
                           </div>
                           <p className="text-sm text-slate-300 leading-relaxed font-light">{tip}</p>
                        </div>
                      ))}
                   </div>
                </div>
             </div>
           )}
         </div>
      </div>

      {/* SECTION 2: VISUAL METRICS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Card: Cash Flow */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-50 hover:shadow-md transition-shadow">
           <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="font-bold text-[#1c2938] text-xl flex items-center gap-2">
                  <div className="p-2 bg-slate-50 rounded-xl text-[#27bea5]">
                    <Wallet className="w-5 h-5" />
                  </div>
                  Flujo de Caja
                </h3>
                <p className="text-slate-400 text-sm mt-1 ml-11">
                  Ingresos vs. Gastos ({timeRange === 'CUSTOM' ? 'Rango' : timeRange})
                </p>
              </div>
              <button 
                onClick={() => handleDeepDive('cashflow', 'Flujo de Caja', data.monthlyData)}
                disabled={isDeepDiving === 'cashflow' || data.monthlyData.length === 0}
                className="p-3 rounded-xl bg-slate-50 hover:bg-[#27bea5]/10 text-slate-500 hover:text-[#27bea5] transition-all group"
                title="Generar Reporte Detallado"
              >
                {isDeepDiving === 'cashflow' ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
              </button>
           </div>
           
           <div className="h-72">
             {data.monthlyData.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={data.monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                   <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} stroke="#94a3b8" dy={10} />
                   <YAxis axisLine={false} tickLine={false} fontSize={12} stroke="#94a3b8" />
                   <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                   <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                   <Bar dataKey="ingresos" name="Ingresos" fill="#27bea5" radius={[6, 6, 0, 0]} barSize={32} />
                   <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[6, 6, 0, 0]} barSize={32} />
                 </BarChart>
               </ResponsiveContainer>
             ) : (
               <div className="flex items-center justify-center h-full text-slate-400">Sin datos en este periodo</div>
             )}
           </div>
        </div>

        {/* Card: Trends */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-50 hover:shadow-md transition-shadow">
           <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="font-bold text-[#1c2938] text-xl flex items-center gap-2">
                  <div className="p-2 bg-slate-50 rounded-xl text-blue-500">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  Tendencia de Crecimiento
                </h3>
                <p className="text-slate-400 text-sm mt-1 ml-11">Evolución de facturación</p>
              </div>
              <button 
                onClick={() => handleDeepDive('trends', 'Tendencia de Crecimiento', data.monthlyData)}
                disabled={isDeepDiving === 'trends' || data.monthlyData.length === 0}
                className="p-3 rounded-xl bg-slate-50 hover:bg-[#27bea5]/10 text-slate-500 hover:text-[#27bea5] transition-all group"
                title="Generar Reporte Detallado"
              >
                {isDeepDiving === 'trends' ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
              </button>
           </div>

           <div className="h-72">
             {data.monthlyData.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={data.monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                   <defs>
                     <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="#27bea5" stopOpacity={0.15}/>
                       <stop offset="95%" stopColor="#27bea5" stopOpacity={0}/>
                     </linearGradient>
                   </defs>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                   <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} stroke="#94a3b8" dy={10} />
                   <YAxis axisLine={false} tickLine={false} fontSize={12} stroke="#94a3b8" />
                   <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                   <Area type="monotone" dataKey="ingresos" stroke="#27bea5" strokeWidth={4} fillOpacity={1} fill="url(#colorIngresos)" />
                 </AreaChart>
               </ResponsiveContainer>
             ) : (
                <div className="flex items-center justify-center h-full text-slate-400">Sin datos en este periodo</div>
             )}
           </div>
        </div>

        {/* Card: Collection Status */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-50 hover:shadow-md transition-shadow relative overflow-hidden">
           <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-bold text-[#1c2938] text-xl flex items-center gap-2">
                  <div className="p-2 bg-slate-50 rounded-xl text-amber-500">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  Estado de Cobranza
                </h3>
              </div>
              <div className="flex gap-2">
                 <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-full text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    <MousePointer2 className="w-3 h-3" /> Interactivo
                 </div>
                 <button 
                  onClick={() => handleDeepDive('status', 'Estado de Cobranza', data.statusData)}
                  disabled={isDeepDiving === 'status' || data.statusData.length === 0}
                  className="p-2 rounded-xl bg-slate-50 hover:bg-[#27bea5]/10 text-slate-500 hover:text-[#27bea5] transition-all"
                >
                  {isDeepDiving === 'status' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                </button>
              </div>
           </div>

           <div className="h-64 relative">
             {data.statusData.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie
                     data={data.statusData}
                     cx="50%"
                     cy="50%"
                     innerRadius={60}
                     outerRadius={80}
                     paddingAngle={8}
                     dataKey="value"
                     onClick={(entry) => setSelectedStatus(entry.name)}
                     className="cursor-pointer outline-none filter drop-shadow-lg"
                   >
                     {data.statusData.map((entry, index) => (
                       <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color} 
                        strokeWidth={0}
                        className="hover:opacity-80 transition-opacity cursor-pointer"
                       />
                     ))}
                   </Pie>
                   <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                   <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
                 </PieChart>
               </ResponsiveContainer>
             ) : (
                <div className="flex items-center justify-center h-full text-slate-400">Sin datos en este periodo</div>
             )}
             
             {/* Center Stats */}
             <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none pr-24">
                <p className="text-3xl font-bold text-[#1c2938]">{filteredInvoices.length}</p>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Docs</p>
             </div>
           </div>
        </div>

        {/* Card: Top Services */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-50 hover:shadow-md transition-shadow">
           <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-bold text-[#1c2938] text-xl flex items-center gap-2">
                  <div className="p-2 bg-slate-50 rounded-xl text-purple-500">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  Top Servicios
                </h3>
              </div>
              <button 
                  onClick={() => handleDeepDive('services', 'Top Servicios', data.topProducts)}
                  disabled={isDeepDiving === 'services' || data.topProducts.length === 0}
                  className="p-3 rounded-xl bg-slate-50 hover:bg-[#27bea5]/10 text-slate-500 hover:text-[#27bea5] transition-all group"
                  title="Generar Reporte Detallado"
              >
                {isDeepDiving === 'services' ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
              </button>
           </div>

           <div className="h-64">
             {data.topProducts.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart layout="vertical" data={data.topProducts} margin={{ left: 10 }}>
                   <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                   <XAxis type="number" hide />
                   <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={120} 
                      tick={{fontSize: 11, fill: '#64748b', fontWeight: 500}} 
                      axisLine={false}
                      tickLine={false}
                   />
                   <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                   <Bar dataKey="value" fill="#1c2938" radius={[0, 6, 6, 0]} barSize={24}>
                      <Cell fill="#1c2938" />
                      <Cell fill="#1c2938" opacity={0.8} />
                      <Cell fill="#1c2938" opacity={0.6} />
                      <Cell fill="#1c2938" opacity={0.4} />
                      <Cell fill="#1c2938" opacity={0.2} />
                   </Bar>
                 </BarChart>
               </ResponsiveContainer>
             ) : (
                <div className="flex items-center justify-center h-full text-slate-400">Sin datos en este periodo</div>
             )}
           </div>
        </div>
      </div>

      {/* DRILL DOWN MODAL */}
      {selectedStatus && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1c2938]/40 backdrop-blur-md animate-in fade-in">
           <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                 <div>
                    <h3 className="font-bold text-[#1c2938] text-xl flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        selectedStatus === 'Cobrado' ? 'bg-[#27bea5]' : 
                        selectedStatus === 'Pendiente' ? 'bg-amber-500' : 'bg-slate-400'
                      }`}></div>
                      {selectedStatus}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Desglose de facturas ({timeRange})</p>
                 </div>
                 <button onClick={() => setSelectedStatus(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                   <X className="w-5 h-5 text-slate-400" />
                 </button>
              </div>
              
              <div className="p-6 max-h-[400px] overflow-y-auto custom-scrollbar">
                 {filteredInvoices.length > 0 ? (
                    <div className="space-y-3">
                      {filteredInvoices.filter(i => {
                          if (selectedStatus === 'Cobrado') return i.status === 'Paid';
                          if (selectedStatus === 'Pendiente') return i.status === 'Sent' || i.status === 'Viewed';
                          if (selectedStatus === 'Borrador') return i.status === 'Draft' || i.status === 'PendingSync';
                          return false;
                      }).map(inv => (
                        <div key={inv.id} className="p-4 border border-slate-100 rounded-2xl flex justify-between items-center hover:border-[#27bea5] hover:shadow-sm transition-all group bg-white">
                           <div>
                             <p className="font-bold text-[#1c2938] text-base group-hover:text-[#27bea5] transition-colors">{inv.clientName}</p>
                             <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                               <span>#{inv.id}</span>
                               <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                               <span>{new Date(inv.date).toLocaleDateString()}</span>
                             </p>
                           </div>
                           <div className="text-right">
                             <p className="font-bold text-[#1c2938] text-lg">{currencySymbol} {inv.total.toFixed(2)}</p>
                             <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${
                                inv.status === 'Paid' ? 'bg-green-50 text-green-600' : 
                                inv.status === 'Sent' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-500'
                             }`}>
                               {inv.status}
                             </span>
                           </div>
                        </div>
                      ))}
                    </div>
                 ) : (
                   <div className="text-center py-12">
                     <p className="text-slate-500 font-medium">No hay facturas en este estado.</p>
                   </div>
                 )}
              </div>
           </div>
         </div>
      )}

      {/* DEEP DIVE REPORT MODAL */}
      {deepDiveReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1c2938]/60 backdrop-blur-md animate-in fade-in">
           <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in slide-in-from-bottom-12 duration-500 flex flex-col max-h-[90vh]">
              
              {/* Report Header */}
              <div className="p-8 border-b border-slate-100 bg-[#FAFAFA] relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-[#27bea5] rounded-full blur-[80px] opacity-10 -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                 <div className="flex justify-between items-start relative z-10">
                    <div className="flex items-center gap-4">
                       <div className="p-3 bg-white shadow-sm rounded-xl text-[#1c2938]">
                          <FileText className="w-8 h-8" />
                       </div>
                       <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Reporte Ejecutivo</p>
                          <h2 className="text-2xl font-bold text-[#1c2938]">{deepDiveReport.chartTitle}</h2>
                          <p className="text-xs text-slate-500 mt-1 font-medium">Periodo: {timeRange === 'CUSTOM' ? `${customStart} - ${customEnd}` : timeRange}</p>
                       </div>
                    </div>
                    <button onClick={() => setDeepDiveReport(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                      <X className="w-6 h-6" />
                    </button>
                 </div>
              </div>

              {/* Report Body */}
              <div className="p-8 overflow-y-auto space-y-8">
                 {/* Executive Summary */}
                 <section>
                    <h3 className="text-lg font-bold text-[#1c2938] mb-3 flex items-center gap-2">
                       <Activity className="w-5 h-5 text-[#27bea5]" /> Resumen Ejecutivo
                    </h3>
                    <p className="text-slate-600 leading-relaxed text-lg bg-slate-50 p-4 rounded-2xl border border-slate-100">
                       {deepDiveReport.executiveSummary}
                    </p>
                 </section>

                 {/* Key Metrics Grid */}
                 <section>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Métricas Clave</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                       {deepDiveReport.keyMetrics.map((metric, idx) => (
                          <div key={idx} className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm">
                             <p className="text-xs text-slate-500 mb-1">{metric.label}</p>
                             <div className="flex items-end gap-2">
                                <span className="text-xl font-bold text-[#1c2938]">{metric.value}</span>
                                {metric.trend === 'up' && <ArrowRight className="w-4 h-4 text-green-500 rotate-[-45deg] mb-1" />}
                                {metric.trend === 'down' && <ArrowRight className="w-4 h-4 text-red-500 rotate-[45deg] mb-1" />}
                                {metric.trend === 'neutral' && <ArrowRight className="w-4 h-4 text-slate-400 mb-1" />}
                             </div>
                          </div>
                       ))}
                    </div>
                 </section>

                 {/* Strategic Insight */}
                 <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-[#1c2938] p-6 rounded-2xl text-white relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-20 h-20 bg-[#27bea5] rounded-full blur-[40px] opacity-20"></div>
                       <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                          <Target className="w-5 h-5 text-[#27bea5]" /> Insight Estratégico
                       </h3>
                       <p className="text-slate-300 font-light text-sm leading-relaxed">
                          {deepDiveReport.strategicInsight}
                       </p>
                    </div>

                    <div className="bg-[#27bea5]/10 p-6 rounded-2xl border border-[#27bea5]/20">
                       <h3 className="font-bold text-lg mb-2 text-[#27bea5] flex items-center gap-2">
                          <Lightbulb className="w-5 h-5" /> Recomendación
                       </h3>
                       <p className="text-[#1c2938] text-sm leading-relaxed">
                          {deepDiveReport.recommendation}
                       </p>
                    </div>
                 </section>
              </div>

              {/* Actions Footer */}
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-4">
                 {!showShareOptions ? (
                   <>
                      <button className="flex-1 py-3 px-4 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-white hover:border-[#27bea5] transition-all flex items-center justify-center gap-2">
                         <Download className="w-5 h-5" /> Exportar PDF
                      </button>
                      <button 
                        onClick={() => setShowShareOptions(true)}
                        className="flex-1 py-3 px-4 rounded-xl bg-[#27bea5] text-white font-bold hover:bg-[#22a890] transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-200/50"
                      >
                         <Share2 className="w-5 h-5" /> Compartir Reporte
                      </button>
                   </>
                 ) : (
                   <div className="w-full animate-in slide-in-from-bottom-2 flex gap-3">
                      <button onClick={() => setShowShareOptions(false)} className="p-3 bg-slate-200 rounded-xl text-slate-600">
                         <X className="w-5 h-5" />
                      </button>
                      <button className="flex-1 bg-[#25D366] text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#20bd5a]">
                         <MessageCircle className="w-5 h-5" /> WhatsApp
                      </button>
                      <button className="flex-1 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700">
                         <Mail className="w-5 h-5" /> Email
                      </button>
                   </div>
                 )}
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

// Helper for icon
function MousePointer2(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg 
      {...props} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M4.031 9.894a1 1 0 0 1 .162-1.338l7.463-6.255a1 1 0 0 1 1.62.903v2.793c2.72.062 6.726.853 6.726 8.003 0 0-2.813-4.225-6.726-4.225v2.859a1 1 0 0 1-1.62.903L4.193 11.232a1 1 0 0 1-.162-1.338z"/>
    </svg>
  );
}

export default ReportsDashboard;
