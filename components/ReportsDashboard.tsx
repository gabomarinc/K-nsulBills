
import React, { useState, useMemo, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area, ScatterChart, Scatter
} from 'recharts';
import { 
  Sparkles, TrendingUp, Loader2, 
  BrainCircuit, Activity, Target, Lightbulb,
  X, TrendingDown, Wallet, FileText,
  LayoutDashboard, FileBarChart, Users, Funnel, Calendar, Download, Share2, Mail, Smartphone, CheckCircle2
} from 'lucide-react';
import { Invoice, FinancialAnalysisResult, DeepDiveReport, UserProfile } from '../types';
import { generateFinancialAnalysis, generateDeepDiveReport } from '../services/geminiService';
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

const ReportsDashboard: React.FC<ReportsDashboardProps> = ({ invoices, currencySymbol, apiKey, currentUser }) => {
  // Navigation State
  const [activeTab, setActiveTab] = useState<ReportTab>('OVERVIEW');

  // AI State
  const [analysis, setAnalysis] = useState<FinancialAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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
  const [isDeepDiving, setIsDeepDiving] = useState<string | null>(null);

  // --- HELPER: Number Formatter for Charts (Anti-Overlap) ---
  const compactNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      notation: "compact",
      maximumFractionDigits: 1
    }).format(num);
  };

  // --- GENERATE PDF FROM SPECIFIC REF (Updated for Full Scroll Capture) ---
  const generatePdfBlob = async (elementRef: React.RefObject<HTMLDivElement>): Promise<Blob | null> => {
    if (!elementRef.current) return null;

    try {
      const element = elementRef.current;
      
      // Calculate total dimensions including scroll
      const totalHeight = element.scrollHeight;
      const totalWidth = element.scrollWidth;

      // 1. CLONE STRATEGY: Create a clone to render full height without scrolling issues
      const clone = element.cloneNode(true) as HTMLElement;

      // 2. Style the clone to sit off-screen but fully expanded
      clone.style.width = `${element.clientWidth}px`; // Use clientWidth to match visible width layout
      clone.style.height = `${totalHeight}px`; // Force full height
      clone.style.maxHeight = 'none'; // Remove constraints
      clone.style.overflow = 'hidden'; // Hide scrollbars
      
      // Position fixed off-screen to avoid viewport clipping issues
      clone.style.position = 'fixed';
      clone.style.top = '0';
      clone.style.left = '-10000px'; 
      clone.style.zIndex = '-9999';
      clone.style.backgroundColor = '#FFFFFF'; // Ensure background is white
      clone.style.color = '#1c2938'; // Ensure text color

      document.body.appendChild(clone);

      // 3. Capture the clone
      const canvas = await html2canvas(clone, {
        scale: 2, // High resolution
        useCORS: true,
        backgroundColor: '#FFFFFF',
        logging: false,
        width: clone.clientWidth,
        height: totalHeight,
        windowWidth: clone.clientWidth,
        windowHeight: totalHeight,
        x: 0,
        y: 0,
        ignoreElements: (element) => element.id === 'no-print'
      });

      // 4. Cleanup Clone
      document.body.removeChild(clone);

      // 5. Create PDF (Dynamic Height to fit content exactly)
      const imgData = canvas.toDataURL('image/png');
      
      // Calculate dimensions in mm (approx 3.78 px per mm at 96 DPI, but we use logic relative to A4 width)
      const a4WidthMm = 210; // Standard A4 Width
      const imgHeightPx = canvas.height;
      const imgWidthPx = canvas.width;
      
      // Scale height to fit the A4 width ratio
      const pdfWidth = a4WidthMm;
      const pdfHeight = (imgHeightPx * a4WidthMm) / imgWidthPx;

      // Use custom page size to fit the entire image on one long page (Receipt style)
      // This prevents awkward page breaks in the middle of charts/text
      const pdf = new jsPDF('p', 'mm', [pdfWidth, pdfHeight]);
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      
      return pdf.output('blob');
    } catch (error) {
      console.error("PDF Generation Error", error);
      return null;
    }
  };

  const handleExportPdf = async (ref: React.RefObject<HTMLDivElement>, title: string) => {
    setIsExporting('pdf');
    const blob = await generatePdfBlob(ref);
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
    if (!currentUser?.apiKeys?.resend || !currentUser?.email) {
      alert("Configura tu API Key de Resend y asegura tener un email en tu perfil.");
      return;
    }

    setEmailStatus('SENDING');
    
    const blob = await generatePdfBlob(ref);
    if (!blob) {
      setEmailStatus('ERROR');
      return;
    }

    // Convert Blob to Base64
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = async () => {
      const base64data = reader.result as string;
      const pureBase64 = base64data.split(',')[1]; // Remove header

      const result = await sendEmail(
        currentUser.apiKeys!.resend!,
        currentUser.email!,
        `Reporte: ${title}`,
        `<p>Adjunto encontrarás el reporte generado desde Kônsul.</p>`,
        currentUser.name,
        [{ filename: `${title}.pdf`, content: pureBase64 }]
      );

      if (result.success) {
        setEmailStatus('SUCCESS');
        setTimeout(() => setEmailStatus('IDLE'), 3000);
      } else {
        setEmailStatus('ERROR');
        setTimeout(() => setEmailStatus('IDLE'), 3000);
      }
    };
  };

  // --- 1. FILTER LOGIC ---
  const filteredInvoices = useMemo(() => {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date(); // Default to now for relative ranges

    if (timeRange === '30D') {
      startDate.setDate(now.getDate() - 30);
    } else if (timeRange === '90D') {
      startDate.setDate(now.getDate() - 90);
    } else if (timeRange === '12M') {
      startDate.setDate(now.getDate() - 365);
    } else if (timeRange === 'CUSTOM') {
      // Create dates from input strings (assuming local time to avoid UTC shifts)
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
    <div ref={overviewRef} className="p-4 bg-slate-50/50 rounded-[3rem] -m-4">
      <div className="p-4">
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
                  <button id="no-print" onClick={() => handleDeepDive('cashflow', 'Flujo de Caja', data.monthlyData)} disabled={isDeepDiving === 'cashflow'} className="p-3 rounded-xl bg-slate-50 hover:text-[#27bea5] transition-all">
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
      </div>
    </div>
  );

  const renderDocumentsView = () => (
    <div ref={documentsRef} className="p-4 bg-slate-50/50 rounded-[3rem] -m-4">
      <div className="p-4">
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
      </div>
    </div>
  );

  const renderClientsView = () => (
    <div ref={clientsRef} className="p-4 bg-slate-50/50 rounded-[3rem] -m-4">
      <div className="p-4">
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
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in pb-12">
      
      {/* HEADER WITH ACTIONS */}
      <div className="flex flex-col xl:flex-row justify-between items-end xl:items-center gap-6 border-b border-slate-100 pb-6">
        <div>
           <h1 className="text-3xl font-bold text-[#1c2938] tracking-tight">Centro de Inteligencia</h1>
           <p className="text-slate-500 mt-1 text-lg font-light">
             Análisis de <span className="font-medium text-[#27bea5]">{filteredInvoices.length} documentos</span>
           </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
           {/* Date Filter */}
           <div className="flex bg-slate-100 p-1.5 rounded-2xl shadow-sm overflow-x-auto max-w-full">
             {(['30D', '90D', '12M'] as const).map((range) => (
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
             <button
               onClick={() => setTimeRange('CUSTOM')}
               className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-1 ${
                 timeRange === 'CUSTOM'
                   ? 'bg-white text-[#1c2938] shadow-sm scale-105' 
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
         <div className="flex justify-end -mt-6 mb-6">
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-4 bg-white p-1 rounded-xl border border-slate-100">
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

      {/* WRAPPER */}
      <div className="space-y-10 p-4 -m-4">
        
        {/* TABS NAVIGATION */}
        <div id="no-print" className="flex justify-center w-full">
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
                   {tab === 'OVERVIEW' ? <LayoutDashboard className="w-4 h-4" /> : tab === 'DOCUMENTS' ? <FileBarChart className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                   {tab === 'OVERVIEW' ? 'Finanzas' : tab === 'DOCUMENTS' ? 'Operatividad' : 'Clientes'}
                 </button>
              ))}
           </div>
        </div>
        
        {/* TAB CONTENT */}
        {activeTab === 'OVERVIEW' && renderOverview()}
        {activeTab === 'DOCUMENTS' && renderDocumentsView()}
        {activeTab === 'CLIENTS' && renderClientsView()}
      </div>

      {/* ACTIONS FOOTER */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-50 shadow-lg flex flex-col lg:flex-row justify-between items-center gap-6 mt-12">
        <div className="flex-1">
          <h3 className="font-bold text-[#1c2938] flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-[#27bea5]" /> 
            Análisis de IA
          </h3>
          <p className="text-sm text-slate-500 mt-1 max-w-xl">
             Obtén un diagnóstico financiero completo, identificación de riesgos y proyección a futuro.
          </p>
        </div>

        {/* AI Output Card */}
        {analysis && (
          <div className="w-full lg:w-auto flex-1 bg-slate-50 p-6 rounded-2xl animate-in slide-in-from-right-4 border border-slate-200">
             <div className="flex justify-between items-start mb-4">
               <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getScoreColor(analysis.healthScore)}`}>
                 Salud: {analysis.healthStatus} ({analysis.healthScore}/100)
               </span>
               <button onClick={() => setAnalysis(null)} className="text-slate-400 hover:text-[#1c2938]">
                 <X className="w-4 h-4" />
               </button>
             </div>
             <p className="font-bold text-[#1c2938] mb-2">"{analysis.diagnosis}"</p>
             <ul className="space-y-2 mb-4">
               {analysis.actionableTips.map((tip, idx) => (
                 <li key={idx} className="text-xs text-slate-600 flex gap-2 items-start">
                   <div className="w-1.5 h-1.5 rounded-full bg-[#27bea5] mt-1.5 flex-shrink-0"></div>
                   {tip}
                 </li>
               ))}
             </ul>
             <div className="text-xs font-medium text-slate-500 bg-white p-3 rounded-xl border border-slate-100 flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-500" />
                <span className="font-bold text-purple-600">Proyección:</span> {analysis.projection}
             </div>
          </div>
        )}

        <div className="flex items-center gap-3 w-full lg:w-auto">
           {activeTab === 'OVERVIEW' && (
              <>
                 <button 
                   onClick={() => handleExportPdf(overviewRef, 'Reporte_Financiero')}
                   className="p-4 rounded-2xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all disabled:opacity-50"
                   disabled={!!isExporting}
                   title="Descargar PDF"
                 >
                   {isExporting === 'pdf' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                 </button>

                 <button 
                   onClick={() => handleSendEmail(overviewRef, `Reporte Financiero ${new Date().toLocaleDateString()}`)}
                   className={`p-4 rounded-2xl border transition-all disabled:opacity-50 ${
                     emailStatus === 'SUCCESS' ? 'bg-green-100 text-green-700 border-green-200' :
                     emailStatus === 'ERROR' ? 'bg-red-100 text-red-700 border-red-200' :
                     'border-slate-200 text-slate-500 hover:bg-slate-50'
                   }`}
                   disabled={emailStatus === 'SENDING'}
                   title="Enviar por Email"
                 >
                   {emailStatus === 'SENDING' ? <Loader2 className="w-5 h-5 animate-spin" /> : 
                    emailStatus === 'SUCCESS' ? <CheckCircle2 className="w-5 h-5" /> :
                    <Mail className="w-5 h-5" />}
                 </button>

                 <button 
                   onClick={() => handleShareWhatsapp(`Hola, aquí está mi resumen financiero: Ingresos ${currencySymbol}XXX, Gastos ${currencySymbol}YYY.`)}
                   className="p-4 rounded-2xl border border-slate-200 text-slate-500 hover:bg-green-50 hover:text-green-600 hover:border-green-200 transition-all"
                   title="Compartir WhatsApp"
                 >
                   <Smartphone className="w-5 h-5" />
                 </button>
              </>
           )}

           <button 
             onClick={handleAnalyze}
             disabled={isAnalyzing || invoices.length === 0}
             className="bg-[#1c2938] text-white px-8 py-4 rounded-2xl font-bold hover:bg-[#27bea5] transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
           >
             {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
             {isAnalyzing ? 'Analizando...' : 'Analizar con IA'}
           </button>
        </div>
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
                             <Lightbulb className="w-5 h-5" /> Recomendación de IA
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
