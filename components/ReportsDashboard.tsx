import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell
} from 'recharts';
import { 
  Sparkles, TrendingUp, Loader2, 
  BrainCircuit, Activity, Target, Lightbulb,
  X, TrendingDown, Wallet,
  LayoutDashboard, FileBarChart, Users, Filter, Calendar, Download, Mail, CheckCircle2,
  Clock, AlertTriangle, FileText, Lock, ArrowRight, Table, Scale, Landmark, Calculator, PiggyBank, ShieldCheck, XCircle, RefreshCw, ChevronDown, ChevronRight, Package, Tag
} from 'lucide-react';
import { Invoice, FinancialAnalysisResult, DeepDiveReport, UserProfile, InvoiceStatus } from '../types';
import { generateFinancialAnalysis, generateDeepDiveReport, AI_ERROR_BLOCKED } from '../services/geminiService';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface ReportsDashboardProps {
  invoices: Invoice[];
  currencySymbol: string;
  apiKey?: { gemini?: string; openai?: string };
  currentUser?: UserProfile;
}

type TimeRange = 'THIS_MONTH' | 'LAST_QUARTER' | 'THIS_YEAR' | 'CUSTOM';
type ReportTab = 'OVERVIEW' | 'DOCUMENTS' | 'CLIENTS' | 'FISCAL';

const ReportsDashboard = ({ invoices, currencySymbol, apiKey, currentUser }: ReportsDashboardProps) => {
  const [activeTab, setActiveTab] = useState<ReportTab>('OVERVIEW');
  const [analysis, setAnalysis] = useState<FinancialAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const hasAiAccess = !!apiKey?.gemini || !!apiKey?.openai;

  const [isExporting, setIsExporting] = useState<string | null>(null);
  const overviewRef = useRef<HTMLDivElement>(null);
  const documentsRef = useRef<HTMLDivElement>(null);
  const clientsRef = useRef<HTMLDivElement>(null);
  const fiscalRef = useRef<HTMLDivElement>(null); 
  const deepDiveRef = useRef<HTMLDivElement>(null); 
  const analysisRef = useRef<HTMLDivElement>(null); 

  const [timeRange, setTimeRange] = useState<TimeRange>('THIS_YEAR');
  const [customStart, setCustomStart] = useState<string>(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [customEnd, setCustomEnd] = useState<string>(new Date().toISOString().split('T')[0]);

  const [deepDiveReport, setDeepDiveReport] = useState<DeepDiveReport | null>(null);
  const [deepDiveVisual, setDeepDiveVisual] = useState<{ type: string, data: any, title: string } | null>(null);
  const [deepDiveAiData, setDeepDiveAiData] = useState<any>(null); 
  const [isDeepDiving, setIsDeepDiving] = useState<string | null>(null); 
  const [deepDiveError, setDeepDiveError] = useState(false); 

  const compactNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(num);
  };

  const handleExportPdf = async (ref: React.RefObject<HTMLDivElement>, title: string) => {
    if (!ref.current) return;
    setIsExporting('pdf');
    try {
      const canvas = await html2canvas(ref.current, { scale: 2, useCORS: true, backgroundColor: '#FFFFFF' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
      pdf.save(`${title}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (e) { console.error(e); }
    setIsExporting(null);
  };

  const filteredInvoices = useMemo(() => {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date(); 

    if (timeRange === 'THIS_MONTH') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (timeRange === 'LAST_QUARTER') {
      startDate = new Date();
      startDate.setMonth(now.getMonth() - 3);
    } else if (timeRange === 'THIS_YEAR') {
      startDate = new Date(now.getFullYear(), 0, 1);
    } else if (timeRange === 'CUSTOM') {
      startDate = new Date(customStart + 'T00:00:00');
      endDate = new Date(customEnd + 'T23:59:59');
    }

    if (timeRange !== 'CUSTOM') {
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
    }

    return invoices.filter(inv => {
      const d = new Date(inv.date);
      return d >= startDate && d <= endDate;
    });
  }, [invoices, timeRange, customStart, customEnd]);

  const data = useMemo(() => {
    const timelineMap = new Map<string, { ingresos: number, gastos: number, date: Date }>();
    const productStatsMap = new Map<string, { name: string, totalRevenue: number, count: number }>();
    let totalRevenue = 0; let totalExpenses = 0; let paymentDaysSum = 0; let paidInvoicesCount = 0;
    
    filteredInvoices.forEach(inv => {
      const d = new Date(inv.date);
      const key = d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
      if (!timelineMap.has(key)) timelineMap.set(key, { ingresos: 0, gastos: 0, date: d });
      const entry = timelineMap.get(key)!;
      
      if (inv.type === 'Invoice') {
        let collected = 0;
        if (inv.amountPaid && inv.amountPaid > 0) collected = inv.amountPaid;
        else if (inv.status === 'Pagada' || inv.status === 'Aceptada') collected = inv.total;
        if (collected > 0) { entry.ingresos += collected; totalRevenue += collected; }
        if (inv.status !== 'Borrador' && inv.status !== 'Rechazada') {
            inv.items.forEach(item => {
                const pKey = item.description.trim();
                if (!productStatsMap.has(pKey)) productStatsMap.set(pKey, { name: pKey, totalRevenue: 0, count: 0 });
                const pStat = productStatsMap.get(pKey)!;
                pStat.totalRevenue += (item.price * item.quantity);
                pStat.count += item.quantity;
            });
        }
      } else if (inv.type === 'Expense') { entry.gastos += inv.total; totalExpenses += inv.total; }
    });

    const monthlyData = Array.from(timelineMap.entries()).map(([name, val]) => ({ name, ingresos: val.ingresos, gastos: val.gastos, _date: val.date })).sort((a, b) => a._date.getTime() - b._date.getTime());
    const productSalesData = Array.from(productStatsMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
    const netMargin = totalRevenue - totalExpenses;
    const marginPercent = totalRevenue > 0 ? (netMargin / totalRevenue) * 100 : 0;
    
    // --- REAL FUNNEL 1: INVOICES (COBRO) ---
    const invoicesOnly = filteredInvoices.filter(i => i.type === 'Invoice');
    const invSent = invoicesOnly.filter(i => i.status === 'Enviada').length;
    const invSeguimiento = invoicesOnly.filter(i => i.status === 'Seguimiento' || i.timeline?.some(e => e.type === 'OPENED')).length;
    const invAbonada = invoicesOnly.filter(i => i.status === 'Abonada').length;
    const invPagada = invoicesOnly.filter(i => i.status === 'Pagada' || i.status === 'Aceptada').length;
    const invIncobrable = invoicesOnly.filter(i => i.status === 'Incobrable').length;

    const invoiceFunnelData = [ 
        { name: 'Enviada', value: invSent, fill: '#0ea5e9' }, 
        { name: 'Seguimiento', value: invSeguimiento, fill: '#3b82f6' }, 
        { name: 'Abonada', value: invAbonada, fill: '#6366f1' }, 
        { name: 'Pagada', value: invPagada, fill: '#27bea5' }, 
        { name: 'Incobrable', value: invIncobrable, fill: '#ef4444' }, 
    ];

    // --- REAL FUNNEL 2: QUOTES (VENTAS) ---
    const quotesOnly = filteredInvoices.filter(i => i.type === 'Quote');
    const qEnviada = quotesOnly.filter(q => q.status === 'Enviada').length;
    const qNegociacion = quotesOnly.filter(q => q.status === 'Negociacion' || q.timeline?.some(e => e.type === 'OPENED')).length;
    const qAceptada = quotesOnly.filter(q => q.status === 'Aceptada').length;
    const qRechazada = quotesOnly.filter(q => q.status === 'Rechazada').length;

    const quoteFunnelData = [
        { name: 'Enviada', value: qEnviada, fill: '#0ea5e9' }, 
        { name: 'Negociacion', value: qNegociacion, fill: '#a855f7' }, 
        { name: 'Aceptada', value: qAceptada, fill: '#27bea5' }, 
        { name: 'Rechazada', value: qRechazada, fill: '#ef4444' }, 
    ];

    const clientMap = new Map<string, { revenue: number, count: number, lastDate: Date }>();
    const now = new Date();
    filteredInvoices.forEach(inv => { 
        if (!clientMap.has(inv.clientName)) clientMap.set(inv.clientName, { revenue: 0, count: 0, lastDate: new Date(0) }); 
        const c = clientMap.get(inv.clientName)!; 
        if (new Date(inv.date) > c.lastDate) c.lastDate = new Date(inv.date); 
        if (inv.type === 'Invoice') { c.count++; c.revenue += (inv.amountPaid || (inv.status === 'Pagada' ? inv.total : 0)); } 
    });
    const ltvData = Array.from(clientMap.entries()).map(([name, val]) => ({ name, revenue: val.revenue, count: val.count, daysSinceLast: Math.floor((now.getTime() - val.lastDate.getTime()) / (1000 * 3600 * 24)) })).sort((a, b) => b.revenue - a.revenue);
    
    return { monthlyData, productSalesData, invoiceFunnelData, quoteFunnelData, ltvData, kpis: { totalRevenue, totalExpenses, netMargin, marginPercent } };
  }, [filteredInvoices]);

  const fiscalData = useMemo(() => {
    if (!currentUser?.fiscalConfig) return null;
    let debitFiscal = 0; let creditFiscal = 0; let withholdings = 0;
    filteredInvoices.forEach(inv => {
      if (inv.type === 'Invoice' && inv.status !== 'Borrador' && inv.status !== 'Rechazada') {
        debitFiscal += inv.items.reduce((sum, item) => sum + (item.price * item.quantity * (item.tax / 100)), 0);
        if (inv.withholdingAmount) withholdings += inv.withholdingAmount;
      } else if (inv.type === 'Expense') {
        if (inv.expenseDeductibility !== 'NONE' && inv.isValidFiscalDoc !== false) creditFiscal += (inv.total - (inv.total / 1.07));
      }
    });
    const payable = debitFiscal - creditFiscal - withholdings;
    return { debitFiscal, creditFiscal, withholdings, payable, isCreditBalance: payable < 0 };
  }, [filteredInvoices, currentUser]);

  const handleAnalyze = async () => {
    if (!hasAiAccess) return;
    setIsAnalyzing(true);
    try {
        const result = await generateFinancialAnalysis(`Resumen: ${data.kpis.totalRevenue} cobrado, ${data.kpis.totalExpenses} gastos.`, apiKey);
        if (result) setAnalysis(result);
    } catch (e) { setAiError("Error en IA"); } finally { setIsAnalyzing(false); }
  };

  const handleDeepDive = async (chartId: string, chartTitle: string, chartData: any) => {
    setIsDeepDiving(chartId);
    setDeepDiveReport(null);
    setDeepDiveVisual({ type: chartId, data: chartData, title: chartTitle });
    setDeepDiveAiData(chartData);
    if (hasAiAccess) {
        const report = await generateDeepDiveReport(chartTitle, JSON.stringify(chartData), apiKey);
        if (report) setDeepDiveReport(report);
    }
    setIsDeepDiving(null);
  };

  const renderOverview = () => (
    <div ref={overviewRef} className="space-y-8 animate-in fade-in">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
           <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Ingreso Neto</p>
              <h3 className="text-2xl font-bold text-[#1c2938]">{currencySymbol}{data.kpis.totalRevenue.toLocaleString()}</h3>
           </div>
           <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Margen Real</p>
              <h3 className={`text-2xl font-bold ${data.kpis.marginPercent > 0 ? 'text-[#27bea5]' : 'text-rose-500'}`}>{data.kpis.marginPercent.toFixed(1)}%</h3>
           </div>
           <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Gastos</p>
              <h3 className="text-2xl font-bold text-rose-500">-{currencySymbol}{data.kpis.totalExpenses.toLocaleString()}</h3>
           </div>
           <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Utilidad</p>
              <h3 className="text-2xl font-bold text-[#1c2938]">{currencySymbol}{data.kpis.netMargin.toLocaleString()}</h3>
           </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-50">
              <div className="flex justify-between items-start mb-6">
                  <h3 className="font-bold text-[#1c2938] text-xl flex items-center gap-3"><Wallet className="text-[#27bea5]" /> Flujo de Caja Real</h3>
                  <button onClick={() => handleDeepDive('cashflow', 'Flujo de Caja', data.monthlyData)} className="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-[#27bea5] transition-all"><FileText className="w-5 h-5" /></button>
              </div>
              <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.monthlyData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name"/><YAxis tickFormatter={compactNumber}/><Tooltip/><Bar dataKey="ingresos" fill="#27bea5" radius={[4,4,0,0]}/><Bar dataKey="gastos" fill="#ef4444" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-50">
              <div className="flex justify-between items-start mb-6">
                  <h3 className="font-bold text-[#1c2938] text-xl flex items-center gap-3"><Package className="text-blue-500" /> Ventas por Producto</h3>
                  <button onClick={() => handleDeepDive('products', 'Ventas por Producto', data.productSalesData)} className="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-blue-500 transition-all"><FileText className="w-5 h-5" /></button>
              </div>
              <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.productSalesData.slice(0,5)} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={true}/><XAxis type="number" hide/><YAxis dataKey="name" type="category" width={100}/><Tooltip/><Bar dataKey="totalRevenue" fill="#3b82f6" radius={[0,4,4,0]}/></BarChart></ResponsiveContainer></div>
            </div>
        </div>
    </div>
  );

  const renderDocumentsView = () => (
    <div ref={documentsRef} className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-50 shadow-sm">
            <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-xl flex items-center gap-2 text-[#1c2938]"><Filter className="w-5 h-5 text-indigo-500"/> Embudo de Cobro (Facturas)</h3>
                <button onClick={() => handleDeepDive('invoiceFunnel', 'Embudo de Cobro', data.invoiceFunnelData)} className="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-indigo-500 transition-all"><FileText className="w-5 h-5" /></button>
            </div>
            <p className="text-slate-400 text-xs mb-6 uppercase tracking-widest font-bold">Ciclo: Enviada → Seguimiento → Abonada → Pagada → Incobrable</p>
            <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.invoiceFunnelData} layout="vertical"><XAxis type="number" hide/><YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10, fontWeight: 700}}/><Tooltip/><Bar dataKey="value" barSize={30} radius={[0,6,6,0]}>{data.invoiceFunnelData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}</Bar></BarChart></ResponsiveContainer></div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-50 shadow-sm">
            <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-xl flex items-center gap-2 text-[#1c2938]"><Target className="w-5 h-5 text-purple-500"/> Embudo de Ventas (Cotizaciones)</h3>
                <button onClick={() => handleDeepDive('quoteFunnel', 'Embudo de Ventas', data.quoteFunnelData)} className="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-purple-500 transition-all"><FileText className="w-5 h-5" /></button>
            </div>
            <p className="text-slate-400 text-xs mb-6 uppercase tracking-widest font-bold">Ciclo: Enviada → Negociación → Aceptada → Rechazada</p>
            <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.quoteFunnelData} layout="vertical"><XAxis type="number" hide/><YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10, fontWeight: 700}}/><Tooltip/><Bar dataKey="value" barSize={30} radius={[0,6,6,0]}>{data.quoteFunnelData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}</Bar></BarChart></ResponsiveContainer></div>
        </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in pb-12">
      <div className="flex flex-col xl:flex-row justify-between items-end xl:items-center gap-6">
        <div>
           <h1 className="text-3xl font-bold text-[#1c2938] tracking-tight">Centro de Inteligencia</h1>
           <p className="text-slate-500 mt-1 text-lg font-light">Analítica en tiempo real de tu operación comercial.</p>
        </div>
        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100">
          {(['THIS_MONTH', 'LAST_QUARTER', 'THIS_YEAR'] as const).map(tr => (
            <button key={tr} onClick={() => setTimeRange(tr)} className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${timeRange === tr ? 'bg-[#1c2938] text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                {tr === 'THIS_MONTH' ? 'Mes Actual' : tr === 'LAST_QUARTER' ? 'Trimestre' : 'Año'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#1c2938] rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl">
         <div className="absolute top-0 right-0 w-96 h-96 bg-[#27bea5] rounded-full blur-[100px] opacity-10 -translate-y-1/2 translate-x-1/2"></div>
         {!analysis ? (
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
               <div className="max-w-xl"><h2 className="text-3xl font-bold mb-4 tracking-tight">CFO Virtual</h2><p className="text-slate-300 text-lg">Analiza tus tendencias, detecta riesgos y encuentra oportunidades de crecimiento con IA.</p></div>
               <button onClick={handleAnalyze} disabled={isAnalyzing} className="bg-white text-[#1c2938] px-8 py-4 rounded-2xl font-bold hover:bg-[#27bea5] hover:text-white transition-all flex items-center gap-3 shadow-lg">
                   {isAnalyzing ? <Loader2 className="animate-spin" /> : <BrainCircuit />} Generar Análisis
               </button>
            </div>
         ) : (
            <div ref={analysisRef} className="relative z-10 animate-in fade-in space-y-6">
               <div className="flex justify-between items-start"><div className="flex items-center gap-3"><BrainCircuit className="text-[#27bea5]" size={32}/><h2 className="text-2xl font-bold">Diagnóstico Ejecutivo</h2></div><button onClick={() => setAnalysis(null)} className="p-2 text-slate-400 hover:text-white"><X/></button></div>
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="bg-white/5 p-6 rounded-3xl border border-white/10"><p className="text-6xl font-bold text-[#27bea5]">{analysis.healthScore}</p><p className="font-bold text-lg mt-2">{analysis.healthStatus}</p><p className="text-xs text-slate-400 mt-1">{analysis.projection}</p></div>
                  <div className="lg:col-span-2"><p className="text-xl text-slate-200 leading-relaxed font-light italic">"{analysis.diagnosis}"</p><button onClick={() => handleExportPdf(analysisRef, 'Reporte_CFO')} className="mt-6 flex items-center gap-2 text-sm font-bold text-[#27bea5] hover:underline"><Download size={16}/> Descargar Reporte PDF</button></div>
               </div>
            </div>
         )}
      </div>

      <div className="flex justify-center"><div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 flex overflow-x-auto max-w-full">
         {(['OVERVIEW', 'DOCUMENTS', 'CLIENTS', 'FISCAL'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-8 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === tab ? 'bg-[#1c2938] text-white shadow-md' : 'text-slate-500 hover:text-[#1c2938]'}`}>
                {tab === 'OVERVIEW' ? 'Finanzas' : tab === 'DOCUMENTS' ? 'Operatividad' : tab === 'CLIENTS' ? 'Clientes' : 'Reporte Fiscal'}
            </button>
         ))}
      </div></div>

      <div className="space-y-10 min-h-[400px]">
        {activeTab === 'OVERVIEW' && renderOverview()}
        {activeTab === 'DOCUMENTS' && renderDocumentsView()}
        {activeTab === 'CLIENTS' && (
            <div ref={clientsRef} className="bg-white p-10 rounded-[2.5rem] border border-slate-50 shadow-sm animate-in fade-in">
                <div className="flex justify-between items-start mb-10">
                    <h3 className="font-bold text-xl flex items-center gap-3"><Users className="text-amber-500" /> Valor de Vida del Cliente (LTV)</h3>
                    <button onClick={() => handleDeepDive('ltv', 'Analítica de Clientes', data.ltvData)} className="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-amber-500 transition-all"><FileText className="w-5 h-5" /></button>
                </div>
                <div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.ltvData.slice(0,10)}><XAxis dataKey="name" tick={{fontSize: 10}}/><YAxis tickFormatter={compactNumber}/><Tooltip/><Bar dataKey="revenue" fill="#f59e0b" radius={[6,6,0,0]} barSize={40}/></BarChart></ResponsiveContainer></div>
            </div>
        )}
        {activeTab === 'FISCAL' && fiscalData && (
            <div ref={fiscalRef} className="animate-in fade-in space-y-8">
               <div className={`p-12 rounded-[3rem] text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-8 ${fiscalData.isCreditBalance ? 'bg-gradient-to-br from-emerald-600 to-teal-500' : 'bg-gradient-to-br from-amber-600 to-orange-500'}`}>
                  <div><p className="text-xs uppercase font-bold opacity-80 tracking-widest mb-3">Liquidación ITBMS Estimada</p><h2 className="text-6xl font-bold">{currencySymbol}{Math.abs(fiscalData.payable).toLocaleString()}</h2><p className="font-medium mt-4 text-lg">{fiscalData.isCreditBalance ? '✓ Crédito Fiscal a favor' : '⚠ Pago estimado este periodo'}</p></div>
                  <div className="bg-white/10 p-8 rounded-[2rem] border border-white/20 w-full md:w-96 backdrop-blur-md space-y-4"><div className="flex justify-between items-center text-sm"><span className="opacity-80">Débito (Ventas)</span><span className="font-bold">{currencySymbol}{fiscalData.debitFiscal.toFixed(2)}</span></div><div className="flex justify-between items-center text-sm"><span className="opacity-80">(-) Crédito (Compras)</span><span className="font-bold">{currencySymbol}{fiscalData.creditFiscal.toFixed(2)}</span></div><div className="pt-4 border-t border-white/10 flex justify-between items-center font-bold text-xl"><span>Neto</span><span>{currencySymbol}{fiscalData.payable.toFixed(2)}</span></div></div>
               </div>
            </div>
        )}
      </div>

      {deepDiveVisual && createPortal(
          <div className="fixed inset-0 z-[99] bg-[#1c2938]/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white rounded-[3rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto p-12 shadow-2xl relative animate-in zoom-in-95">
                  <button onClick={() => setDeepDiveVisual(null)} className="absolute top-8 right-8 p-3 hover:bg-slate-100 rounded-full transition-colors"><X/></button>
                  <div className="flex items-center gap-3 mb-10"><div className="p-3 bg-[#27bea5]/10 rounded-2xl text-[#27bea5]"><FileText size={32}/></div><div><h3 className="text-3xl font-bold text-[#1c2938]">{deepDiveVisual.title}</h3><p className="text-slate-400">Reporte detallado generado con IA</p></div></div>
                  
                  {deepDiveReport ? (
                      <div className="space-y-10">
                          <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100"><p className="text-xl font-light text-slate-700 leading-relaxed italic">"{deepDiveReport.executiveSummary}"</p></div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">{deepDiveReport.keyMetrics.map((m, i) => <div key={i} className="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm"><p className="text-xs text-slate-400 font-bold uppercase mb-2">{m.label}</p><p className="text-2xl font-bold text-[#1c2938]">{m.value}</p></div>)}</div>
                          <div className="bg-[#1c2938] text-white p-10 rounded-[2.5rem] relative overflow-hidden shadow-xl"><div className="absolute top-0 right-0 w-64 h-64 bg-[#27bea5] rounded-full blur-[80px] opacity-10"></div><div className="relative z-10"><h4 className="text-[#27bea5] font-bold mb-4 flex items-center gap-2 text-xl"><Lightbulb/> Recomendación Estratégica</h4><p className="text-lg text-slate-200 leading-relaxed">{deepDiveReport.recommendation}</p></div></div>
                      </div>
                  ) : <div className="flex flex-col items-center justify-center py-24 gap-4"><Loader2 className="animate-spin text-[#27bea5]" size={48}/><p className="text-slate-400 font-medium">El Analista Virtual está revisando tus datos...</p></div>}
              </div>
          </div>,
          document.body
      )}
    </div>
  );
};

export default ReportsDashboard;