import React, { useState } from 'react';
import {
    Calculator, ArrowLeft, Calendar, DollarSign,
    Info, AlertTriangle, RefreshCw, CheckCircle2
} from 'lucide-react';
import { calculateLateInterest, calculateLatePenalty } from '../services/accountantService';

interface FiscalCalculatorsProps {
    onBack: () => void;
    initialType?: 'INTEREST' | 'SANCTION';
}

const FiscalCalculators: React.FC<FiscalCalculatorsProps> = ({ onBack, initialType = 'INTEREST' }) => {
    const [activeTab, setActiveTab] = useState<'INTEREST' | 'SANCTION'>(initialType);

    // Interest Calculator State
    const [amount, setAmount] = useState<number>(0);
    const [dueDate, setDueDate] = useState<string>('');
    const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [interestResult, setInterestResult] = useState<number | null>(null);

    // Sanction Calculator State
    const [penaltyTaxType, setPenaltyTaxType] = useState<'ITBMS' | 'ISR_NATURAL' | 'ISR_JURIDICO'>('ITBMS');
    const [monthsLate, setMonthsLate] = useState<number>(1);
    const [isFirstTime, setIsFirstTime] = useState<boolean>(true);
    const [penaltyResult, setPenaltyResult] = useState<number | null>(null);

    const handleCalculateInterest = () => {
        if (!amount || !dueDate || !paymentDate) return;
        const result = calculateLateInterest(amount, new Date(dueDate), new Date(paymentDate));
        setInterestResult(result);
    };

    const handleCalculatePenalty = () => {
        const result = calculateLatePenalty(penaltyTaxType, monthsLate, isFirstTime);
        setPenaltyResult(result);
    };

    return (
        <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
            <button
                onClick={onBack}
                className="flex items-center gap-2 text-slate-400 hover:text-[#1c2938] transition-colors mb-6 group"
            >
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                <span className="font-bold text-sm uppercase tracking-widest">Volver al Panel</span>
            </button>

            <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden">
                {/* TAB NAVIGATION */}
                <div className="flex bg-slate-50 p-2">
                    <button
                        onClick={() => setActiveTab('INTEREST')}
                        className={`flex-1 py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'INTEREST' ? 'bg-white text-[#1c2938] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <Calculator className="w-4 h-4" />
                        Intereses Moratorios
                    </button>
                    <button
                        onClick={() => setActiveTab('SANCTION')}
                        className={`flex-1 py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'SANCTION' ? 'bg-white text-[#1c2938] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <AlertTriangle className="w-4 h-4" />
                        Sanción Extemporaneidad
                    </button>
                </div>

                <div className="p-8 md:p-12">
                    {activeTab === 'INTEREST' ? (
                        <div className="space-y-8">
                            <div>
                                <h2 className="text-2xl font-bold text-[#1c2938] mb-2">Liquidador de Intereses</h2>
                                <p className="text-slate-500 text-sm">Cálculo basado en la tasa de interés anual del 10% (DGI Panamá).</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Monto del Impuesto</label>
                                    <div className="relative group">
                                        <DollarSign className="absolute left-4 top-4 w-5 h-5 text-slate-300 group-focus-within:text-[#27bea5] transition-colors" />
                                        <input
                                            type="number"
                                            value={amount || ''}
                                            onChange={(e) => setAmount(parseFloat(e.target.value))}
                                            placeholder="0.00"
                                            className="w-full pl-10 p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-[#27bea5] outline-none transition-all font-bold text-[#1c2938]"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Fecha de Vencimiento</label>
                                    <div className="relative group">
                                        <Calendar className="absolute left-4 top-4 w-5 h-5 text-slate-300 group-focus-within:text-[#27bea5] transition-colors" />
                                        <input
                                            type="date"
                                            value={dueDate}
                                            onChange={(e) => setDueDate(e.target.value)}
                                            className="w-full pl-10 p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-[#27bea5] outline-none transition-all font-bold text-[#1c2938]"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Fecha de Pago</label>
                                    <div className="relative group">
                                        <Calendar className="absolute left-4 top-4 w-5 h-5 text-slate-300 group-focus-within:text-[#27bea5] transition-colors" />
                                        <input
                                            type="date"
                                            value={paymentDate}
                                            onChange={(e) => setPaymentDate(e.target.value)}
                                            className="w-full pl-10 p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-[#27bea5] outline-none transition-all font-bold text-[#1c2938]"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row items-center gap-6 pt-4 border-t border-slate-50">
                                <button
                                    onClick={handleCalculateInterest}
                                    className="w-full md:w-auto px-10 py-4 bg-[#1c2938] text-white rounded-2xl font-bold hover:bg-[#27bea5] transition-all flex items-center justify-center gap-2 shadow-lg"
                                >
                                    <RefreshCw className="w-5 h-5" />
                                    Calcular Interés
                                </button>

                                {interestResult !== null && (
                                    <div className="flex-1 w-full p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-center justify-between animate-in zoom-in-95">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                                                <Info className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Interés Moratorio</p>
                                                <p className="text-2xl font-bold text-amber-700">${interestResult.toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-amber-500 font-bold uppercase">Total a Pagar</p>
                                            <p className="text-lg font-bold text-[#1c2938]">${(amount + interestResult).toLocaleString()}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            <div>
                                <h2 className="text-2xl font-bold text-[#1c2938] mb-2">Sanción por Extemporaneidad</h2>
                                <p className="text-slate-500 text-sm">Determina la multa fija por presentar fuera de la fecha límite.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Tipo de Impuesto</label>
                                    <select
                                        value={penaltyTaxType}
                                        onChange={(e) => setPenaltyTaxType(e.target.value as any)}
                                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-[#27bea5] outline-none transition-all font-bold text-[#1c2938]"
                                    >
                                        <option value="ITBMS">ITBMS (Mensual)</option>
                                        <option value="ISR_NATURAL">Renta Natural (Anual)</option>
                                        <option value="ISR_JURIDICO">Renta Jurídica (Anual)</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Meses o Fracción</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={monthsLate}
                                        onChange={(e) => setMonthsLate(parseInt(e.target.value))}
                                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-[#27bea5] outline-none transition-all font-bold text-[#1c2938]"
                                    />
                                </div>

                                <div className="space-y-2 flex flex-col justify-end pb-3">
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div
                                            onClick={() => setIsFirstTime(!isFirstTime)}
                                            className={`w-6 h-6 rounded-md border-2 transition-all flex items-center justify-center ${isFirstTime ? 'bg-[#27bea5] border-[#27bea5]' : 'bg-white border-slate-200 group-hover:border-[#27bea5]'}`}
                                        >
                                            {isFirstTime && <CheckCircle2 className="w-4 h-4 text-white" />}
                                        </div>
                                        <span className="text-sm font-bold text-[#1c2938]">Es primera vez</span>
                                    </label>
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row items-center gap-6 pt-4 border-t border-slate-50">
                                <button
                                    onClick={handleCalculatePenalty}
                                    className="w-full md:w-auto px-10 py-4 bg-[#1c2938] text-white rounded-2xl font-bold hover:bg-[#27bea5] transition-all flex items-center justify-center gap-2 shadow-lg"
                                >
                                    <RefreshCw className="w-5 h-5" />
                                    Liquidar Sanción
                                </button>

                                {penaltyResult !== null && (
                                    <div className="flex-1 w-full p-4 bg-rose-50 rounded-2xl border border-rose-100 flex items-center justify-between animate-in zoom-in-95">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
                                                <AlertTriangle className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest">Monto de la Multa</p>
                                                <p className="text-2xl font-bold text-rose-700">${penaltyResult.toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <div className="text-right text-xs text-rose-500 font-medium max-w-[150px]">
                                            Sanción fija establecida según Código Fiscal de Panamá.
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-8 p-6 bg-blue-50/50 rounded-2xl border border-blue-100 flex gap-4">
                <Info className="w-6 h-6 text-blue-500 flex-shrink-0" />
                <p className="text-sm text-blue-700 leading-relaxed">
                    <strong>Nota Legal:</strong> Estos cálculos son estimaciones informativas basadas en las tasas generales de la DGI. No sustituyen la liquidación oficial realizada a través del sistema e-Tax 2.0. Consulta siempre con la normativa vigente.
                </p>
            </div>
        </div>
    );
};

export default FiscalCalculators;
