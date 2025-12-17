
import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, ScatterChart, Scatter
} from 'recharts';
import { 
  Sparkles, TrendingUp, Loader2, 
  BrainCircuit, Activity, Target, Lightbulb,
  X, TrendingDown, Wallet,
  LayoutDashboard, FileBarChart, Users, Filter, Calendar, Download, Mail, Smartphone, CheckCircle2,
  Clock, AlertTriangle, Trophy, FileText, Lock, ArrowRight, Table, Scale, Landmark, Calculator, PiggyBank, Briefcase, ShieldCheck, AlertCircle, FileWarning, XCircle, RefreshCw, ChevronDown, ChevronRight, Package, Tag
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

type TimeRange = 'THIS_MONTH' | 'LAST_QUARTER' | 'THIS_YEAR' | 'CUSTOM';
type ReportTab = 'OVERVIEW' | 'DOCUMENTS' | 'CLIENTS' | 'FISCAL';

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
  const fiscalRef = useRef<HTMLDivElement>(null); // New Ref
  const deepDiveRef = useRef<HTMLDivElement>(null); 
  const analysisRef = useRef<HTMLDivElement>(null); // New Ref for specific AI Analysis capture

  // Filter State - Default to This Year
  const [timeRange, setTimeRange] = useState<TimeRange>('THIS_YEAR');
  
  // Custom Date Range State
  const [customStart, setCustomStart] = useState<string>(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
  );
  const [customEnd, setCustomEnd] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Deep Dive Report State
  const [deepDiveReport, setDeepDiveReport] = useState<DeepDiveReport | null>(null);
  const [deepDiveVisual, setDeepDiveVisual] = useState<{ type: string, data: any, title: string } | null>(null);
  const [deepDiveAiData, setDeepDiveAiData] = useState<any>(null); // STORE AGGREGATED DATA FOR AI RETRIES
  const [isDeepDiving, setIsDeepDiving] = useState<string | null>(null); // Holds the Chart ID being analyzed
  const [deepDiveError, setDeepDiveError] = useState(false); // New: Explicit error state for modal

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
      // Force white background for PDF readability, even if source is dark theme
      clone.style.backgroundColor = '#FFFFFF'; 
      clone.style.color = '#1c2938'; 
      
      document.body.appendChild(clone);
      
      const canvas = await html2canvas(clone, { 
          scale: 2, 
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
    
    // Fallback if ref is not explicitly passed or current is null
    if (!targetRef.current) {
        if (activeTab === 'DOCUMENTS') targetRef = documentsRef;
        else if (activeTab === 'CLIENTS') targetRef = clientsRef;
        else if (activeTab === 'FISCAL') targetRef = fiscalRef;
        else targetRef = overviewRef;
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
        if (activeTab === 'FISCAL') targetRef = fiscalRef;
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

  const handleShareWhatsapp = (summaryText: string) => {
    const encodedText = encodeURIComponent(summaryText);
    const url = `https://wa.me/?text=${encodedText}`;
    window.open(url, '_blank');
  };

  // --- 1. FILTER LOGIC ---
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
      const end = new Date(customEnd + 'T23:59:59');
      endDate = end;
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

  // --- 2. DATA AGGREGATION & REAL KPIs ---
  const data = useMemo(() => {
    const timelineMap = new Map<string, { ingresos: number, gastos: number, date: Date }>();
    const productStatsMap = new Map<string, { name: string, totalRevenue: number, count: number }>();
    
    let totalRevenue = 0; let totalExpenses = 0; let paymentDaysSum = 0; let paidInvoicesCount = 0;
    
    const isDaily = timeRange === 'THIS_MONTH' || (
        timeRange === 'CUSTOM' && 
        (new Date(customEnd).getTime() - new Date(customStart).getTime()) / (1000 * 3600 * 24) < 60
    );

    filteredInvoices.forEach(inv => {
      const d = new Date(inv.date);
      
      let key;
      if (isDaily) {
          key = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
      } else {
          key = d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
      }
      
      if (!timelineMap.has(key)) timelineMap.set(key, { ingresos: 0, gastos: 0, date: d });
      const entry = timelineMap.get(key)!;
      
      if (inv.type === 'Invoice') {
        let collected = 0;
        if (typeof inv.amountPaid === 'number' && inv.amountPaid > 0) {
            collected = inv.amountPaid;
        } else if (inv.status === 'Pagada' || inv.status === 'Aceptada') {
            collected = inv.total;
        }

        if (collected > 0) {
            entry.ingresos += collected;
            totalRevenue += collected;
        }

        // Product Breakdown Logic (Sales by Item)
        // We consider an item "Sold" if the invoice is not Draft or Rejected
        if (inv.status !== 'Borrador' && inv.status !== 'Rechazada') {
            inv.items.forEach(item => {
                const pKey = item.description.trim();
                if (!productStatsMap.has(pKey)) {
                    productStatsMap.set(pKey, { name: pKey, totalRevenue: 0, count: 0 });
                }
                const pStat = productStatsMap.get(pKey)!;
                pStat.totalRevenue += (item.price * item.quantity);
                pStat.count += item.quantity;
            });
        }

        // REAL PAYMENT SPEED CALCULATION
        if (inv.status === 'Pagada' || inv.status === 'Aceptada') {
            const createdEvent = inv.timeline?.find(e => e.type === 'CREATED');
            // Try to find the specific payment event or a status change to PAID
            const paidEvent = inv.timeline?.find(e => 
                e.type === 'PAID' || 
                (e.type === 'STATUS_CHANGE' && (e.title.includes('Pagada') || e.title.includes('Aceptada'))) ||
                e.type === 'APPROVED' // For quotes turned into invoices
            ); 
            
            // Fallback: If no created event (legacy), assume invoice date
            const startDate = createdEvent ? new Date(createdEvent.timestamp) : new Date(inv.date);
            
            if (paidEvent) { 
                const endDate = new Date(paidEvent.timestamp);
                const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
                const days = Math.ceil(diffTime / (1000 * 3600 * 24)); 
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
    
    // Sort Products by Revenue (Top Sellers)
    const productSalesData = Array.from(productStatsMap.values())
        .sort((a, b) => b.totalRevenue - a.totalRevenue);

    const avgPaymentDays = paidInvoicesCount > 0 ? Math.round(paymentDaysSum / paidInvoicesCount) : 0;
    const netMargin = totalRevenue - totalExpenses;
    const marginPercent = totalRevenue > 0 ? (netMargin / totalRevenue) * 100 : 0;
    
    // REAL CONVERSION RATE
    // Filter strictly for Quotes in the current filtered set
    const quoteDocs = filteredInvoices.filter(i => i.type === 'Quote');
    const totalQuotes = quoteDocs.length;
    const wonQuotes = quoteDocs.filter(i => i.status === 'Aceptada').length;
    const conversionRate = totalQuotes > 0 ? (wonQuotes / totalQuotes) * 100 : 0;
    
    const funnelData = [ 
        { name: 'Borrador', value: filteredInvoices.filter(i => i.status === 'Borrador').length, fill: '#cbd5e1' }, 
        { name: 'Enviadas', value: filteredInvoices.filter(i => i.status === 'Enviada').length, fill: '#3b82f6' }, 
        { name: 'Vistas', value: filteredInvoices.filter(i => i.timeline?.some(e => e.type === 'OPENED')).length, fill: '#a855f7' }, 
        { name: 'Cobradas', value: filteredInvoices.filter(i => i.status === 'Aceptada' || i.status === 'Pagada' || (i.status === 'Abonada' && (i.amountPaid || 0) > 0)).length, fill: '#27bea5' }, 
    ];
    
    const scatterData = filteredInvoices.filter(i => i.type === 'Invoice' || i.type === 'Quote').map(i => ({ id: i.id, client: i.clientName, x: i.items.length, y: i.total, z: 1, status: i.status }));
    
    const clientMap = new Map<string, { revenue: number, count: number, lastDate: Date }>();
    const now = new Date();
    
    filteredInvoices.forEach(inv => { 
        if (!clientMap.has(inv.clientName)) clientMap.set(inv.clientName, { revenue: 0, count: 0, lastDate: new Date(0) }); 
        const c = clientMap.get(inv.clientName)!; 
        const invDate = new Date(inv.date); 
        if (invDate > c.lastDate) c.lastDate = invDate; 
        if (inv.type === 'Invoice') { 
            c.count++; 
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
    
    return { monthlyData, productSalesData, funnelData, scatterData, ltvData, clientActivityData, kpis: { totalRevenue, totalExpenses, netMargin, marginPercent, avgPaymentDays, conversionRate, churnRiskCount, activeClientsCount } };
  }, [filteredInvoices, timeRange, customStart, customEnd]);

  // --- 3. FISCAL REPORT ENGINE (DGI PANAMA LOGIC) ---
  const fiscalData = useMemo(() => {
    if (!currentUser?.fiscalConfig) return null;
    
    let debitFiscal = 0; 
    let creditFiscal = 0; 
    let totalWithholding = 0; 
    let nonDeductibleExpenses = 0; 
    let voucherCount = 0; 

    filteredInvoices.filter(i => i.type === 'Invoice').forEach(inv => {
        if (inv.status === 'Borrador' || inv.status === 'Rechazada' || inv.status === 'Incobrable') return;

        const taxAmount = inv.items.reduce((sum, item) => {
            const itemTotal = item.price * item.quantity;
            const discount = inv.discountRate ? (itemTotal * (inv.discountRate / 100)) : 0;
            const taxableBase = itemTotal - discount;
            return sum + (taxableBase * (item.tax / 100));
        }, 0);

        debitFiscal += taxAmount;

        if (inv.withholdingAmount) {
            totalWithholding += inv.withholdingAmount;
        }
    });

    filteredInvoices.filter(i => i.type === 'Expense').forEach(exp => {
        const isValidDoc = exp.isValidFiscalDoc !== false; 
        const isDeductible = exp.expenseDeductibility !== 'NONE';

        if (!isValidDoc || !isDeductible) {
            nonDeductibleExpenses += exp.total;
            if (!isValidDoc) voucherCount++;
            return; 
        }

        const expTax = exp.items.reduce((sum, item) => {
             if (item.tax !== undefined) {
                 const base = item.price * item.quantity;
                 return sum + (base * (item.tax / 100));
             }
             return sum + (exp.total - (exp.total / 1.07));
        }, 0);

        creditFiscal += expTax;
    });

    const taxPayable = debitFiscal - creditFiscal - totalWithholding;
    const isCreditBalance = taxPayable < 0;

    const insights = [];
    if (voucherCount > 0) insights.push({ type: 'alert', title: 'Fuga de Crédito Fiscal', text: `Detectamos ${voucherCount} gastos registrados como "Voucher" o sin factura fiscal. Esto representa dinero que no puedes deducir.` });
    
    const bigSalesNoRetention = filteredInvoices.some(inv => inv.type === 'Invoice' && inv.total > 1000 && !inv.withholdingAmount && (inv.status === 'Pagada' || inv.status === 'Aceptada'));
    if (bigSalesNoRetention) insights.push({ type: 'warning', title: 'Verifica Retenciones', text: 'Tienes facturas grandes (> $1,000) sin retención registrada. Si tu cliente es Agente de Retención (ej. Estado, Grandes Empresas), debes registrar el 50% de ITBMS retenido o pagarás de más.' });

    if (isCreditBalance) insights.push({ type: 'info', title: 'Saldo a Favor', text: `No tienes que pagar ITBMS este periodo. Tienes un crédito de ${currencySymbol}${Math.abs(taxPayable).toFixed(2)} acumulable para el próximo mes.` });

    const unpaidInvoices = filteredInvoices.filter(i => i.type === 'Invoice' && i.status === 'Enviada' && i.items.some(it => it.tax > 0));
    if (unpaidInvoices.length > 0) insights.push({ type: 'tip', title: 'Obligación por Devengo', text: `Recuerda: El ITBMS de las facturas emitidas (${unpaidInvoices.length}) se debe declarar este mes, aunque aún no las hayas cobrado.` });

    return { debitFiscal, creditFiscal, withholdings: totalWithholding, payable: taxPayable, isCreditBalance, nonDeductibleTotal: nonDeductibleExpenses, insights };
  }, [data, currentUser, timeRange, filteredInvoices]);

  // --- HANDLERS ---
  const handleAnalyze = async () => {
    if (!hasAiAccess) return;
    setIsAnalyzing(true);
    setAiError(null);
    
    // 1. Gather all necessary context from User Profile & Cost Simulator
    const { kpis, monthlyData, ltvData } = data;
    const trendString = monthlyData.map(m => `${m.name}: Ingreso $${m.ingresos.toFixed(0)}, Gasto $${m.gastos.toFixed(0)}`).join(' | ');
    
    // Fiscal Profile
    const fiscalConfig = currentUser?.fiscalConfig;
    const entityType = fiscalConfig?.entityType === 'JURIDICA' ? 'Sociedad Anónima (Jurídica)' : 'Persona Natural (Profesional)';
    const regime = fiscalConfig?.specialRegime || 'General';
    const annualProj = fiscalConfig?.annualRevenue || 0;

    // Cost Simulator / Targets
    const targets = currentUser?.hourlyRateConfig || { targetIncome: 0, monthlyCosts: 0 };
    const monthlyTarget = targets.targetIncome || 0;
    const fixedCosts = targets.monthlyCosts || 0;

    // Construct a rich narrative prompt
    const summary = `
      PERFIL EMPRESARIAL:
      - Entidad: ${entityType}
      - Régimen: ${regime}
      - País: ${currentUser?.country || 'Panamá'}
      - Proyección Anual: $${annualProj.toLocaleString()}

      METAS DEFINIDAS (SIMULADOR):
      - Meta de Facturación Mensual: $${monthlyTarget.toLocaleString()}
      - Costos Fijos Operativos: $${fixedCosts.toLocaleString()}

      RESULTADOS REALES (${timeRange}):
      - Facturación Cobrada: ${currencySymbol}${kpis.totalRevenue.toFixed(2)}
      - Gastos Totales: ${currencySymbol}${kpis.totalExpenses.toFixed(2)}
      - Margen Neto Real: ${kpis.marginPercent.toFixed(1)}%
      - Utilidad Neta: ${currencySymbol}${kpis.netMargin.toFixed(2)}
      
      COMPARATIVA OBJETIVOS:
      - Desviación Ingresos: ${monthlyTarget > 0 ? (((kpis.totalRevenue - monthlyTarget) / monthlyTarget) * 100).toFixed(1) : 0}% vs Meta
      - Cobertura Costos Fijos: ${kpis.totalRevenue >= fixedCosts ? 'Cubiertos' : 'NO CUBIERTOS'}

      CLIENTES Y SALUD:
      - Ciclo de Cobro (DSO): ${kpis.avgPaymentDays} días
      - Clientes Activos: ${kpis.activeClientsCount}
      - Clientes en Riesgo: ${kpis.churnRiskCount}
      - Top Cliente: ${ltvData[0]?.name || 'N/A'} ($${ltvData[0]?.revenue || 0})

      TENDENCIA HISTÓRICA:
      ${trendString}
    `;
    
    try {
        const result = await generateFinancialAnalysis(summary, apiKey);
        if (!result) throw new Error("La IA no pudo procesar los datos. Intenta nuevamente.");
        setAnalysis(result);
    } catch (e: any) {
        console.error(e);
        if (e.message === AI_ERROR_BLOCKED) setAiError("Función bloqueada: Configura tus API Keys.");
        else setAiError(e.message || "Error al generar el análisis.");
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleDeepDive = async (chartId: string, chartTitle: string, chartData: any) => {
    setIsDeepDiving(chartId);
    setDeepDiveReport(null);
    setDeepDiveError(false);
    
    let visualData = { type: chartId, data: chartData, title: chartTitle };
    let dataForAi = chartData; // Default to passed data (aggregated)

    if (chartId === 'cashflow') {
        const expenseBreakdown = new Map<string, number>();
        let totalExpenses = 0;
        let totalIncome = 0;

        filteredInvoices.forEach(inv => {
            if (inv.type === 'Invoice') {
                let collected = 0;
                if (inv.amountPaid && inv.amountPaid > 0) collected = inv.amountPaid;
                else if (inv.status === 'Pagada' || inv.status === 'Aceptada') collected = inv.total;
                if (collected > 0) totalIncome += collected;
            } else if (inv.type === 'Expense') {
                const category = inv.items[0]?.description || 'Gastos Varios';
                expenseBreakdown.set(category, (expenseBreakdown.get(category) || 0) + inv.total);
                totalExpenses += inv.total;
            }
        });

        const expensesArray = Array.from(expenseBreakdown.entries()).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
        const pnlData = { income: totalIncome, expenses: totalExpenses, breakdown: expensesArray };
        visualData = { type: 'cashflow', data: pnlData, title: 'Estado de Resultados (P&L)' };
        dataForAi = pnlData; // Use detailed P&L for AI
    } else if (chartId === 'products') {
        // 1. Prepare Detailed Ledger for Visual Table
        const productLedger: any[] = [];
        filteredInvoices.filter(i => i.type === 'Invoice' && i.status !== 'Borrador').forEach(inv => {
            inv.items.forEach(item => {
                productLedger.push({
                    date: inv.date,
                    docType: 'Factura', 
                    docNumber: inv.id,
                    client: inv.clientName,
                    description: item.description,
                    quantity: item.quantity,
                    price: item.price,
                    total: item.price * item.quantity
                });
            });
        });
        productLedger.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        visualData = { type: 'products', data: productLedger, title: 'Detalle de ventas por producto/servicio' };
        
        // 2. Prepare AI Data (Keep original aggregated data)
        dataForAi = chartData; 
    }

    setDeepDiveVisual(visualData);
    setDeepDiveAiData(dataForAi); // STORE AGGREGATED DATA FOR RETRIES

    if (hasAiAccess) fetchDeepDiveReport(chartTitle, dataForAi, chartId);
    else setIsDeepDiving(null);
  };

  const handleRetryDeepDive = () => {
      // USE deepDiveAiData INSTEAD OF visual.data to prevent schema mismatch on retry
      if (deepDiveVisual && deepDiveAiData) {
          setIsDeepDiving(deepDiveVisual.type);
          setDeepDiveError(false);
          setDeepDiveReport(null);
          fetchDeepDiveReport(deepDiveVisual.title, deepDiveAiData, deepDiveVisual.type);
      }
  };

  const fetchDeepDiveReport = async (chartTitle: string, chartData: any, type: string) => {
      if (!hasAiAccess) return;
      setDeepDiveReport(null);
      setDeepDiveError(false);
      let context = '';
      
      try {
        if (type === 'cashflow') {
            context = `
              ESTADO DE RESULTADOS (P&L) - ${timeRange}
              ------------------------------------------
              INGRESOS TOTALES: ${currencySymbol}${(chartData.income || 0).toFixed(2)}
              DESGLOSE DE GASTOS:
              ${(chartData.breakdown || []).map((b: any) => `- ${b.category}: ${currencySymbol}${b.amount.toFixed(2)}`).join('\n')}
              TOTAL GASTOS: ${currencySymbol}${(chartData.expenses || 0).toFixed(2)}
              UTILIDAD NETA: ${currencySymbol}${(chartData.income - chartData.expenses).toFixed(2)}
              ------------------------------------------
              INSTRUCCIÓN ESPECIAL PARA IA:
              Analiza estos gastos categoría por categoría.
              En 'strategicInsight', identifica qué categoría de gasto es desproporcionada.
              En 'recommendation', da 3 'Puntos a Mejorar' específicos para reducir esos gastos concretos y una 'Buena Práctica' financiera.
            `;
        } else if (type === 'products') {
            // SAFETY CHECK: Ensure chartData is array before slice/map
            if (!Array.isArray(chartData) || chartData.length === 0) {
                console.warn("Deep Dive: No product data available for AI");
                setDeepDiveError(true);
                return;
            }

            const topProducts = chartData.slice(0, 10).map((p: any) => 
               `- ${p.name}: ${currencySymbol}${(p.totalRevenue || 0).toFixed(2)} (${p.count || 0} ventas)`
            ).join('\n');

            context = `
              ANÁLISIS DE VENTAS POR PRODUCTO - ${timeRange}
              ------------------------------------------
              TOP PRODUCTOS (Ranking por Ingresos):
              ${topProducts}
              
              INSTRUCCIÓN ESPECIAL:
              Actúa como Gerente Comercial. Analiza el rendimiento del catálogo.
              
              GENERAR JSON con estos campos obligatorios:
              1. 'chartTitle': "${chartTitle}"
              2. 'executiveSummary': Resumen del desempeño del catálogo.
              3. 'keyMetrics': Genera 3 métricas calculadas del texto anterior (ej. "Producto Top", "Ventas Totales Top 10", "Promedio Venta"). Define 'trend' como 'neutral' si no hay histórico.
              4. 'strategicInsight': Identifica patrones de venta (Pareto 80/20, concentración).
              5. 'recommendation': 3 estrategias para optimizar el mix de productos (ej. Bundling, Promociones, Ajuste de precios).
            `;
        } else {
            let dataForAi = chartData;
            if (Array.isArray(chartData) && chartData.length > 30) dataForAi = chartData.slice(0, 30);
            context = `Periodo: ${timeRange}. Datos Reales (Muestra): ${JSON.stringify(dataForAi)}. Contexto KPI: Margen ${data.kpis.marginPercent.toFixed(1)}%, Conversión ${data.kpis.conversionRate.toFixed(1)}%.`;
        }
      
        const report = await generateDeepDiveReport(chartTitle, context, apiKey);
        if (report) setDeepDiveReport(report);
        else setDeepDiveError(true);

      } catch (e) {
          console.error("Deep Dive Error", e);
          setDeepDiveError(true);
      } finally {
          setIsDeepDiving(null);
      }
  };

  const renderDeepDiveTable = () => {
      if (!deepDiveVisual) return null;

      if (deepDiveVisual.type === 'cashflow') {
          const { income, expenses, breakdown } = deepDiveVisual.data;
          const net = income - expenses;
          const profitMargin = income > 0 ? (net / income) * 100 : 0;

          return (
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden mb-8 shadow-sm">
                  <div className="bg-slate-50 p-6 text-center border-b border-slate-200">
                      <h4 className="text-[#1c2938] font-bold text-lg">{currentUser?.name || 'Mi Empresa'}</h4>
                      <p className="text-slate-500 text-sm font-medium uppercase tracking-wider mt-1">Pérdidas y Ganancias</p>
                      <p className="text-slate-400 text-xs mt-1">{new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</p>
                  </div>
                  <div className="p-6 md:p-8 space-y-6">
                      <div>
                          <div className="flex justify-between items-center mb-2 group">
                              <button className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                  <ChevronDown className="w-4 h-4 text-slate-400" /> Ingresos
                              </button>
                              <span className="font-bold text-[#1c2938]">{currencySymbol}{income.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                          </div>
                          <div className="pl-6 pr-0 space-y-2">
                              <div className="flex justify-between items-center text-sm">
                                  <span className="text-slate-500">Ventas Brutas</span>
                                  <span className="text-slate-700">{currencySymbol}{income.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-100">
                                  <span className="font-bold text-slate-700">Total Ingresos</span>
                                  <span className="font-bold text-[#1c2938]">{currencySymbol}{income.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                              </div>
                          </div>
                      </div>
                      <div>
                          <div className="flex justify-between items-center mb-2">
                              <button className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                  <ChevronDown className="w-4 h-4 text-slate-400" /> Gastos Operativos
                              </button>
                              <span className="font-bold text-slate-700">{currencySymbol}{expenses.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                          </div>
                          <div className="pl-6 space-y-3">
                              {breakdown.length > 0 ? (
                                  breakdown.map((item: any, idx: number) => (
                                      <div key={idx} className="flex justify-between items-center text-sm group">
                                          <div className="flex items-center gap-2">
                                              <span className="text-slate-500 group-hover:text-[#1c2938] transition-colors">{item.category}</span>
                                              <div className="h-1.5 bg-rose-100 rounded-full" style={{ width: `${Math.min(100, (item.amount / expenses) * 50)}px` }}></div>
                                          </div>
                                          <span className="text-slate-700">{currencySymbol}{item.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                      </div>
                                  ))
                              ) : (
                                  <p className="text-xs text-slate-400 italic">Sin gastos registrados.</p>
                              )}
                              <div className="flex justify-between items-center text-sm pt-3 border-t border-slate-100">
                                  <span className="font-bold text-slate-700">Total Gastos</span>
                                  <span className="font-bold text-slate-700">{currencySymbol}{expenses.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                              </div>
                          </div>
                      </div>
                      <div className={`mt-6 p-4 rounded-xl flex justify-between items-center border ${net >= 0 ? 'bg-slate-50 border-slate-200' : 'bg-red-50 border-red-100'}`}>
                          <div>
                              <span className="block font-bold text-[#1c2938] text-lg">Utilidad Neta</span>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${net >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                  {profitMargin.toFixed(1)}% Margen
                              </span>
                          </div>
                          <span className={`text-2xl font-bold ${net >= 0 ? 'text-[#1c2938]' : 'text-red-600'}`}>
                              {currencySymbol}{net.toLocaleString(undefined, {minimumFractionDigits: 2})}
                          </span>
                      </div>
                  </div>
              </div>
          );
      }

      switch(deepDiveVisual.type) {
          case 'products':
              return (
                  <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden mb-8 shadow-sm">
                      <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                          <table className="w-full text-left text-sm">
                              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] sticky top-0 z-10 shadow-sm">
                                  <tr>
                                      <th className="p-3">Fecha</th>
                                      <th className="p-3">Doc</th>
                                      <th className="p-3">Cliente</th>
                                      <th className="p-3">Descripción / Ítem</th>
                                      <th className="p-3 text-right">Cant</th>
                                      <th className="p-3 text-right">Precio</th>
                                      <th className="p-3 text-right">Importe</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                  {deepDiveVisual.data.map((row: any, i: number) => (
                                      <tr key={i} className="hover:bg-slate-50/50 group">
                                          <td className="p-3 text-slate-500 whitespace-nowrap">{new Date(row.date).toLocaleDateString()}</td>
                                          <td className="p-3 text-slate-500 text-xs font-mono">{row.docNumber}</td>
                                          <td className="p-3 font-bold text-[#1c2938]">{row.client}</td>
                                          <td className="p-3 text-slate-600 group-hover:text-[#27bea5] transition-colors">{row.description}</td>
                                          <td className="p-3 text-right text-slate-500">{row.quantity}</td>
                                          <td className="p-3 text-right text-slate-500">{currencySymbol}{row.price.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                          <td className="p-3 text-right font-bold text-[#1c2938]">{currencySymbol}{row.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                      </tr>
                                  ))}
                              </tbody>
                              <tfoot className="bg-slate-50 font-bold text-[#1c2938] sticky bottom-0">
                                  <tr>
                                      <td colSpan={6} className="p-3 text-right uppercase text-xs">Total General</td>
                                      <td className="p-3 text-right text-lg">
                                          {currencySymbol}{deepDiveVisual.data.reduce((acc: number, curr: any) => acc + curr.total, 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                      </td>
                                  </tr>
                              </tfoot>
                          </table>
                      </div>
                  </div>
              );
          case 'funnel':
              return (
                  <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden mb-8 shadow-sm">
                      <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                              <tr><th className="p-4">Etapa</th><th className="p-4 text-right">Cantidad</th><th className="p-4 text-right">% Relativo</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                              {deepDiveVisual.data.map((row: any, i: number) => {
                                  const max = Math.max(...deepDiveVisual.data.map((d: any) => d.value));
                                  return (
                                      <tr key={i} className="hover:bg-slate-50/50">
                                          <td className="p-4 font-bold text-[#1c2938]">{row.name}</td>
                                          <td className="p-4 text-right font-medium">{row.value}</td>
                                          <td className="p-4 text-right text-slate-400">{max > 0 ? ((row.value / max) * 100).toFixed(0) : 0}%</td>
                                      </tr>
                                  );
                              })}
                          </tbody>
                      </table>
                  </div>
              );
          case 'scatter':
              return (
                  <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden mb-8 shadow-sm max-h-60 overflow-y-auto custom-scrollbar">
                      <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs sticky top-0">
                              <tr><th className="p-4">Cliente</th><th className="p-4">Ítems</th><th className="p-4 text-right">Monto</th><th className="p-4 text-right">Estado</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                              {deepDiveVisual.data.sort((a: any, b: any) => b.y - a.y).map((row: any, i: number) => (
                                  <tr key={i} className="hover:bg-slate-50/50">
                                      <td className="p-4 font-bold text-[#1c2938]">{row.client}</td>
                                      <td className="p-4 text-slate-500">{row.x}</td>
                                      <td className="p-4 text-right font-medium">{currencySymbol}{row.y.toLocaleString()}</td>
                                      <td className="p-4 text-right"><span className="text-[10px] bg-slate-100 px-2 py-1 rounded-full uppercase font-bold">{row.status}</span></td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              );
          case 'ltv':
              return (
                  <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden mb-8 shadow-sm">
                      <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                              <tr><th className="p-4">Cliente</th><th className="p-4 text-right">Facturación Histórica</th><th className="p-4 text-right">Docs</th><th className="p-4 text-right">Inactividad</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                              {deepDiveVisual.data.map((row: any, i: number) => (
                                  <tr key={i} className="hover:bg-slate-50/50">
                                      <td className="p-4 font-bold text-[#1c2938]">{row.name}</td>
                                      <td className="p-4 text-right font-medium text-emerald-600">{currencySymbol}{row.revenue.toLocaleString()}</td>
                                      <td className="p-4 text-right text-slate-500">{row.count}</td>
                                      <td className="p-4 text-right text-slate-400">{row.daysSinceLast} días</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              );
          default:
              return null;
      }
  };

  const renderOverview = () => (
    <div ref={overviewRef} className="p-4 bg-slate-50/50 rounded-[3rem] -m-4">
      <div className="p-4">
        {/* KPI CARDS - REAL DATA FIRST */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
           <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-50">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Ingreso Neto</p>
              <h3 className="text-2xl font-bold text-[#1c2938]">{currencySymbol}{data.kpis.totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3>
              <span className="text-[10px] text-slate-400">Cobrado (Total + Abonos)</span>
           </div>
           <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-50">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Margen Real</p>
              <h3 className={`text-2xl font-bold ${data.kpis.marginPercent > 0 ? 'text-[#27bea5]' : 'text-red-500'}`}>
                 {data.kpis.marginPercent.toFixed(1)}%
              </h3>
              <span className="text-[10px] text-slate-400">Rentabilidad</span>
           </div>
           <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-50">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Gastos</p>
              <h3 className="text-2xl font-bold text-rose-500">-{currencySymbol}{data.kpis.totalExpenses.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3>
              <span className="text-[10px] text-slate-400">Operativos</span>
           </div>
           <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-50">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Utilidad</p>
              <h3 className="text-2xl font-bold text-[#1c2938]">{currencySymbol}{data.kpis.netMargin.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3>
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
                    <p className="text-slate-400 text-sm mt-1 ml-11">Comparativa entre ingresos cobrados y gastos operativos.</p>
                  </div>
                  <button id="no-print" onClick={() => handleDeepDive('cashflow', 'Flujo de Caja', data.monthlyData)} className="p-3 rounded-xl bg-slate-50 hover:text-[#27bea5] transition-all" title="Ver Estado de Resultados Detallado">
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
                      <Bar dataKey="ingresos" name="Ingresos Cobrados" fill="#27bea5" radius={[6, 6, 0, 0]} barSize={24} />
                      <Bar dataKey="gastos" name="Gastos Totales" fill="#ef4444" radius={[6, 6, 0, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
              </div>
            </div>

            {/* Card: Sales Details by Product (NEW REPLACEMENT) */}
            <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-50 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="font-bold text-[#1c2938] text-xl flex items-center gap-2">
                      <div className="p-2 bg-slate-50 rounded-xl text-blue-500">
                        <Package className="w-5 h-5" />
                      </div>
                      Ventas por Producto
                    </h3>
                    <p className="text-slate-400 text-sm mt-1 ml-11">Top productos y servicios generadores de ingresos.</p>
                  </div>
                  <button id="no-print" onClick={() => handleDeepDive('products', 'Detalle de Ventas', data.productSalesData)} className="p-3 rounded-xl bg-slate-50 hover:text-blue-500 transition-all" title="Ver Detalle Completo">
                    {isDeepDiving === 'products' ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                  </button>
              </div>
              <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={data.productSalesData.slice(0, 5)} margin={{ top: 0, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                      <XAxis type="number" hide />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        width={100} 
                        tick={{fontSize: 10, fontWeight: 600, fill: '#64748b'}} 
                        axisLine={false} 
                        tickLine={false} 
                        tickFormatter={(val) => val.length > 15 ? val.slice(0, 15) + '...' : val}
                      />
                      <Tooltip 
                        cursor={{fill: 'transparent'}} 
                        contentStyle={{ borderRadius: '12px', border: 'none' }}
                        formatter={(value: number) => [`${currencySymbol}${value.toLocaleString()}`, 'Ingresos']}
                      />
                      <Bar dataKey="totalRevenue" fill="#3b82f6" radius={[0, 6, 6, 0]} barSize={24} name="Ingresos">
                        {data.productSalesData.slice(0, 5).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? '#27bea5' : '#3b82f6'} />
                        ))}
                      </Bar>
                    </BarChart>
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
                    <p className="text-slate-400 text-sm mt-1 ml-11">Visualiza la conversión de tus documentos desde borrador hasta pago.</p>
                  </div>
                  <button id="no-print" onClick={() => handleDeepDive('funnel', 'Embudo de Ventas', data.funnelData)} className="p-3 rounded-xl bg-slate-50 hover:text-indigo-500 transition-all">
                    {isDeepDiving === 'funnel' ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
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
                    <p className="text-slate-400 text-sm mt-1 ml-11">Relación entre la cantidad de ítems y el monto total por factura.</p>
                  </div>
                  <button id="no-print" onClick={() => handleDeepDive('scatter', 'Distribución de Valor', data.scatterData)} className="p-3 rounded-xl bg-slate-50 hover:text-rose-500 transition-all">
                    {isDeepDiving === 'scatter' ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
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
      {/* ... (Existing Clients View Code) ... */}
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
                  <p className="text-slate-400 text-sm mt-1 ml-11">Ranking de clientes basado en el volumen total facturado históricamente.</p>
                </div>
                <button id="no-print" onClick={() => handleDeepDive('ltv', 'Valor de Clientes', data.ltvData.slice(0,10))} className="p-3 rounded-xl bg-slate-50 hover:text-amber-500 transition-all">
                    {isDeepDiving === 'ltv' ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
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

          {/* Retention Pie - FIXED ALIGNMENT */}
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-50 hover:shadow-md transition-shadow relative overflow-hidden">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-[#1c2938] text-xl flex items-center gap-2">
                    <div className="p-2 bg-slate-50 rounded-xl text-emerald-500">
                      <Target className="w-5 h-5" />
                    </div>
                    Salud de Cartera
                  </h3>
                  <p className="text-slate-400 text-sm mt-1 ml-11">Proporción de clientes activos versus aquellos en riesgo de inactividad.</p>
                </div>
                <button id="no-print" onClick={() => handleDeepDive('retention', 'Salud de Cartera', data.clientActivityData)} className="p-3 rounded-xl bg-slate-50 hover:text-emerald-500 transition-all">
                    {isDeepDiving === 'retention' ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
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
                      <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                    </PieChart>
                </ResponsiveContainer>
                {/* ABSOLUTE CENTERED TEXT */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                    <p className="text-3xl font-bold text-[#1c2938]">{data.ltvData.length}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total</p>
                </div>
              </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderFiscalView = () => {
    // ... (Existing Fiscal View Code) ...
    if (!fiscalData) return (
      <div className="p-12 text-center text-slate-400 bg-slate-50 rounded-[3rem] border border-slate-100">
         <Landmark className="w-16 h-16 mx-auto mb-4 opacity-50" />
         <p>Configura tu Perfil Fiscal en Ajustes para ver este reporte.</p>
      </div>
    );

    return (
      <div ref={fiscalRef} className="p-4 bg-slate-50/50 rounded-[3rem] -m-4">
         <div className="p-4">
            
            {/* Top: Estimated Tax Liability (LIQUIDACIÓN ITBMS) */}
            <div className={`rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl mb-8 ${fiscalData.isCreditBalance ? 'bg-gradient-to-r from-emerald-600 to-teal-500' : 'bg-gradient-to-r from-amber-600 to-orange-500'}`}>
               <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-[120px] opacity-10 -translate-y-1/2 translate-x-1/2"></div>
               <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                  <div>
                     <div className="flex items-center gap-2 text-white/80 font-bold mb-2 uppercase tracking-widest text-xs">
                        <Scale className="w-4 h-4" /> Liquidación ITBMS Estimada
                     </div>
                     <h2 className="text-5xl font-bold mb-2">
                        {currencySymbol}{Math.abs(fiscalData.payable).toLocaleString(undefined, {maximumFractionDigits: 2})}
                     </h2>
                     <p className="text-white/90 font-medium">
                        {fiscalData.isCreditBalance ? 'Crédito a Favor (Saldo para el próximo mes)' : 'A Pagar a la DGI este periodo'}
                     </p>
                  </div>
                  
                  {/* The Fiscal Formula Visualization */}
                  <div className="flex-1 w-full max-w-lg bg-white/10 p-6 rounded-2xl border border-white/20">
                     <div className="flex justify-between items-center text-sm mb-2 opacity-80">
                        <span>Débito (Ventas)</span>
                        <span className="font-mono">{currencySymbol}{fiscalData.debitFiscal.toFixed(2)}</span>
                     </div>
                     <div className="flex justify-between items-center text-sm mb-2 opacity-80">
                        <span>(-) Crédito (Compras)</span>
                        <span className="font-mono">{currencySymbol}{fiscalData.creditFiscal.toFixed(2)}</span>
                     </div>
                     <div className="flex justify-between items-center text-sm mb-3 opacity-80 border-b border-white/20 pb-2">
                        <span>(-) Retenciones Sufridas</span>
                        <span className="font-mono">{currencySymbol}{fiscalData.withholdings.toFixed(2)}</span>
                     </div>
                     <div className="flex justify-between items-center font-bold text-lg">
                        <span>Resultado Neto</span>
                        <span>{currencySymbol}{fiscalData.payable.toFixed(2)}</span>
                     </div>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               
               {/* LEFT: AUDITOR VIRTUAL ALERTS */}
               <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-50 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-6">
                     <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                        <ShieldCheck className="w-6 h-6" />
                     </div>
                     <div>
                        <h3 className="text-xl font-bold text-[#1c2938]">Auditor Virtual</h3>
                        <p className="text-xs text-slate-400">Análisis de cumplimiento y riesgos detectados.</p>
                     </div>
                  </div>

                  <div className="space-y-4">
                     {fiscalData.insights.length > 0 ? (
                        fiscalData.insights.map((insight, idx) => (
                           <div key={idx} className={`p-4 rounded-2xl border flex gap-3 ${
                              insight.type === 'alert' ? 'bg-red-50 border-red-100 text-red-800' :
                              insight.type === 'warning' ? 'bg-amber-50 border-amber-100 text-amber-800' :
                              insight.type === 'info' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' :
                              'bg-blue-50 border-blue-100 text-blue-800'
                           }`}>
                              {insight.type === 'alert' && <FileWarning className="w-5 h-5 flex-shrink-0" />}
                              {insight.type === 'warning' && <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
                              {insight.type === 'info' && <PiggyBank className="w-5 h-5 flex-shrink-0" />}
                              {insight.type === 'tip' && <Lightbulb className="w-5 h-5 flex-shrink-0" />}
                              
                              <div>
                                  <p className="text-sm font-bold mb-0.5">{insight.title}</p>
                                  <p className="text-xs opacity-90 leading-relaxed">{insight.text}</p>
                              </div>
                           </div>
                        ))
                     ) : (
                        <div className="text-center py-8 text-slate-400">
                           <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-200" />
                           <p>Todo en orden. No se detectaron anomalías.</p>
                        </div>
                     )}
                  </div>
               </div>

               {/* RIGHT: DEDUCTIBILITY BREAKDOWN */}
               <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-50 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-6">
                     <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                        <FileText className="w-6 h-6" />
                     </div>
                     <div>
                        <h3 className="text-xl font-bold text-[#1c2938]">Calidad del Gasto</h3>
                        <p className="text-xs text-slate-400">¿Qué tanto de lo que gastas es deducible?</p>
                     </div>
                  </div>

                  <div className="flex items-center justify-center py-4">
                      {fiscalData.creditFiscal > 0 || fiscalData.nonDeductibleTotal > 0 ? (
                          <div className="relative w-40 h-40">
                              <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                      <Pie
                                          data={[
                                              { name: 'Deducible', value: fiscalData.creditFiscal, color: '#27bea5' },
                                              { name: 'No Deducible', value: fiscalData.nonDeductibleTotal * 0.07, color: '#ef4444' } // Approx tax lost
                                          ]}
                                          innerRadius={35}
                                          outerRadius={55}
                                          dataKey="value"
                                      >
                                          <Cell fill="#27bea5" />
                                          <Cell fill="#ef4444" />
                                      </Pie>
                                  </PieChart>
                              </ResponsiveContainer>
                              <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                                  <span className="text-2xl font-bold text-slate-700">{Math.round((fiscalData.creditFiscal / (fiscalData.creditFiscal + (fiscalData.nonDeductibleTotal * 0.07))) * 100)}%</span>
                                  <span className="text-[8px] uppercase font-bold text-slate-400">Eficiencia</span>
                              </div>
                          </div>
                      ) : (
                          <p className="text-sm text-slate-400 py-10">No hay gastos registrados.</p>
                      )}
                  </div>

                  <div className="space-y-3 mt-2">
                      <div className="flex justify-between items-center text-sm p-3 bg-slate-50 rounded-xl">
                          <span className="flex items-center gap-2 text-slate-600"><CheckCircle2 className="w-4 h-4 text-green-500" /> Crédito Fiscal Usado</span>
                          <span className="font-bold text-[#1c2938]">{currencySymbol}{fiscalData.creditFiscal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm p-3 bg-red-50 rounded-xl border border-red-100">
                          <span className="flex items-center gap-2 text-red-800"><XCircle className="w-4 h-4 text-red-500" /> Crédito Perdido (Vouchers)</span>
                          <span className="font-bold text-red-800">~{currencySymbol}{(fiscalData.nonDeductibleTotal * 0.07).toFixed(2)}</span>
                      </div>
                  </div>
               </div>

            </div>
         </div>
      </div>
    );
  };

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
             <button
                 onClick={() => setTimeRange('THIS_MONTH')}
                 className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${
                   timeRange === 'THIS_MONTH' 
                     ? 'bg-[#1c2938] text-white shadow-md' 
                     : 'text-slate-400 hover:text-slate-600'
                 }`}
               >
                 Mes Actual
             </button>
             <button
                 onClick={() => setTimeRange('LAST_QUARTER')}
                 className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${
                   timeRange === 'LAST_QUARTER' 
                     ? 'bg-[#1c2938] text-white shadow-md' 
                     : 'text-slate-400 hover:text-slate-600'
                 }`}
               >
                 Último Trimestre
             </button>
             <button
                 onClick={() => setTimeRange('THIS_YEAR')}
                 className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${
                   timeRange === 'THIS_YEAR' 
                     ? 'bg-[#1c2938] text-white shadow-md' 
                     : 'text-slate-400 hover:text-slate-600'
                 }`}
               >
                 Todo el Año
             </button>
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
                     
                     {/* ERROR FEEDBACK */}
                     {aiError && (
                        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 text-red-200 rounded-xl text-sm flex items-center gap-2 animate-in fade-in">
                           <AlertCircle className="w-4 h-4 flex-shrink-0" />
                           {aiError}
                        </div>
                     )}

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
               <div ref={analysisRef} className="animate-in fade-in slide-in-from-bottom-4">
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

                  {/* ACTION BUTTONS (Updated: PDF only, targeting analysisRef) */}
                  <div className="flex flex-wrap gap-4 pt-4 border-t border-white/10">
                     <button 
                        onClick={() => handleExportPdf(analysisRef, 'Reporte_CFO_IA')}
                        disabled={!!isExporting}
                        className="bg-white text-[#1c2938] px-6 py-3 rounded-xl font-bold hover:bg-[#27bea5] hover:text-white transition-all flex items-center gap-2 shadow-lg disabled:opacity-50"
                     >
                        {isExporting === 'pdf' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                        Descargar Reporte PDF
                     </button>
                  </div>
               </div>
            )}
         </div>
      </div>

      {/* TABS NAVIGATION */}
      <div id="no-print" className="flex justify-center w-full">
         <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 flex overflow-x-auto max-w-full custom-scrollbar">
            {(['OVERVIEW', 'DOCUMENTS', 'CLIENTS', 'FISCAL'] as const).map(tab => (
               <button
                 key={tab}
                 onClick={() => setActiveTab(tab)}
                 className={`px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap flex items-center gap-2 ${
                   activeTab === tab
                     ? 'bg-[#1c2938] text-white shadow-md' 
                     : 'text-slate-500 hover:text-[#1c2938] hover:bg-slate-100'
                 }`}
               >
                 {tab === 'OVERVIEW' ? <LayoutDashboard className="w-4 h-4" /> : 
                  tab === 'DOCUMENTS' ? <FileBarChart className="w-4 h-4" /> : 
                  tab === 'CLIENTS' ? <Users className="w-4 h-4" /> : 
                  <Landmark className="w-4 h-4" />}
                 {tab === 'OVERVIEW' ? 'Finanzas' : 
                  tab === 'DOCUMENTS' ? 'Operatividad' : 
                  tab === 'CLIENTS' ? 'Clientes' : 
                  'Reporte Fiscal'}
               </button>
            ))}
         </div>
      </div>
      
      {/* WRAPPER FOR TAB CONTENT */}
      <div className="space-y-10 p-4 -m-4">
        {activeTab === 'OVERVIEW' && renderOverview()}
        {activeTab === 'DOCUMENTS' && renderDocumentsView()}
        {activeTab === 'CLIENTS' && renderClientsView()}
        {activeTab === 'FISCAL' && renderFiscalView()}
      </div>

      {/* MODAL: DEEP DIVE REPORT (PORTAL) */}
      {(deepDiveVisual || deepDiveReport || isDeepDiving || deepDiveError) && createPortal(
        <div className="fixed inset-0 z-[99] flex items-center justify-center p-4 bg-[#1c2938]/60 backdrop-blur-md animate-in fade-in">
           <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col relative animate-in zoom-in-95 duration-300">
              
              {/* Header */}
              <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-white rounded-t-[2.5rem]">
                 <div className="flex items-center gap-3">
                   <div className="p-2 bg-[#27bea5]/10 rounded-xl text-[#27bea5]">
                     <FileText className="w-6 h-6" />
                   </div>
                   <div>
                     <h3 className="font-bold text-[#1c2938] text-xl">Reporte Detallado</h3>
                     <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                        {deepDiveVisual?.title || deepDiveReport?.chartTitle || 'Análisis de Datos'}
                     </p>
                   </div>
                 </div>
                 <button 
                    onClick={() => {
                        setDeepDiveReport(null);
                        setDeepDiveVisual(null);
                        setIsDeepDiving(null);
                        setDeepDiveError(false);
                    }} 
                    className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-[#1c2938]"
                 >
                   <X className="w-6 h-6" />
                 </button>
              </div>

              {/* Scrollable Content */}
              <div ref={deepDiveRef} className="p-8 md:p-12 overflow-y-auto custom-scrollbar flex-1 bg-white rounded-b-[2.5rem]">
                 
                 {/* 1. VISUALIZATION (Chart Copy or Data) - ALWAYS VISIBLE */}
                 {deepDiveVisual && (
                    <div className="mb-10 animate-in slide-in-from-bottom-4">
                       <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                          <Table className="w-4 h-4" /> Datos del Reporte
                       </h4>
                       {renderDeepDiveTable()}
                    </div>
                 )}

                 {/* 2. AI ANALYSIS CONTENT (Enhanced) */}
                 {deepDiveReport ? (
                    <div className="prose prose-slate max-w-none animate-in slide-in-from-bottom-4 border-t border-slate-100 pt-8">
                        <div className="bg-slate-50 p-6 rounded-2xl mb-8 border border-slate-100 relative overflow-hidden">
                           <div className="absolute top-0 right-0 p-4 opacity-10">
                              <BrainCircuit className="w-24 h-24 text-[#27bea5]" />
                           </div>
                           <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2 relative z-10">
                              <Sparkles className="w-4 h-4 text-[#27bea5]" /> Interpretación Inteligente
                           </h4>
                           <p className="text-[#1c2938] font-medium leading-relaxed relative z-10">{deepDiveReport.executiveSummary}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                           {deepDiveReport.keyMetrics.map((metric, idx) => (
                              <div key={idx} className="p-4 border border-slate-100 rounded-2xl hover:border-[#27bea5] transition-colors group bg-white shadow-sm">
                                 <p className="text-xs text-slate-400 mb-1">{metric.label}</p>
                                 <div className="flex items-center gap-2">
                                    <span className="text-2xl font-bold text-[#1c2938]">{metric.value}</span>
                                    {metric.trend === 'up' && <TrendingUp className="w-4 h-4 text-green-500" />}
                                    {metric.trend === 'down' && <TrendingDown className="w-4 h-4 text-red-500" />}
                                 </div>
                              </div>
                           ))}
                        </div>

                        <h4 className="text-xl font-bold text-[#1c2938] mb-4">Hallazgos Clave</h4>
                        <p className="text-slate-600 leading-relaxed mb-8 whitespace-pre-wrap">{deepDiveReport.strategicInsight}</p>

                        <div className="bg-[#1c2938] text-white p-8 rounded-[2rem] relative overflow-hidden shadow-lg">
                           <div className="absolute top-0 right-0 w-32 h-32 bg-[#27bea5] rounded-full blur-[50px] opacity-20 -translate-y-1/2 translate-x-1/2"></div>
                           <div className="relative z-10">
                              <h4 className="font-bold text-[#27bea5] mb-3 flex items-center gap-2">
                                 <Lightbulb className="w-5 h-5" /> Recomendación Táctica
                              </h4>
                              <p className="text-lg font-light leading-relaxed">{deepDiveReport.recommendation}</p>
                           </div>
                        </div>
                    </div>
                 ) : (
                    // LOADING OR ERROR STATE
                    hasAiAccess && (
                        <div className="flex flex-col items-center justify-center py-8 text-center border-t border-slate-100 mt-4">
                            {deepDiveError ? (
                                <div className="animate-in fade-in flex flex-col items-center gap-3">
                                    <div className="p-3 bg-amber-50 text-amber-600 rounded-full">
                                      <BrainCircuit className="w-6 h-6" />
                                    </div>
                                    <div>
                                      <p className="font-bold text-slate-600">Análisis de IA no disponible</p>
                                      <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
                                        No se pudo generar la interpretación automática. Puedes reintentar o usar los datos de la tabla superior.
                                      </p>
                                    </div>
                                    <button 
                                      onClick={() => handleRetryDeepDive()}
                                      className="mt-2 text-xs font-bold text-[#27bea5] hover:underline flex items-center gap-1"
                                    >
                                      <RefreshCw className="w-3 h-3" /> Reintentar Análisis
                                    </button>
                                </div>
                            ) : (
                                <div className="text-slate-400 flex flex-col items-center gap-2">
                                    <Loader2 className="w-6 h-6 animate-spin text-[#27bea5]" />
                                    <p className="font-medium text-sm">El Analista Virtual está revisando los datos...</p>
                                </div>
                            )}
                        </div>
                    )
                 )}
              </div>

              {/* Footer Actions */}
              <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-white rounded-b-[2.5rem]">
                  <button 
                    onClick={() => handleExportPdf(deepDiveRef, `Reporte_${deepDiveVisual?.title || 'Detalle'}`)}
                    className="px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" /> Exportar PDF
                  </button>
                  <button 
                    onClick={() => {
                        setDeepDiveReport(null);
                        setDeepDiveVisual(null);
                        setIsDeepDiving(null);
                        setDeepDiveError(false);
                    }}
                    className="px-6 py-3 rounded-xl bg-[#1c2938] text-white font-bold hover:bg-[#27bea5] transition-colors"
                  >
                    Cerrar
                  </button>
              </div>
           </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default ReportsDashboard;
