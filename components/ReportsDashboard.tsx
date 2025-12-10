
import React, { useState, useMemo, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area, ScatterChart, Scatter
} from 'recharts';
import { 
  Sparkles, TrendingUp, Loader2, 
  BrainCircuit, Activity, Target, Lightbulb,
  X, TrendingDown, Wallet,
  LayoutDashboard, FileBarChart, Users, Filter, Calendar, Download, Mail, Smartphone, CheckCircle2,
  Clock, AlertTriangle, Trophy, FileText, Lock, ArrowRight
} from 'lucide-react';
import { Invoice, FinancialAnalysisResult, DeepDiveReport, UserProfile } from '../types';
import { generateFinancialAnalysis, generateDeepDiveReport, AI_ERROR_BLOCKED } from '../services/geminiService';
import { sendEmail } from '../services/resendService';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface ReportsDashboardProps {
  invoices: Invoice[];
  currencySymbol: string;
  apiKey?: { gemini?: string; openai?: string };
  currentUser?: UserProfile;
}

type TimeRange = '30D' | '90D' | '12M' | 'CUSTOM';
type ReportTab = 'OVERVIEW' | 'DOCUMENTS' | 'CLIENTS';

const ReportsDashboard = ({ invoices, currencySymbol, apiKey, currentUser }: ReportsDashboardProps) => {
  // Navigation State
  const [activeTab, setActiveTab] = useState<ReportTab>('OVERVIEW');

  // AI State
  const [analysis, setAnalysis] = useState<FinancialAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Check AI Access
  const hasAiAccess = !!apiKey?.gemini || !!apiKey?.openai;

  // Export State
  const [isExporting, setIsExporting] = useState<string | null>(null); // 'pdf' | 'email' | null
  const [emailStatus, setEmailStatus] = useState<'IDLE' | 'SENDING' | 'SUCCESS' | 'ERROR'>('IDLE');

  // Refs for individual report sections
  const overviewRef = useRef<HTMLDivElement>(null);
  const documentsRef = useRef<HTMLDivElement>(null);
  const clientsRef = useRef<HTMLDivElement>(null);
  const deepDiveRef = useRef<HTMLDivElement>(null); // New Ref for Modal Content

  // Filter State - Default to 12M
  const [timeRange, setTimeRange] = useState<TimeRange>('12M');
  
  // Custom Date Range State
  const [customStart, setCustomStart] = useState<string>(
    new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0]
  );
  const [customEnd, setCustomEnd] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Deep Dive Report State
  const [deepDiveReport, setDeepDiveReport] = useState<DeepDiveReport | null>(null);
  const [deepDiveVisual, setDeepDiveVisual] = useState<{ type: string, data: any } | null>(null);
  const [isDeepDiving, setIsDeepDiving] = useState<string | null>(null);

  // --- HELPER: Number Formatter for Charts (Anti-Overlap) ---
  const compactNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      notation: "compact",
      maximumFractionDigits: 1
    }).format(num);
  };

  // --- GENERATE PDF LOGIC ---
  const generatePdfBlob = async (elementRef: React.RefObject<HTMLDivElement>): Promise<Blob | null> => {
    if (!elementRef.current) return null;
    try {
      const element = elementRef.current;
      const totalHeight = element.scrollHeight;
      const clone = element.cloneNode(true) as HTMLElement;
      clone.style.width = `${element.clientWidth}px`; 
      clone.style.height = `${totalHeight}px`; 
      clone.style.maxHeight = 'none'; 
      clone.style.overflow = 'hidden'; 
      clone.style.position = 'fixed';
      clone.style.top = '0';
      clone.style.left = '-10000px'; 
      clone.style.zIndex = '-9999';
      clone.style.backgroundColor = '#FFFFFF'; 
      clone.style.color = '#1c2938'; 
      document.body.appendChild(clone);
      const canvas = await html2canvas(clone, { scale: 2, useCORS: true, backgroundColor: '#FFFFFF', logging: false, width: clone.clientWidth, height: totalHeight, windowWidth: clone.clientWidth, windowHeight: totalHeight, x: 0, y: 0, ignoreElements: (element) => element.id === 'no-print' });
      document.body.removeChild(clone);
      const imgData = canvas.toDataURL('image/png');
      const a4WidthMm = 210; 
      const imgHeightPx = canvas.height;
      const imgWidthPx = canvas.width;
      const pdfWidth = a4WidthMm;
      const pdfHeight = (imgHeightPx * a4WidthMm) / imgWidthPx;
      const pdf = new jsPDF('p', 'mm', [pdfWidth, pdfHeight]);
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      return pdf.output('blob');
    } catch (error) { console.error("PDF Generation Error", error); return null; }
  };

  const handleExportPdf = async (ref: React.RefObject<HTMLDivElement>, title: string) => {
    setIsExporting('pdf');
    let targetRef = ref;
    if (!targetRef.current) {
        if (activeTab === 'DOCUMENTS') targetRef = documentsRef;
        if (activeTab === 'CLIENTS') targetRef = clientsRef;
        if (activeTab === 'OVERVIEW') targetRef = overviewRef;
    }
    const blob = await generatePdfBlob(targetRef);
    if (blob) {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    setIsExporting(null);
  };

  // --- SHARE LOGIC ---
  
  const handleShareWhatsapp = (summaryText: string) => {
    const encodedText = encodeURIComponent(summaryText);
    const url = `https://wa.me/?text=${encodedText}`;
    window.open(url, '_blank');
  };

  const handleSendEmail = async (ref: React.RefObject<HTMLDivElement>, title: string) => {
    if (!currentUser?.email) {
      alert("Asegúrate de tener un email en tu perfil.");
      return;
    }
    setEmailStatus('SENDING');
    let targetRef = ref;
    if (!targetRef.current) {
        if (activeTab === 'DOCUMENTS') targetRef = documentsRef;
        if (activeTab === 'CLIENTS') targetRef = clientsRef;
        if (activeTab === 'OVERVIEW') targetRef = overviewRef;
    }
    const blob = await generatePdfBlob(targetRef);
    if (!blob) { setEmailStatus('ERROR'); return; }
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = async () => {
      const base64data = reader.result as string;
      const pureBase64 = base64data.split(',')[1]; 
      
      const result = await sendEmail({
        to: currentUser.email!, 
        subject: `Reporte: ${title}`, 
        html: `<p>Adjunto encontrarás el reporte generado desde Kônsul.</p>`, 
        senderName: currentUser.name, 
        attachments: [{ filename: `${title}.pdf`, content: pureBase64 }]
      });
      
      if (result.success) { setEmailStatus('SUCCESS'); setTimeout(() => setEmailStatus('IDLE'), 3000); } else { setEmailStatus('ERROR'); setTimeout(() => setEmailStatus('IDLE'), 3000); }
    };
  };

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
      startDate = new Date(customStart + 'T00:00:00');
      const end = new Date(customEnd + 'T23:59:59');
      endDate = end;
    }

    return invoices.filter(inv => {
      const d = new Date(inv.date);
      if (timeRange === 'CUSTOM') {
         return d >= startDate && d <= endDate;
      }
      return d >= startDate;
    });
  }, [invoices, timeRange, customStart, customEnd]);

  // --- 2. DATA AGGREGATION & REAL KPIs ---
  const data = useMemo(() => {
    const timelineMap = new Map<string, { ingresos: number, gastos: number, date: Date }>();
    let totalRevenue = 0; let totalExpenses = 0; let paymentDaysSum = 0; let paidInvoicesCount = 0;
    
    filteredInvoices.forEach(inv => {
      const d = new Date(inv.date);
      const key = d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
      
      if (!timelineMap.has(key)) timelineMap.set(key, { ingresos: 0, gastos: 0, date: d });
      const entry = timelineMap.get(key)!;
      
      // Logic for collected amount
      if (inv.type === 'Invoice') {
        let collected = 0;
        
        // Priority to amountPaid (Handles 'Abonada' and modern 'Pagada' flows)
        if (typeof inv.amountPaid === 'number' && inv.amountPaid > 0) {
            collected = inv.amountPaid;
        } 
        // Fallback for legacy 'Pagada'/'Aceptada' invoices that might not have amountPaid set
        else if (inv.status === 'Pagada' || inv.status === 'Aceptada') {
            collected = inv.total;
        }

        if (collected > 0) {
            entry.ingresos += collected;
            totalRevenue += collected;
        }

        // Calculate DSO only for fully paid invoices for accuracy
        if (inv.status === 'Pagada' || inv.status === 'Aceptada') {
            const createdEvent = inv.timeline?.find(e => e.type === 'CREATED');
            const paidEvent = inv.timeline?.find(e => e.type === 'PAID'); 
            if (createdEvent && paidEvent) { 
                const days = (new Date(paidEvent.timestamp).getTime() - new Date(createdEvent.timestamp).getTime()) / (1000 * 3600 * 24); 
                paymentDaysSum += days; 
                paidInvoicesCount++; 
            }
        }
      } else if (inv.type === 'Expense') { 
          entry.gastos += inv.total; 
          totalExpenses += inv.total; 
      }
    });

    const monthlyData = Array.from(timelineMap.entries()).map(([name, val]) => ({ name, ingresos: val.ingresos, gastos: val.gastos, _date: val.date })).sort((a, b) => a._date.getTime() - b._date.getTime());
    const avgPaymentDays = paidInvoicesCount > 0 ? Math.round(paymentDaysSum / paidInvoicesCount) : 0;
    const netMargin = totalRevenue - totalExpenses;
    const marginPercent = totalRevenue > 0 ? (netMargin / totalRevenue) * 100 : 0;
    const quoteDocs = filteredInvoices.filter(i => i.type === 'Quote');
    const totalQuotes = quoteDocs.length;
    const wonQuotes = quoteDocs.filter(i => i.status === 'Aceptada').length;
    const conversionRate = totalQuotes > 0 ? (wonQuotes / totalQuotes) * 100 : 0;
    
    // Updated Funnel Data with new statuses
    const funnelData = [ 
        { name: 'Borrador', value: filteredInvoices.filter(i => i.status === 'Borrador').length, fill: '#cbd5e1' }, 
        { name: 'Enviadas', value: filteredInvoices.filter(i => i.status === 'Enviada').length, fill: '#3b82f6' }, 
        { name: 'Vistas', value: filteredInvoices.filter(i => i.timeline?.some(e => e.type === 'OPENED')).length, fill: '#a855f7' }, 
        { name: 'Cobradas', value: filteredInvoices.filter(i => i.status === 'Aceptada' || i.status === 'Pagada' || (i.status === 'Abonada' && (i.amountPaid || 0) > 0)).length, fill: '#27bea5' }, 
    ];
    
    const scatterData = filteredInvoices.filter(i => i.type === 'Invoice' || i.type === 'Quote').map(i => ({ id: i.id, x: i.items.length, y: i.total, z: 1, status: i.status }));
    
    const clientMap = new Map<string, { revenue: number, count: number, lastDate: Date }>();
    const now = new Date();
    
    filteredInvoices.forEach(inv => { 
        if (!clientMap.has(inv.clientName)) clientMap.set(inv.clientName, { revenue: 0, count: 0, lastDate: new Date(0) }); 
        const c = clientMap.get(inv.clientName)!; 
        const invDate = new Date(inv.date); 
        if (invDate > c.lastDate) c.lastDate = invDate; 
        if (inv.type === 'Invoice') { 
            c.count++; 
            // Add collected revenue
            if (inv.amountPaid && inv.amountPaid > 0) {
                c.revenue += inv.amountPaid;
            } else if (inv.status === 'Aceptada' || inv.status === 'Pagada') { 
                c.revenue += inv.total; 
            } 
        } 
    });
    
    const ltvData = Array.from(clientMap.entries()).map(([name, val]) => ({ name, revenue: val.revenue, count: val.count, daysSinceLast: Math.floor((now.getTime() - val.lastDate.getTime()) / (1000 * 3600 * 24)) })).sort((a, b) => b.revenue - a.revenue);
    const churnRiskCount = ltvData.filter(c => c.daysSinceLast > 90).length; 
    const activeClientsCount = ltvData.filter(c => c.daysSinceLast <= 90).length;
    const clientActivityData = [ { name: 'Activos (<90d)', value: activeClientsCount, color: '#27bea5' }, { name: 'Riesgo (>90d)', value: churnRiskCount, color: '#ef4444' }, ];
    
    return { monthlyData, funnelData, scatterData, ltvData, clientActivityData, kpis: { totalRevenue, totalExpenses, netMargin, marginPercent, avgPaymentDays, conversionRate, churnRiskCount, activeClientsCount } };
  }, [filteredInvoices]);


  // --- HANDLERS ---
  const handleAnalyze = async () => {
    if (!hasAiAccess) return;
    setIsAnalyzing(true);
    setAiError(null);
    const { kpis } = data;
    const summary = `
      Reporte Financiero Real (${timeRange}):
      - Ingresos Cobrados: ${currencySymbol}${kpis.totalRevenue.toFixed(2)}
      - Gastos Operativos: ${currencySymbol}${kpis.totalExpenses.toFixed(2)}
      - Margen Neto: ${kpis.marginPercent.toFixed(1)}%
      - Tiempo Promedio Cobro (DSO): ${kpis.avgPaymentDays} días
      - Tasa Conversión Cotizaciones: ${kpis.conversionRate.toFixed(1)}%
      - Clientes en Riesgo (Inactivos >90d): ${kpis.churnRiskCount}
    `;
    try {
        const result = await generateFinancialAnalysis(summary, apiKey);
        setAnalysis(result);
    } catch (e: any) {
        if (e.message === AI_ERROR_BLOCKED) {
            setAiError("Función bloqueada: Configura tus API Keys.");
        } else {
            setAiError("Error al generar análisis.");
        }
    }
    setIsAnalyzing(false);
  };

  const handleDeepDive = async (chartId: string, chartTitle: string, chartData: any) => {
    if (!hasAiAccess) {
        alert("Configura tu API Key en Ajustes para usar análisis detallado.");
        return;
    }
    setIsDeepDiving(chartId);
    setDeepDiveReport(null);
    setDeepDiveVisual({ type: chartId, data: chartData }); // Set visual context
    const context = `Periodo: ${timeRange}. Datos Reales: ${JSON.stringify(chartData)}. Contexto KPI: Margen ${data.kpis.marginPercent}%, Conversión ${data.kpis.conversionRate}%`;
    try {
        const report = await generateDeepDiveReport(chartTitle, context, apiKey);
        setDeepDiveReport(report);
    } catch (e) {
        console.error("Deep Dive Error", e);
    }
    setIsDeepDiving(null);
  };

  // --- RENDERERS ---

  const renderOverview = () => (
    <div ref={overviewRef} className="p-4 bg-slate-50/50 rounded-[3rem] -m-4">
      <div className="p-4">
        {/* KPI CARDS - REAL DATA FIRST */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
           <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-50">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Ingreso Neto</p>
              <h3 className="text-2xl font-bold text-[#1c2938]">{currencySymbol}{compactNumber(data.kpis.totalRevenue)}</h3>
              <span className="text-[10px] text-slate-400">Cobrado (Total + Abonos)</span>
           </div>
           <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-50">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Margen Real</p>
              <h3 className={`text-2xl font-bold ${data.kpis.marginPercent > 20 ? 'text-[#27bea5]' : 'text-amber-500'}`}>
                 {data.kpis.marginPercent.toFixed(0)}%
              </h3>
              <span className="text-[10px] text-slate-400">Rentabilidad</span>
           </div>
           <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-50">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Gastos</p>
              <h3 className="text-2xl font-bold text-rose-500">-{currencySymbol}{compactNumber(data.kpis.totalExpenses)}</h3>
              <span className="text-[10px] text-slate-400">Operativos</span>
           </div>
           <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-50">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Utilidad</p>
              <h3 className="text-2xl font-bold text-[#1c2938]">{currencySymbol}{compactNumber(data.kpis.netMargin)}</h3>
              <span className="text-[10px] text-slate-400">En caja</span>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4">
            {/* Card: Cash Flow */}
            <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-50 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="font-bold text-[#1c2938] text-xl flex items-center gap-2">
                      <div className="p-2 bg-slate-50 rounded-xl text-[#27bea5]">
                        <Wallet className="w-5 h-5" />
                      </div>
                      Flujo de Caja Real
                    </h3>
                  </div>
                  <button id="no-print" onClick={() => handleDeepDive('cashflow', 'Flujo de Caja', data.monthlyData)} disabled={isDeepDiving === 'cashflow'} className="p-3 rounded-xl bg-slate-50 hover:text-[#27bea5] transition-all">
                    {isDeepDiving === 'cashflow' ? <Loader2 className="w-5 h-5 animate-spin" /> : (hasAiAccess ? <FileText className="w-5 h-5" /> : <Lock className="w-4 h-4 text-slate-300" />)}
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
                      <Bar dataKey="ingresos" name="Ingresos Cobrados" fill="#27bea5" radius={[6, 6, 0, 0]} barSize={24} />
                      <Bar dataKey="gastos" name="Gastos Totales" fill="#ef4444" radius={[6, 6, 0, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
              </div>
            </div>

            {/* Card: Profit Trends */}
            <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-50 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="font-bold text-[#1c2938] text-xl flex items-center gap-2">
                      <div className="p-2 bg-slate-50 rounded-xl text-blue-500">
                        <TrendingUp className="w-5 h-5" />
                      </div>
                      Evolución de Ingresos
                    </h3>
                  </div>
                  <button id="no-print" onClick={() => handleDeepDive('trends', 'Tendencia de Ingresos', data.monthlyData)} disabled={isDeepDiving === 'trends'} className="p-3 rounded-xl bg-slate-50 hover:text-blue-500 transition-all">
                    {isDeepDiving === 'trends' ? <Loader2 className="w-5 h-5 animate-spin" /> : (hasAiAccess ? <FileText className="w-5 h-5" /> : <Lock className="w-4 h-4 text-slate-300" />)}
                  </button>
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
      </div>
    </div>
  );

  const renderDocumentsView = () => (
    <div ref={documentsRef} className="p-4 bg-slate-50/50 rounded-[3rem] -m-4">
      <div className="p-4">
        {/* OPERATIONAL KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
           <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-50 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Efectividad de Venta</p>
                <h3 className="text-2xl font-bold text-[#1c2938]">{data.kpis.conversionRate.toFixed(1)}%</h3>
                <span className="text-[10px] text-slate-400">Cotizaciones Aceptadas</span>
              </div>
              <div className="p-3 bg-purple-50 rounded-full text-purple-500">
                 <Target className="w-6 h-6" />
              </div>
           </div>
           <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-50 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Velocidad de Cobro</p>
                <h3 className="text-2xl font-bold text-[#1c2938]">{data.kpis.avgPaymentDays} días</h3>
                <span className="text-[10px] text-slate-400">Promedio emisión a pago</span>
              </div>
              <div className="p-3 bg-blue-50 rounded-full text-blue-500">
                 <Clock className="w-6 h-6" />
              </div>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4">
            {/* Funnel Chart */}
            <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-50 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="font-bold text-[#1c2938] text-xl flex items-center gap-2">
                      <div className="p-2 bg-slate-50 rounded-xl text-indigo-500">
                        <Filter className="w-5 h-5" />
                      </div>
                      Embudo Real
                    </h3>
                    <p className="text-slate-400 text-sm mt-1 ml-11">Conversión de Documentos</p>
                  </div>
                  <button id="no-print" onClick={() => handleDeepDive('funnel', 'Embudo de Ventas', data.funnelData)} disabled={isDeepDiving === 'funnel'} className="p-3 rounded-xl bg-slate-50 hover:text-indigo-500 transition-all">
                    {isDeepDiving === 'funnel' ? <Loader2 className="w-5 h-5 animate-spin" /> : (hasAiAccess ? <FileText className="w-5 h-5" /> : <Lock className="w-4 h-4 text-slate-300" />)}
                  </button>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.funnelData} layout="vertical" margin={{ left: 0, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={80} 
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
                      Distribución de Valor
                    </h3>
                    <p className="text-slate-400 text-sm mt-1 ml-11">Relación Ítems vs Monto</p>
                  </div>
                  <button id="no-print" onClick={() => handleDeepDive('scatter', 'Distribución de Valor', data.scatterData)} disabled={isDeepDiving === 'scatter'} className="p-3 rounded-xl bg-slate-50 hover:text-rose-500 transition-all">
                    {isDeepDiving === 'scatter' ? <Loader2 className="w-5 h-5 animate-spin" /> : (hasAiAccess ? <FileText className="w-5 h-5" /> : <Lock className="w-4 h-4 text-slate-300" />)}
                  </button>
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
                          <Cell key={`cell-${index}`} fill={entry.status === 'Aceptada' || entry.status === 'Pagada' ? '#27bea5' : '#94a3b8'} />
                        ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
        </div>
      </div>
    </div>
  );

  const renderClientsView = () => (
    <div ref={clientsRef} className="p-4 bg-slate-50/50 rounded-[3rem] -m-4">
      <div className="p-4">
        {/* CLIENT KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
           <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-50 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Clientes Activos</p>
                <h3 className="text-2xl font-bold text-[#1c2938]">{data.kpis.activeClientsCount}</h3>
                <span className="text-[10px] text-slate-400">Compra reciente (&lt;90 días)</span>
              </div>
              <div className="p-3 bg-teal-50 rounded-full text-teal-500">
                 <Users className="w-6 h-6" />
              </div>
           </div>
           <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-50 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Riesgo de Fuga</p>
                <h3 className="text-2xl font-bold text-rose-500">{data.kpis.churnRiskCount}</h3>
                <span className="text-[10px] text-slate-400">Sin compra &gt;90 días</span>
              </div>
              <div className="p-3 bg-rose-50 rounded-full text-rose-500">
                 <AlertTriangle className="w-6 h-6" />
              </div>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4">
          {/* LTV Chart */}
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-50 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-bold text-[#1c2938] text-xl flex items-center gap-2">
                    <div className="p-2 bg-slate-50 rounded-xl text-amber-500">
                      <Users className="w-5 h-5" />
                    </div>
                    Top Clientes (LTV Real)
                  </h3>
                  <p className="text-slate-400 text-sm mt-1 ml-11">Ingresos cobrados históricamente</p>
                </div>
                <button id="no-print" onClick={() => handleDeepDive('ltv', 'Valor de Clientes', data.ltvData.slice(0,10))} disabled={isDeepDiving === 'ltv'} className="p-3 rounded-xl bg-slate-50 hover:text-amber-500 transition-all">
                    {isDeepDiving === 'ltv' ? <Loader2 className="w-5 h-5 animate-spin" /> : (hasAiAccess ? <FileText className="w-5 h-5" /> : <Lock className="w-4 h-4 text-slate-300" />)}
                </button>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.ltvData.slice(0, 7)} margin={{ top: 20, left: 0, right: 0 }}>
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
                      <Tooltip 
                        cursor={{fill: 'transparent'}} 
                        contentStyle={{ borderRadius: '12px', border: 'none' }}
                        formatter={(value: number) => [`${currencySymbol}${value.toLocaleString()}`, 'Facturado']}
                      />
                      <Bar dataKey="revenue" fill="#f59e0b" radius={[8, 8, 0, 0]} barSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
          </div>

          {/* Retention Pie */}
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-50 hover:shadow-md transition-shadow relative overflow-hidden">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-[#1c2938] text-xl flex items-center gap-2">
                    <div className="p-2 bg-slate-50 rounded-xl text-emerald-500">
                      <Target className="w-5 h-5" />
                    </div>
                    Salud de Cartera
                  </h3>
                </div>
                <button id="no-print" onClick={() => handleDeepDive('retention', 'Salud de Cartera', data.clientActivityData)} disabled={isDeepDiving === 'retention'} className="p-3 rounded-xl bg-slate-50 hover:text-emerald-500 transition-all">
                    {isDeepDiving === 'retention' ? <Loader2 className="w-5 h-5 animate-spin" /> : (hasAiAccess ? <FileText className="w-5 h-5" /> : <Lock className="w-4 h-4 text-slate-300" />)}
                </button>
              </div>
              <div className="h-64 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.clientActivityData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {data.clientActivityData.map((entry, index) => (
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
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in pb-12">
      
      {/* HEADER WITH ACTIONS (Date Filters) */}
      <div className="flex flex-col xl:flex-row justify-between items-end xl:items-center gap-6 pb-2">
        {/* Title */}
        <div>
           <h1 className="text-3xl font-bold text-[#1c2938] tracking-tight">Centro de Inteligencia</h1>
           <p className="text-slate-500 mt-1 text-lg font-light">
             Radiografía completa de tu negocio basada en <span className="font-bold text-[#1c2938]">{filteredInvoices.length} operaciones</span>.
           </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
           {/* Date Filter Buttons */}
           <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 overflow-x-auto max-w-full">
             {(['30D', '90D', '12M'] as const).map((range) => (
               <button
                 key={range}
                 onClick={() => setTimeRange(range)}
                 className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${
                   timeRange === range 
                     ? 'bg-[#1c2938] text-white shadow-md' 
                     : 'text-slate-400 hover:text-slate-600'
                 }`}
               >
                 {range}
               </button>
             ))}
             <button
               onClick={() => setTimeRange('CUSTOM')}
               className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-1 ${
                 timeRange === 'CUSTOM'
                   ? 'bg-[#1c2938] text-white shadow-md' 
                   : 'text-slate-400 hover:text-slate-600'
               }`}
             >
               <Calendar className="w-3 h-3" />
               Personalizado
             </button>
           </div>
        </div>
      </div>

      {/* Custom Range Inputs */}
      {timeRange === 'CUSTOM' && (
         <div className="flex justify-end -mt-6 mb-2">
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-4 bg-white p-1 rounded-xl border border-slate-100 shadow-sm">
                <input 
                  type="date" 
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="px-3 py-2 bg-slate-50 rounded-lg text-xs font-bold text-[#1c2938] outline-none focus:ring-1 focus:ring-[#27bea5]"
                />
                <span className="text-slate-400 text-xs font-bold">a</span>
                <input 
                  type="date" 
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-3 py-2 bg-slate-50 rounded-lg text-xs font-bold text-[#1c2938] outline-none focus:ring-1 focus:ring-[#27bea5]"
                />
            </div>
         </div>
      )}

      {/* CFO VIRTUAL IA SECTION (Prominent & Top) */}
      <div className="bg-[#1c2938] rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative overflow-hidden text-white transition-all duration-500">
         {/* Abstract Background */}
         <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#27bea5] rounded-full blur-[120px] opacity-10 -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
         <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600 rounded-full blur-[80px] opacity-10 translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

         <div className="relative z-10">
            {/* IDLE STATE */}
            {!analysis && (
               <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="max-w-2xl">
                     <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#27bea5]/20 text-[#27bea5] text-xs font-bold uppercase tracking-wider mb-4 border border-[#27bea5]/20">
                        <Sparkles className="w-3 h-3" /> Inteligencia Artificial
                     </div>
                     <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">CFO Virtual</h2>
                     <p className="text-slate-300 text-lg leading-relaxed">
                        Analiza tus tendencias financieras, detecta riesgos de fuga y encuentra oportunidades de crecimiento ocultas en tus datos.
                     </p>
                  </div>
                  
                  {hasAiAccess ? (
                    <button 
                        onClick={handleAnalyze}
                        disabled={isAnalyzing || invoices.length === 0}
                        className="group bg-white text-[#1c2938] px-8 py-4 rounded-2xl font-bold hover:bg-[#27bea5] hover:text-white transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(39,190,165,0.4)] hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:transform-none flex-shrink-0 flex items-center gap-3"
                    >
                        {isAnalyzing ? <Loader2 className="w-6 h-6 animate-spin" /> : <BrainCircuit className="w-6 h-6" />}
                        <span className="text-lg">Generar Análisis</span>
                        {!isAnalyzing && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                    </button>
                  ) : (
                    <button 
                        disabled
                        className="group bg-slate-700 text-slate-400 px-8 py-4 rounded-2xl font-bold flex-shrink-0 flex items-center gap-3 border border-slate-600 cursor-not-allowed"
                    >
                        <Lock className="w-6 h-6" />
                        <span className="text-lg">Configura tu API Key</span>
                    </button>
                  )}
               </div>
            )}

            {/* ANALYZED STATE */}
            {analysis && (
               <div className="animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex justify-between items-start mb-8 border-b border-white/10 pb-6">
                     <div>
                        <div className="flex items-center gap-3 mb-2">
                           <BrainCircuit className="w-8 h-8 text-[#27bea5]" />
                           <h2 className="text-3xl font-bold">Diagnóstico Ejecutivo</h2>
                        </div>
                        <p className="text-slate-400">Análisis generado el {new Date().toLocaleDateString()} a las {new Date().toLocaleTimeString()}</p>
                     </div>
                     <button onClick={() => setAnalysis(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
                        <X className="w-6 h-6" />
                     </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mb-8">
                     {/* Score Card */}
                     <div className="lg:col-span-1 bg-white/5 p-6 rounded-3xl border border-white/10 backdrop-blur-sm">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Salud Financiera</p>
                        <div className="flex items-center gap-4 mb-4">
                           <span className={`text-6xl font-bold ${analysis.healthScore >= 80 ? 'text-[#27bea5]' : analysis.healthScore >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                              {analysis.healthScore}
                           </span>
                           <span className="text-sm text-slate-400 font-medium bg-white/5 px-3 py-1 rounded-lg">
                              / 100
                           </span>
                        </div>
                        <div className="w-full bg-black/20 h-2 rounded-full overflow-hidden mb-4">
                           <div 
                              className={`h-full rounded-full ${analysis.healthScore >= 80 ? 'bg-[#27bea5]' : analysis.healthScore >= 50 ? 'bg-amber-400' : 'bg-rose-400'}`} 
                              style={{width: `${analysis.healthScore}%`}}
                           ></div>
                        </div>
                        <p className="font-bold text-lg text-white mb-1">{analysis.healthStatus}</p>
                        <p className="text-sm text-slate-400">{analysis.projection}</p>
                     </div>

                     {/* Diagnosis Text */}
                     <div className="lg:col-span-2 space-y-6">
                        <div>
                           <h3 className="text-xl font-bold text-[#27bea5] mb-3">Resumen Estratégico</h3>
                           <p className="text-lg text-slate-200 leading-relaxed">"{analysis.diagnosis}"</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           {analysis.actionableTips.map((tip, idx) => (
                              <div key={idx} className="flex gap-3 bg-white/5 p-4 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                                 <div className="w-6 h-6 rounded-full bg-[#27bea5]/20 flex items-center justify-center flex-shrink-0 text-[#27bea5] mt-0.5">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                 </div>
                                 <p className="text-sm text-slate-300">{tip}</p>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>

                  {/* ACTION BUTTONS (Revealed on Generation) */}
                  <div className="flex flex-wrap gap-4 pt-4 border-t border-white/10">
                     <button 
                        onClick={() => handleExportPdf(overviewRef, 'Reporte_CFO_IA')}
                        disabled={!!isExporting}
                        className="bg-white text-[#1c2938] px-6 py-3 rounded-xl font-bold hover:bg-[#27bea5] hover:text-white transition-all flex items-center gap-2 shadow-lg disabled:opacity-50"
                     >
                        {isExporting === 'pdf' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                        Descargar Reporte PDF
                     </button>
                     <button 
                        onClick={() => handleSendEmail(overviewRef, `Reporte CFO ${new Date().toLocaleDateString()}`)}
                        disabled={emailStatus === 'SENDING'}
                        className="bg-white/10 text-white px-6 py-3 rounded-xl font-bold hover:bg-white/20 transition-all flex items-center gap-2 border border-white/10 disabled:opacity-50"
                     >
                        {emailStatus === 'SENDING' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
                        Enviar por Email
                     </button>
                     <button 
                        onClick={() => handleShareWhatsapp(`CFO Diagnosis: ${analysis.diagnosis}`)}
                        className="bg-[#25D366] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#20bd5a] transition-all flex items-center gap-2 shadow-lg"
                     >
                        <Smartphone className="w-5 h-5" />
                        WhatsApp
                     </button>
                  </div>
               </div>
            )}
         </div>
      </div>

      {/* TABS NAVIGATION */}
      <div id="no-print" className="flex justify-center w-full sticky top-4 z-30">
         <div className="bg-white/80 backdrop-blur-md p-1.5 rounded-2xl shadow-lg border border-slate-100 flex overflow-x-auto max-w-full custom-scrollbar">
            {(['OVERVIEW', 'DOCUMENTS', 'CLIENTS'] as const).map(tab => (
               <button
                 key={tab}
                 onClick={() => setActiveTab(tab)}
                 className={`px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap flex items-center gap-2 ${
                   activeTab === tab
                     ? 'bg-[#1c2938] text-white shadow-md' 
                     : 'text-slate-500 hover:text-[#1c2938] hover:bg-slate-100'
                 }`}
               >
                 {tab === 'OVERVIEW' ? <LayoutDashboard className="w-4 h-4" /> : tab === 'DOCUMENTS' ? <FileBarChart className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                 {tab === 'OVERVIEW' ? 'Finanzas' : tab === 'DOCUMENTS' ? 'Operatividad' : 'Clientes'}
               </button>
            ))}
         </div>
      </div>
      
      {/* WRAPPER FOR TAB CONTENT */}
      <div className="space-y-10 p-4 -m-4">
        {activeTab === 'OVERVIEW' && renderOverview()}
        {activeTab === 'DOCUMENTS' && renderDocumentsView()}
        {activeTab === 'CLIENTS' && renderClientsView()}
      </div>

      {/* MODAL: DEEP DIVE REPORT */}
      {deepDiveReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1c2938]/60 backdrop-blur-md animate-in fade-in">
           <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col relative animate-in zoom-in-95 duration-300">
              
              {/* Header */}
              <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-white rounded-t-[2.5rem]">
                 <div className="flex items-center gap-3">
                   <div className="p-2 bg-[#27bea5]/10 rounded-xl text-[#27bea5]">
                     <FileText className="w-6 h-6" />
                   </div>
                   <div>
                     <h3 className="font-bold text-[#1c2938] text-xl">Reporte Detallado</h3>
                     <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">{deepDiveReport.chartTitle}</p>
                   </div>
                 </div>
                 <button onClick={() => setDeepDiveReport(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-[#1c2938]">
                   <X className="w-6 h-6" />
                 </button>
              </div>

              {/* Scrollable Content */}
              <div ref={deepDiveRef} className="p-8 md:p-12 overflow-y-auto custom-scrollbar flex-1 bg-white rounded-b-[2.5rem]">
                 
                 {/* VISUAL COMPONENT BASED ON REPORT TYPE */}
                 {deepDiveVisual && (
                    <div className="mb-10 animate-in slide-in-from-bottom-4">
                       
                       {/* 1. Funnel Visual */}
                       {deepDiveVisual.type === 'funnel' && (
                          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                             <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Conversión Visual</h4>
                             <div className="flex flex-col gap-3">
                                {deepDiveVisual.data.map((item: any, idx: number) => (
                                   <div key={idx} className="flex items-center group">
                                      <div className="w-24 text-xs font-bold text-slate-500">{item.name}</div>
                                      <div className="flex-1 h-10 bg-white rounded-xl relative overflow-hidden border border-slate-200 shadow-sm">
                                         <div 
                                            className="h-full bg-[#27bea5] opacity-20 transition-all duration-1000 ease-out group-hover:opacity-30" 
                                            style={{width: `${(item.value / Math.max(...deepDiveVisual.data.map((d:any)=>d.value))) * 100}%`}}
                                         ></div>
                                         <div className="absolute inset-0 flex items-center pl-4 font-bold text-[#1c2938] text-sm">
                                            {item.value} <span className="text-[10px] font-normal text-slate-400 ml-2 uppercase">Documentos</span>
                                         </div>
                                      </div>
                                   </div>
                                ))}
                             </div>
                          </div>
                       )}

                       {/* 2. Scatter Visual (Matrix) */}
                       {deepDiveVisual.type === 'scatter' && (
                          <div className="grid grid-cols-2 gap-4">
                             <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 text-center">
                                <p className="text-xs font-bold text-emerald-600 uppercase mb-2">Alta Rentabilidad</p>
                                <p className="text-3xl font-bold text-emerald-800">
                                   {deepDiveVisual.data.filter((d:any) => d.y > 1000).length}
                                </p>
                                <p className="text-[10px] text-emerald-600 mt-1">Proyectos &gt; $1k</p>
                             </div>
                             <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 text-center">
                                <p className="text-xs font-bold text-blue-600 uppercase mb-2">Volumen Rápido</p>
                                <p className="text-3xl font-bold text-blue-800">
                                   {deepDiveVisual.data.filter((d:any) => d.x < 3).length}
                                </p>
                                <p className="text-[10px] text-blue-600 mt-1">&lt; 3 Ítems</p>
                             </div>
                          </div>
                       )}

                       {/* 3. LTV Visual (Podium) */}
                       {deepDiveVisual.type === 'ltv' && (
                          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                             <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Trophy className="w-4 h-4 text-amber-500" /> Salón de la Fama
                             </h4>
                             <div className="space-y-3">
                                {deepDiveVisual.data.slice(0,3).map((client: any, idx: number) => (
                                   <div key={idx} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                      <div className="flex items-center gap-3">
                                         <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${idx===0 ? 'bg-amber-400' : idx===1 ? 'bg-slate-400' : 'bg-orange-400'}`}>
                                            {idx + 1}
                                         </div>
                                         <span className="font-bold text-[#1c2938]">{client.name}</span>
                                      </div>
                                      <span className="font-mono font-bold text-[#1c2938]">{currencySymbol}{compactNumber(client.revenue)}</span>
                                   </div>
                                ))}
                             </div>
                          </div>
                       )}

                       {/* 4. Trends Visual (Summary) */}
                       {deepDiveVisual.type === 'trends' && (
                          <div className="flex justify-between gap-4">
                             <div className="flex-1 bg-[#1c2938] p-6 rounded-3xl text-white text-center">
                                <p className="text-xs font-bold text-slate-400 uppercase mb-2">Mejor Mes</p>
                                <p className="text-2xl font-bold text-[#27bea5]">
                                   {deepDiveVisual.data.reduce((a:any, b:any) => a.ingresos > b.ingresos ? a : b).name}
                                </p>
                             </div>
                             <div className="flex-1 bg-slate-100 p-6 rounded-3xl text-center">
                                <p className="text-xs font-bold text-slate-400 uppercase mb-2">Promedio Mensual</p>
                                <p className="text-2xl font-bold text-[#1c2938]">
                                   {currencySymbol}{compactNumber(deepDiveVisual.data.reduce((acc:number, curr:any) => acc + curr.ingresos, 0) / deepDiveVisual.data.length)}
                                </p>
                             </div>
                          </div>
                       )}

                       {/* 5. Retention Visual (Health Bar) */}
                       {deepDiveVisual.type === 'retention' && (
                          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex items-center justify-around">
                             {deepDiveVisual.data.map((item: any, idx: number) => (
                                <div key={idx} className="text-center">
                                   <div className="w-16 h-16 rounded-full flex items-center justify-center border-4 text-xl font-bold mb-2 bg-white" style={{borderColor: item.color, color: item.color}}>
                                      {item.value}
                                   </div>
                                   <p className="text-xs font-bold text-slate-500 uppercase">{item.name}</p>
                                </div>
                             ))}
                          </div>
                       )}

                    </div>
                 )}

                 <div className="prose prose-slate max-w-none">
                    <div className="bg-slate-50 p-6 rounded-2xl mb-8 border border-slate-100">
                       <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Resumen Ejecutivo</h4>
                       <p className="text-[#1c2938] font-medium leading-relaxed">{deepDiveReport.executiveSummary}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                       {deepDiveReport.keyMetrics.map((metric, idx) => (
                          <div key={idx} className="p-4 border border-slate-100 rounded-2xl hover:border-[#27bea5] transition-colors group">
                             <p className="text-xs text-slate-400 mb-1">{metric.label}</p>
                             <div className="flex items-center gap-2">
                                <span className="text-2xl font-bold text-[#1c2938]">{metric.value}</span>
                                {metric.trend === 'up' && <TrendingUp className="w-4 h-4 text-green-500" />}
                                {metric.trend === 'down' && <TrendingDown className="w-4 h-4 text-red-500" />}
                             </div>
                          </div>
                       ))}
                    </div>

                    <h4 className="text-xl font-bold text-[#1c2938] mb-4">Análisis Estratégico</h4>
                    <p className="text-slate-600 leading-relaxed mb-8">{deepDiveReport.strategicInsight}</p>

                    <div className="bg-[#1c2938] text-white p-8 rounded-[2rem] relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-32 h-32 bg-[#27bea5] rounded-full blur-[50px] opacity-20 -translate-y-1/2 translate-x-1/2"></div>
                       <div className="relative z-10">
                          <h4 className="font-bold text-[#27bea5] mb-2 flex items-center gap-2">
                             <Lightbulb className="w-5 h-5" /> Nota Estratégica (IA)
                          </h4>
                          <p className="text-lg font-light leading-relaxed">{deepDiveReport.recommendation}</p>
                       </div>
                    </div>
                 </div>
              </div>

              {/* Footer Actions */}
              <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-white rounded-b-[2.5rem]">
                  <button 
                    onClick={() => handleExportPdf(deepDiveRef, `Reporte_${deepDiveReport.chartTitle}`)}
                    className="px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" /> Exportar PDF
                  </button>
                  <button 
                    onClick={() => setDeepDiveReport(null)}
                    className="px-6 py-3 rounded-xl bg-[#1c2938] text-white font-bold hover:bg-[#27bea5] transition-colors"
                  >
                    Cerrar
                  </button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default ReportsDashboard;
