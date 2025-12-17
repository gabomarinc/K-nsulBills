
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
  Clock, AlertTriangle, FileText, Lock, ArrowRight, Table, Scale, Landmark, Calculator, PiggyBank, ShieldCheck, XCircle, RefreshCw, Package, Tag
} from 'lucide-react';
import { Invoice, FinancialAnalysisResult, DeepDiveReport, UserProfile, InvoiceStatus } from '../types';
import { generateFinancialAnalysis, generateDeepDiveReport, AI_ERROR_BLOCKED, generateRevenueInsight } from '../services/geminiService';
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

  const generatePdfBlob = async (elementRef: React.RefObject<HTMLDivElement>): Promise<Blob | null> => {
    if (!elementRef.current) return null;
    try {
      const element = elementRef.current;
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#FFFFFF' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
      return pdf.output('blob');
    } catch (error) { return null; }
  };

  const handleExportPdf = async (ref: React.RefObject<HTMLDivElement>, title: string) => {
    setIsExporting('pdf');
    const blob = await generatePdfBlob(ref);
    if (blob) {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title}_${new Date().toISOString().split('T')[0]}.pdf`;
      link.click();
    }
    setIsExporting(null);
  };

  const filteredInvoices = useMemo(() => {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date(); 
    if (timeRange === 'THIS_MONTH') startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (timeRange === 'LAST_QUARTER') { startDate = new Date(); startDate.setMonth(now.getMonth() - 3); }
    else if (timeRange === 'THIS_YEAR') startDate = new Date(now.getFullYear(), 0, 1);
    else if (timeRange === 'CUSTOM') { startDate = new Date(customStart + 'T00:00:00'); endDate = new Date(customEnd + 'T23:59:59'); }
    if (timeRange !== 'CUSTOM') { endDate = new Date(); endDate.setHours(23, 59, 59, 999); }
    return invoices.filter(inv => { const d = new Date(inv.date); return d >= startDate && d <= endDate; });
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
    
    // --- REAL FUNNEL 1: INVOICES (COBRO) - REFINING WITH IMAGE STATUSES ---
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

    // --- REAL FUNNEL 2: QUOTES (VENTAS) - REFINING WITH IMAGE STATUSES ---
    const quotesOnly = filteredInvoices.filter(i => i.type === 'Quote');
    const qEnviada = quotesOnly.filter(q => q.status === 'Enviada' || q.status === 'Seguimiento').length;
    const qNegociacion = quotesOnly.filter(q => q.status === 'Negociacion').length;
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
        const result = await generateFinancialAnalysis("Resumen de datos para CFO", apiKey);
        if (result) setAnalysis(result);
    } catch (e) { setAiError("Error en IA"); } finally { setIsAnalyzing(false); }
  };

  const handleDeepDive = async (chartId: string, chartTitle: string, chartData: any) => {
    setIsDeepDiving(chartId);
    setDeepDiveReport(null);
    setDeepDiveVisual({ type: chartId, data: chartData, title: chartTitle });
    setDeepDiveAiData(chartData);
    if (hasAiAccess) {
        const report = await generateDeepDiveReport(chartTitle, "Contexto de reporte", apiKey);
        if (report) setDeepDiveReport(report);
    }
    setIsDeepDiving(null);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in pb-12">
      <div className="flex justify-between items-end">
        <div><h1 className="text-3xl font-bold text-[#1c2938]">Centro de Inteligencia</h1><p className="text-slate-500">Analítica en tiempo real de tu operación.</p></div>
        <div className="flex bg-white p-1 rounded-2xl border border-slate-100">
          {(['THIS_MONTH', 'LAST_QUARTER', 'THIS_YEAR'] as const).map(tr => (
            <button key={tr} onClick={() => setTimeRange(tr)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${timeRange === tr ? 'bg-[#1c2938] text-white shadow-md' : 'text-slate-400'}`}>{tr}</button>
          ))}
        </div>
      </div>

      <div className="bg-[#1c2938] rounded-[2.5rem] p-10 text-white relative overflow-hidden">
         {!analysis ? (
            <div className="flex justify-between items-center relative z-10">
               <div className="max-w-xl"><h2 className="text-3xl font-bold mb-4">CFO Virtual</h2><p className="text-slate-300">Usa IA para detectar patrones de crecimiento y optimizar tu flujo de caja.</p></div>
               <button onClick={handleAnalyze} disabled={isAnalyzing} className="bg-white text-[#1c2938] px-8 py-4 rounded-2xl font-bold hover:bg-[#27bea5] transition-all flex items-center gap-2">{isAnalyzing ? <Loader2 className="animate-spin" /> : <BrainCircuit />} Analizar</button>
            </div>
         ) : (
            <div ref={analysisRef} className="relative z-10 animate-in fade-in">
               <div className="flex justify-between items-start mb-8"><h2 className="text-2xl font-bold text-[#27bea5]">Diagnóstico Financiero</h2><button onClick={() => setAnalysis(null)}><X /></button></div>
               <div className="grid grid-cols-3 gap-8">
                  <div className="bg-white/5 p-6 rounded-3xl"><p className="text-6xl font-bold text-[#27bea5]">{analysis.healthScore}</p><p className="font-bold">{analysis.healthStatus}</p></div>
                  <div className="col-span-2"><p className="text-lg italic leading-relaxed">"{analysis.diagnosis}"</p></div>
               </div>
            </div>
         )}
      </div>

      <div className="flex justify-center"><div className="bg-white p-1 rounded-2xl border border-slate-100 flex overflow-x-auto">
         {(['OVERVIEW', 'DOCUMENTS', 'CLIENTS', 'FISCAL'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === tab ? 'bg-[#1c2938] text-white' : 'text-slate-400'}`}>{tab}</button>
         ))}
      </div></div>

      <div className="space-y-10">
        {activeTab === 'OVERVIEW' && (
            <div ref={overviewRef} className="grid grid-cols-2 gap-8 animate-in fade-in">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-50 shadow-sm"><h3 className="font-bold text-xl mb-6">Flujo de Caja Real</h3><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.monthlyData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name"/><YAxis tickFormatter={compactNumber}/><Tooltip/><Bar dataKey="ingresos" fill="#27bea5" radius={[4,4,0,0]}/><Bar dataKey="gastos" fill="#ef4444" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-50 shadow-sm"><h3 className="font-bold text-xl mb-6">Ventas por Producto</h3><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.productSalesData.slice(0,5)} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={true}/><XAxis type="number" hide/><YAxis dataKey="name" type="category" width={100}/><Tooltip/><Bar dataKey="totalRevenue" fill="#3b82f6" radius={[0,4,4,0]}/></BarChart></ResponsiveContainer></div></div>
            </div>
        )}

        {activeTab === 'DOCUMENTS' && (
            <div ref={documentsRef} className="grid grid-cols-2 gap-8 animate-in fade-in">
                {/* INVOICE FUNNEL (COBRO) */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-50 shadow-sm">
                   <h3 className="font-bold text-xl mb-2 flex items-center gap-2 text-[#1c2938]"><Filter className="w-5 h-5 text-indigo-500"/> Embudo de Cobro (Facturas)</h3>
                   <p className="text-slate-400 text-xs mb-6 uppercase tracking-widest font-bold">Ciclo: Enviada → Seguimiento → Abonada → Pagada → Incobrable</p>
                   <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.invoiceFunnelData} layout="vertical"><XAxis type="number" hide/><YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10, fontWeight: 700}}/><Tooltip/><Bar dataKey="value" barSize={30} radius={[0,6,6,0]}>{data.invoiceFunnelData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}</Bar></BarChart></ResponsiveContainer></div>
                </div>

                {/* QUOTE FUNNEL (VENTAS) */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-50 shadow-sm">
                   <h3 className="font-bold text-xl mb-2 flex items-center gap-2 text-[#1c2938]"><Target className="w-5 h-5 text-purple-500"/> Embudo de Ventas (Cotizaciones)</h3>
                   <p className="text-slate-400 text-xs mb-6 uppercase tracking-widest font-bold">Ciclo: Enviada → Negociación → Aceptada → Rechazada</p>
                   <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.quoteFunnelData} layout="vertical"><XAxis type="number" hide/><YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10, fontWeight: 700}}/><Tooltip/><Bar dataKey="value" barSize={30} radius={[0,6,6,0]}>{data.quoteFunnelData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}</Bar></BarChart></ResponsiveContainer></div>
                </div>
            </div>
        )}

        {activeTab === 'FISCAL' && fiscalData && (
            <div ref={fiscalRef} className="animate-in fade-in space-y-8">
               <div className={`p-10 rounded-[3rem] text-white ${fiscalData.isCreditBalance ? 'bg-emerald-600' : 'bg-amber-600'} shadow-xl flex justify-between items-center`}>
                  <div><p className="text-xs uppercase font-bold opacity-80 mb-2">Liquidación ITBMS Estimada</p><h2 className="text-5xl font-bold">{currencySymbol}{Math.abs(fiscalData.payable).toLocaleString()}</h2><p className="font-medium mt-2">{fiscalData.isCreditBalance ? 'Crédito Fiscal a favor' : 'A pagar este periodo'}</p></div>
                  <div className="bg-white/10 p-6 rounded-2xl border border-white/10 w-80 space-y-2"><div className="flex justify-between text-sm opacity-80"><span>Ventas (Débito)</span><span>{currencySymbol}{fiscalData.debitFiscal.toFixed(2)}</span></div><div className="flex justify-between text-sm opacity-80"><span>Gastos (Crédito)</span><span>{currencySymbol}{fiscalData.creditFiscal.toFixed(2)}</span></div></div>
               </div>
            </div>
        )}
      </div>

      {deepDiveVisual && createPortal(
          <div className="fixed inset-0 z-[99] bg-[#1c2938]/60 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-white rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto p-10 shadow-2xl relative">
                  <button onClick={() => setDeepDiveVisual(null)} className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full"><X/></button>
                  <h3 className="text-2xl font-bold mb-8">{deepDiveVisual.title}</h3>
                  {deepDiveReport ? (
                      <div className="space-y-6">
                          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100"><p className="font-medium">{deepDiveReport.executiveSummary}</p></div>
                          <div className="grid grid-cols-3 gap-4">{deepDiveReport.keyMetrics.map((m, i) => <div key={i} className="p-4 border rounded-xl font-bold"><p className="text-xs text-slate-400">{m.label}</p><p className="text-xl">{m.value}</p></div>)}</div>
                          <div className="bg-[#1c2938] text-white p-8 rounded-[2rem]"><h4 className="text-[#27bea5] font-bold mb-2">Recomendación</h4><p className="text-lg">{deepDiveReport.recommendation}</p></div>
                      </div>
                  ) : <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#27bea5]" size={40}/></div>}
              </div>
          </div>,
          document.body
      )}
    </div>
  );
};

export default ReportsDashboard;
