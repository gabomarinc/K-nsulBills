
import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area, ScatterChart, Scatter
} from 'recharts';
import { 
  Sparkles, TrendingUp, Loader2, 
  BrainCircuit, Activity, Target, Lightbulb,
  X, TrendingDown, Wallet, FileText,
  LayoutDashboard, FileBarChart, Users, Funnel
} from 'lucide-react';
import { Invoice, FinancialAnalysisResult, DeepDiveReport } from '../types';
import { generateFinancialAnalysis, generateDeepDiveReport } from '../services/geminiService';

interface ReportsDashboardProps {
  invoices: Invoice[];
  currencySymbol: string;
  apiKey?: { gemini?: string; openai?: string };
}

type TimeRange = '30D' | '90D' | '12M';
type ReportTab = 'OVERVIEW' | 'DOCUMENTS' | 'CLIENTS';

const ReportsDashboard: React.FC<ReportsDashboardProps> = ({ invoices, currencySymbol, apiKey }) => {
  // Navigation State
  const [activeTab, setActiveTab] = useState<ReportTab>('OVERVIEW');

  // AI State
  const [analysis, setAnalysis] = useState<FinancialAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Filter State - Default to 12M
  const [timeRange, setTimeRange] = useState<TimeRange>('12M');

  // Deep Dive Report State
  const [deepDiveReport, setDeepDiveReport] = useState<DeepDiveReport | null>(null);
  const [isDeepDiving, setIsDeepDiving] = useState<string | null>(null);

  // --- HELPER: Number Formatter for Charts (Anti-Overlap) ---
  const compactNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      notation: "compact",
      maximumFractionDigits: 1
    }).format(num);
  };

  // --- 1. FILTER LOGIC ---
  const filteredInvoices = useMemo(() => {
    const now = new Date();
    const startDate = new Date();

    if (timeRange === '30D') {
      startDate.setDate(now.getDate() - 30);
    } else if (timeRange === '90D') {
      startDate.setDate(now.getDate() - 90);
    } else if (timeRange === '12M') {
      startDate.setDate(now.getDate() - 365);
    } 

    return invoices.filter(inv => {
      const d = new Date(inv.date);
      return d >= startDate;
    });
  }, [invoices, timeRange]);

  // --- 2. DATA AGGREGATION ---
  const data = useMemo(() => {
    // --- GLOBAL: Timeline ---
    const timelineMap = new Map<string, { ingresos: number, gastos: number, date: Date }>();
    filteredInvoices.forEach(inv => {
      const d = new Date(inv.date);
      // Group by Month-Year for 12M/90D, or Day-Month for 30D could be an improvement, keeping simple for now
      const key = d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
      
      if (!timelineMap.has(key)) timelineMap.set(key, { ingresos: 0, gastos: 0, date: d });
      const entry = timelineMap.get(key)!;

      if (inv.type === 'Invoice' && (inv.status === 'Aceptada' || inv.status === 'Enviada')) {
        entry.ingresos += inv.total;
      } else if (inv.type === 'Expense') {
        entry.gastos += inv.total;
      }
    });

    const monthlyData = Array.from(timelineMap.entries())
      .map(([name, val]) => ({ name, ingresos: val.ingresos, gastos: val.gastos, _date: val.date }))
      .sort((a, b) => a._date.getTime() - b._date.getTime());

    // --- DOCUMENTS TAB: Funnel & Scatter ---
    const funnelData = [
      { name: 'Creados', value: filteredInvoices.length, fill: '#94a3b8' },
      { name: 'Enviados', value: filteredInvoices.filter(i => i.status !== 'Borrador' && i.status !== 'Creada').length, fill: '#3b82f6' },
      { name: 'Negociación', value: filteredInvoices.filter(i => ['Negociacion', 'Seguimiento', 'Aceptada', 'Rechazada'].includes(i.status)).length, fill: '#a855f7' },
      { name: 'Ganados', value: filteredInvoices.filter(i => i.status === 'Aceptada').length, fill: '#27bea5' },
    ];

    // Scatter: Effort (Items count) vs Reward (Total Amount)
    const scatterData = filteredInvoices
      .filter(i => i.type === 'Invoice' || i.type === 'Quote')
      .map(i => ({
        id: i.id,
        x: i.items.length, 
        y: i.total,
        z: 1, 
        status: i.status
      }));

    // --- CLIENTS TAB: LTV & ROI ---
    const clientMap = new Map<string, { revenue: number, count: number }>();
    filteredInvoices.forEach(inv => {
      if (!clientMap.has(inv.clientName)) clientMap.set(inv.clientName, { revenue: 0, count: 0 });
      const c = clientMap.get(inv.clientName)!;
      c.count++;
      if (inv.status === 'Aceptada' && inv.type === 'Invoice') {
        c.revenue += inv.total;
      }
    });

    const ltvData = Array.from(clientMap.entries())
      .map(([name, val]) => ({ name, revenue: val.revenue, count: val.count }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 7); // Top 7 clients

    const clientVsProspect = [
      { name: 'Clientes', value: ltvData.filter(c => c.revenue > 0).length, color: '#27bea5' },
      { name: 'Prospectos', value: Array.from(clientMap.values()).filter(c => c.revenue === 0).length, color: '#a855f7' },
    ];

    return { monthlyData, funnelData, scatterData, ltvData, clientVsProspect };
  }, [filteredInvoices]);


  // --- HANDLERS ---
  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    const totalRevenue = data.monthlyData.reduce((acc, curr) => acc + curr.ingresos, 0);
    const summary = `Periodo: ${timeRange}. Ingresos: ${currencySymbol}${totalRevenue}. Docs: ${filteredInvoices.length}`;
    const result = await generateFinancialAnalysis(summary, apiKey);
    setAnalysis(result);
    setIsAnalyzing(false);
  };

  const handleDeepDive = async (chartId: string, chartTitle: string, chartData: any) => {
    setIsDeepDiving(chartId);
    setDeepDiveReport(null);
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

  // --- RENDERERS ---

  const renderOverview = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4">
        {/* Card: Cash Flow */}
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-50 hover:shadow-md transition-shadow">
           <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-bold text-[#1c2938] text-xl flex items-center gap-2">
                  <div className="p-2 bg-slate-50 rounded-xl text-[#27bea5]">
                    <Wallet className="w-5 h-5" />
                  </div>
                  Flujo de Caja
                </h3>
              </div>
              <button onClick={() => handleDeepDive('cashflow', 'Flujo de Caja', data.monthlyData)} disabled={isDeepDiving === 'cashflow'} className="p-3 rounded-xl bg-slate-50 hover:text-[#27bea5] transition-all">
                {isDeepDiving === 'cashflow' ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
              </button>
           </div>
           <div className="h-72 w-full">
             <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={data.monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                   <XAxis 
                     dataKey="name" 
                     axisLine={false} 
                     tickLine={false} 
                     fontSize={11} 
                     stroke="#94a3b8" 
                     dy={10} 
                     interval="preserveStartEnd"
                   />
                   <YAxis 
                     axisLine={false} 
                     tickLine={false} 
                     fontSize={11} 
                     stroke="#94a3b8" 
                     tickFormatter={compactNumber}
                     width={40}
                   />
                   <Tooltip 
                     cursor={{ fill: '#f8fafc' }} 
                     contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                   />
                   <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                   <Bar dataKey="ingresos" name="Ingresos" fill="#27bea5" radius={[6, 6, 0, 0]} barSize={24} />
                   <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[6, 6, 0, 0]} barSize={24} />
                 </BarChart>
               </ResponsiveContainer>
           </div>
        </div>

        {/* Card: Trends */}
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-50 hover:shadow-md transition-shadow">
           <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-bold text-[#1c2938] text-xl flex items-center gap-2">
                  <div className="p-2 bg-slate-50 rounded-xl text-blue-500">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  Tendencia
                </h3>
              </div>
           </div>
           <div className="h-72 w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={data.monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                   <defs>
                     <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="#27bea5" stopOpacity={0.15}/>
                       <stop offset="95%" stopColor="#27bea5" stopOpacity={0}/>
                     </linearGradient>
                   </defs>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                   <XAxis 
                     dataKey="name" 
                     axisLine={false} 
                     tickLine={false} 
                     fontSize={11} 
                     stroke="#94a3b8" 
                     dy={10} 
                     interval="preserveStartEnd"
                   />
                   <YAxis 
                     axisLine={false} 
                     tickLine={false} 
                     fontSize={11} 
                     stroke="#94a3b8" 
                     tickFormatter={compactNumber}
                     width={40}
                   />
                   <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                   <Area type="monotone" dataKey="ingresos" stroke="#27bea5" strokeWidth={3} fillOpacity={1} fill="url(#colorIngresos)" />
                 </AreaChart>
               </ResponsiveContainer>
           </div>
        </div>
    </div>
  );

  const renderDocumentsView = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4">
        {/* Funnel Chart */}
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-50 hover:shadow-md transition-shadow">
           <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-bold text-[#1c2938] text-xl flex items-center gap-2">
                  <div className="p-2 bg-slate-50 rounded-xl text-indigo-500">
                    <Funnel className="w-5 h-5" />
                  </div>
                  Embudo
                </h3>
                <p className="text-slate-400 text-sm mt-1 ml-11">Conversión Documental</p>
              </div>
           </div>
           <div className="h-72 w-full">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={data.funnelData} layout="vertical" margin={{ left: 0, right: 10 }}>
                 <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                 <XAxis type="number" hide />
                 <YAxis 
                   dataKey="name" 
                   type="category" 
                   width={110} 
                   tick={{fontSize: 11, fontWeight: 600, fill: '#64748b'}} 
                   axisLine={false} 
                   tickLine={false} 
                 />
                 <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                 <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={36}>
                   {data.funnelData.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={entry.fill} />
                   ))}
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>

        {/* Scatter Plot */}
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-50 hover:shadow-md transition-shadow">
           <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-bold text-[#1c2938] text-xl flex items-center gap-2">
                  <div className="p-2 bg-slate-50 rounded-xl text-rose-500">
                    <Activity className="w-5 h-5" />
                  </div>
                  Esfuerzo vs. Resultado
                </h3>
                <p className="text-slate-400 text-sm mt-1 ml-11">Ítems vs Monto</p>
              </div>
           </div>
           <div className="h-72 w-full">
             <ResponsiveContainer width="100%" height="100%">
               <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" />
                 <XAxis type="number" dataKey="x" name="Ítems" unit="" tick={{fontSize: 11}} />
                 <YAxis 
                   type="number" 
                   dataKey="y" 
                   name="Monto" 
                   tick={{fontSize: 11}} 
                   tickFormatter={compactNumber} 
                   width={40}
                 />
                 <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                 <Scatter name="Documentos" data={data.scatterData} fill="#8884d8">
                    {data.scatterData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.status === 'Aceptada' ? '#27bea5' : '#94a3b8'} />
                    ))}
                 </Scatter>
               </ScatterChart>
             </ResponsiveContainer>
           </div>
        </div>
    </div>
  );

  const renderClientsView = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4">
       {/* LTV Chart */}
       <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-50 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-6">
             <div>
               <h3 className="font-bold text-[#1c2938] text-xl flex items-center gap-2">
                 <div className="p-2 bg-slate-50 rounded-xl text-amber-500">
                   <Users className="w-5 h-5" />
                 </div>
                 Top Clientes (LTV)
               </h3>
             </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
               <BarChart data={data.ltvData} margin={{ top: 20, left: 0, right: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fill: '#64748b'}} 
                    interval={0} 
                    tickFormatter={(val) => val.length > 8 ? val.slice(0, 8) + '..' : val}
                  />
                  <YAxis hide />
                  <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                  <Bar dataKey="revenue" fill="#f59e0b" radius={[8, 8, 0, 0]} barSize={36} />
               </BarChart>
            </ResponsiveContainer>
          </div>
       </div>

       {/* Client vs Prospect */}
       <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-50 hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
             <div>
               <h3 className="font-bold text-[#1c2938] text-xl flex items-center gap-2">
                 <div className="p-2 bg-slate-50 rounded-xl text-emerald-500">
                   <Target className="w-5 h-5" />
                 </div>
                 Cartera
               </h3>
             </div>
          </div>
          <div className="h-64 w-full relative">
             <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.clientVsProspect}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {data.clientVsProspect.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                  <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
                </PieChart>
             </ResponsiveContainer>
             <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none pr-24">
                <p className="text-3xl font-bold text-[#1c2938]">{data.ltvData.length}</p>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total</p>
             </div>
          </div>
       </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in pb-12">
      
      {/* HEADER */}
      <div className="flex flex-col xl:flex-row justify-between items-end xl:items-center gap-6 border-b border-slate-100 pb-6">
        <div>
           <h1 className="text-3xl font-bold text-[#1c2938] tracking-tight">Centro de Inteligencia</h1>
           <p className="text-slate-500 mt-1 text-lg font-light">
             Análisis de <span className="font-medium text-[#27bea5]">{filteredInvoices.length} documentos</span>
           </p>
        </div>

        <div className="flex items-center gap-4">
           {/* Date Filter - RESTORED CAPSULE STYLE */}
           <div className="flex bg-slate-100 p-1.5 rounded-2xl shadow-sm">
             {(['30D', '90D', '12M'] as TimeRange[]).map((range) => (
               <button
                 key={range}
                 onClick={() => setTimeRange(range)}
                 className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${
                   timeRange === range 
                     ? 'bg-white text-[#1c2938] shadow-sm scale-105' 
                     : 'text-slate-400 hover:text-slate-600'
                 }`}
               >
                 {range}
               </button>
             ))}
           </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex justify-center w-full">
         <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 flex overflow-x-auto max-w-full custom-scrollbar">
            {(['OVERVIEW', 'DOCUMENTS', 'CLIENTS'] as const).map(tab => (
               <button
                 key={tab}
                 onClick={() => setActiveTab(tab)}
                 className={`px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap flex items-center gap-2 ${
                   activeTab === tab 
                     ? 'text-white bg-[#1c2938] shadow-md' 
                     : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                 }`}
               >
                 {tab === 'OVERVIEW' && <LayoutDashboard className="w-4 h-4" />}
                 {tab === 'DOCUMENTS' && <FileBarChart className="w-4 h-4" />}
                 {tab === 'CLIENTS' && <Users className="w-4 h-4" />}
                 {tab === 'OVERVIEW' ? 'Visión General' : tab === 'DOCUMENTS' ? 'Pulso Documental' : 'Inteligencia Clientes'}
               </button>
            ))}
         </div>
      </div>

      {/* VIRTUAL CFO (Global Context) */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-[#1c2938] shadow-2xl text-white group p-8 md:p-10">
         <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#27bea5] rounded-full blur-[150px] opacity-10 -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
         
         <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-4">
               <div className="p-3.5 bg-white/10 rounded-2xl text-[#27bea5] backdrop-blur-sm shadow-inner border border-white/5">
                 <BrainCircuit className="w-8 h-8" />
               </div>
               <div>
                 <h2 className="text-2xl font-bold tracking-tight">CFO Virtual</h2>
                 <p className="text-slate-400 font-light">Análisis en tiempo real con IA</p>
               </div>
            </div>
            {!analysis && (
              <button onClick={handleAnalyze} disabled={isAnalyzing} className="bg-[#27bea5] hover:bg-[#22a890] text-white px-8 py-3.5 rounded-2xl font-bold transition-all shadow-lg flex items-center gap-3">
                {isAnalyzing ? <Loader2 className="animate-spin w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                {isAnalyzing ? 'Analizando...' : 'Generar Reporte'}
              </button>
            )}
         </div>

         {/* AI Results */}
         {analysis && (
            <div className="animate-in fade-in slide-in-from-bottom-4 mt-8 pt-8 border-t border-white/10 grid grid-cols-1 lg:grid-cols-12 gap-8">
               <div className="lg:col-span-4 bg-white/5 rounded-[2rem] p-6 text-center border border-white/10">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Salud Financiera</p>
                  <div className={`text-6xl font-bold mb-2 ${getScoreColor(analysis.healthScore).split(' ')[0]}`}>{analysis.healthScore}</div>
                  <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-bold uppercase">{analysis.healthStatus}</span>
               </div>
               <div className="lg:col-span-8 space-y-4">
                  <p className="text-lg text-slate-200 font-light leading-relaxed">"{analysis.diagnosis}"</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {analysis.actionableTips.map((tip, i) => (
                        <div key={i} className="flex gap-3 bg-white/5 p-4 rounded-xl border border-white/5">
                           <Lightbulb className="w-5 h-5 text-amber-400 flex-shrink-0" />
                           <p className="text-sm text-slate-300">{tip}</p>
                        </div>
                     ))}
                  </div>
               </div>
            </div>
         )}
      </div>

      {/* CONTENT SWITCHER */}
      {activeTab === 'OVERVIEW' && renderOverview()}
      {activeTab === 'DOCUMENTS' && renderDocumentsView()}
      {activeTab === 'CLIENTS' && renderClientsView()}

      {/* DRILL DOWN MODAL */}
      {deepDiveReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1c2938]/60 backdrop-blur-md animate-in fade-in">
           <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in slide-in-from-bottom-12 duration-500 flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-slate-100 bg-[#FAFAFA] flex justify-between items-center">
                 <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Reporte Profundo</p>
                    <h2 className="text-2xl font-bold text-[#1c2938]">{deepDiveReport.chartTitle}</h2>
                 </div>
                 <button onClick={() => setDeepDiveReport(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-8 overflow-y-auto space-y-6 custom-scrollbar">
                 <p className="text-lg text-slate-600 leading-relaxed bg-slate-50 p-6 rounded-2xl border border-slate-100">{deepDiveReport.executiveSummary}</p>
                 
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {deepDiveReport.keyMetrics.map((metric, idx) => (
                       <div key={idx} className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm">
                          <p className="text-xs text-slate-500 mb-1">{metric.label}</p>
                          <div className="flex items-end gap-2">
                             <span className="text-xl font-bold text-[#1c2938]">{metric.value}</span>
                             {metric.trend === 'up' && <TrendingUp className="w-4 h-4 text-green-500" />}
                             {metric.trend === 'down' && <TrendingDown className="w-4 h-4 text-red-500" />}
                          </div>
                       </div>
                    ))}
                 </div>
                 
                 <div className="bg-[#1c2938] p-6 rounded-2xl text-white">
                    <h3 className="font-bold text-lg mb-2 flex items-center gap-2"><Target className="w-5 h-5 text-[#27bea5]" /> Insight Estratégico</h3>
                    <p className="text-slate-300 font-light text-sm">{deepDiveReport.strategicInsight}</p>
                 </div>
                 <div className="bg-[#27bea5]/10 p-6 rounded-2xl border border-[#27bea5]/20 text-[#1c2938]">
                    <h3 className="font-bold text-lg mb-2 text-[#27bea5] flex items-center gap-2"><Lightbulb className="w-5 h-5" /> Recomendación</h3>
                    <p className="text-sm">{deepDiveReport.recommendation}</p>
                 </div>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default ReportsDashboard;
