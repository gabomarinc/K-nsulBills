import React from 'react';
import {
    Calendar as CalendarIcon, ArrowLeft, ArrowRight,
    ChevronLeft, ChevronRight, AlertTriangle,
    CheckCircle2, Clock, Landmark
} from 'lucide-react';

interface TaxCalendarProps {
    onBack: () => void;
}

const TaxCalendar: React.FC<TaxCalendarProps> = ({ onBack }) => {
    // Demo Data for Panama DGI Deadlines
    const deadlines = [
        { date: '2026-01-15', title: 'Informe de Ventas (F43)', category: 'MENSUAL', type: 'MENSUAL', status: 'TODO' },
        { date: '2026-01-15', title: 'ITBMS (F430)', category: 'MENSUAL', type: 'MENSUAL', status: 'URGENT' },
        { date: '2026-01-20', title: 'Planilla SIPE (CSS)', category: 'SOCIAL', type: 'MENSUAL', status: 'TODO' },
        { date: '2026-01-31', title: 'Tasa Única Anual', category: 'CORPORATIVA', type: 'ANUAL', status: 'WARN' },
        { date: '2026-03-15', title: 'Declaración de Renta (Individual)', category: 'RENTA', type: 'ANUAL', status: 'FUTURE' },
        { date: '2026-03-31', title: 'Declaración de Renta (Jurídica)', category: 'RENTA', type: 'ANUAL', status: 'FUTURE' },
    ];

    const currentMonth = 'Enero 2026';

    return (
        <div className="max-w-5xl mx-auto animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-slate-400 hover:text-[#1c2938] transition-colors mb-2 group"
                    >
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        <span className="font-bold text-sm uppercase tracking-widest">Volver</span>
                    </button>
                    <h2 className="text-3xl font-bold text-[#1c2938]">Calendario Fiscal</h2>
                </div>

                <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
                    <button className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
                        <ChevronLeft className="w-5 h-5 text-slate-400" />
                    </button>
                    <span className="font-bold text-[#1c2938] px-4">{currentMonth}</span>
                    <button className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* CALENDAR VIEW (Simplified Placeholder) */}
                <div className="lg:col-span-3">
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
                            {['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁ'].map(day => (
                                <div key={day} className="py-4 text-center text-[10px] font-bold text-slate-400">
                                    {day}
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7">
                            {/* This is a visual-only mockup of a calendar grid */}
                            {Array.from({ length: 35 }).map((_, i) => {
                                const day = i - 3; // Padding for visual start
                                const isCurrentMonth = day > 0 && day <= 31;
                                const hasDeadline = day === 15 || day === 20 || day === 31;

                                return (
                                    <div
                                        key={i}
                                        className={`h-24 md:h-32 p-3 border-b border-r border-slate-50 relative transition-all ${isCurrentMonth ? 'bg-white' : 'bg-slate-50/30'}`}
                                    >
                                        {isCurrentMonth && (
                                            <span className={`text-sm font-bold ${hasDeadline ? 'text-[#27bea5]' : 'text-slate-400'}`}>
                                                {day}
                                            </span>
                                        )}
                                        {isCurrentMonth && hasDeadline && (
                                            <div className="mt-2 space-y-1">
                                                <div className={`w-full h-1.5 rounded-full ${day === 15 ? 'bg-rose-400' : 'bg-amber-400'}`}></div>
                                                <div className="hidden md:block text-[9px] font-bold text-slate-500 truncate">
                                                    {day === 15 ? 'ITBMS / Ventas' : day === 20 ? 'SIPE' : 'Tasa Única'}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* DEADLINE LIST */}
                <div className="space-y-6">
                    <h3 className="text-xl font-bold text-[#1c2938] flex items-center gap-2">
                        <Landmark className="w-5 h-5 text-[#27bea5]" /> Próximas Fechas
                    </h3>
                    <div className="space-y-4">
                        {deadlines.filter(d => d.date.startsWith('2026-01')).map((d, i) => (
                            <div key={i} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                                {d.status === 'URGENT' && <div className="absolute top-0 right-0 w-12 h-12 bg-rose-50 rounded-bl-[2rem] flex items-center justify-center text-rose-500">
                                    <AlertTriangle className="w-4 h-4" />
                                </div>}
                                <div className="flex items-center gap-3 mb-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${d.status === 'URGENT' ? 'bg-rose-50 text-rose-500' :
                                            d.status === 'WARN' ? 'bg-amber-50 text-amber-500' :
                                                'bg-slate-50 text-slate-500'
                                        }`}>
                                        {d.date.split('-')[2]}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm text-[#1c2938]">{d.title}</h4>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{d.category}</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between text-[10px]">
                                    <span className="font-bold px-2 py-1 bg-slate-50 rounded text-slate-500">{d.type}</span>
                                    {d.status === 'URGENT' ? (
                                        <span className="text-rose-500 font-bold flex items-center gap-1"><Clock className="w-3 h-3" /> Vence Pronto</span>
                                    ) : (
                                        <span className="text-[#27bea5] font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Programado</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-xs text-slate-400 leading-relaxed italic">
                            * Fechas basadas en el último dígito del RUC y regulaciones DGI vigentes para 2026.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TaxCalendar;
