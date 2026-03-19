import React, { useState } from 'react';
import {
    Building2, Users, Calendar, Calculator, Sparkles,
    ArrowRight, Search, Filter, AlertCircle, CheckCircle2,
    TrendingUp, Clock, Briefcase, Plus, MoreVertical
} from 'lucide-react';
import { UserProfile, DbClient } from '../types';

interface AccountantDashboardProps {
    currentUser: UserProfile;
    managedCompanies: UserProfile[];
    onSelectCompany: (company: UserProfile) => void;
    onViewCalculator: (type: 'INTEREST' | 'SANCTION') => void;
    onViewTasks: () => void;
    onViewCalendar: () => void;
}

const AccountantDashboard: React.FC<AccountantDashboardProps> = ({
    currentUser,
    managedCompanies,
    onSelectCompany,
    onViewCalculator,
    onViewTasks,
    onViewCalendar
}) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredCompanies = managedCompanies.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.legalName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* HEADER SECTION */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[#1c2938]">Panel de Contador</h1>
                    <p className="text-slate-500">Gestiona tus clientes y obligaciones fiscales desde un solo lugar.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={onViewCalendar}
                        className="p-3 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors shadow-sm relative group"
                        title="Calendario Fiscal"
                    >
                        <Calendar className="w-5 h-5" />
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-white"></span>
                    </button>
                    <button
                        onClick={onViewTasks}
                        className="flex items-center gap-2 px-4 py-3 bg-[#1c2938] text-white rounded-xl font-bold hover:bg-[#27bea5] transition-all shadow-lg hover:shadow-[#27bea5]/20"
                    >
                        <Sparkles className="w-4 h-4" />
                        <span>Gestor IA</span>
                    </button>
                </div>
            </div>

            {/* QUICK STATS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: 'Empresas', value: managedCompanies.length, icon: Building2, color: 'text-blue-500', bg: 'bg-blue-50' },
                    { label: 'Tareas Pendientes', value: 12, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
                    { label: 'Vencimientos Hoy', value: 2, icon: AlertCircle, color: 'text-rose-500', bg: 'bg-rose-50' },
                    { label: 'Liquidaciones Mes', value: 45, icon: TrendingUp, color: 'text-[#27bea5]', bg: 'bg-[#27bea5]/10' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
                        <div className={`p-4 ${stat.bg} ${stat.color} rounded-2xl`}>
                            <stat.icon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                            <h4 className="text-2xl font-bold text-[#1c2938]">{stat.value}</h4>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* MULTI-COMPANY PANEL (Left/Center) */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <h3 className="text-xl font-bold text-[#1c2938] flex items-center gap-2">
                                <Users className="w-5 h-5 text-[#27bea5]" /> Mis Clientes Gestionados
                            </h3>
                            <div className="relative group max-w-xs w-full">
                                <Search className="absolute left-4 top-3 w-4 h-4 text-slate-400 group-focus-within:text-[#27bea5] transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Buscar empresa..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-[#27bea5] outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="divide-y divide-slate-50">
                            {filteredCompanies.length > 0 ? filteredCompanies.map((company) => (
                                <div
                                    key={company.id}
                                    className="p-6 hover:bg-slate-50/50 transition-colors flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 font-bold group-hover:bg-[#27bea5]/10 group-hover:text-[#27bea5] transition-colors text-xl">
                                            {company.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-[#1c2938] group-hover:text-[#27bea5] transition-colors">{company.name}</h4>
                                            <p className="text-xs text-slate-400">{company.taxId} • {company.fiscalConfig?.entityType === 'NATURAL' ? 'Persona Natural' : 'Persona Jurídica'}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6 text-right">
                                        <div className="hidden md:block">
                                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Estatus Fiscal</p>
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold">
                                                <CheckCircle2 className="w-3 h-3" /> Al Día
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => onSelectCompany(company)}
                                            className="p-2.5 rounded-xl bg-slate-100 text-slate-400 hover:bg-[#1c2938] hover:text-white transition-all group-hover:translate-x-1"
                                        >
                                            <ArrowRight className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            )) : (
                                <div className="p-12 text-center text-slate-400">
                                    <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                    <p className="font-medium">No se encontraron empresas con ese nombre.</p>
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-slate-50/50 text-center">
                            <button className="text-sm font-bold text-[#27bea5] hover:underline flex items-center justify-center gap-2 mx-auto">
                                <Plus className="w-4 h-4" /> Agregar Nuevo Cliente
                            </button>
                        </div>
                    </div>
                </div>

                {/* SIDEBAR TOOLS (Right) */}
                <div className="space-y-6">
                    {/* LIQUIDADORES FISCALES */}
                    <div className="bg-[#1c2938] rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-[#27bea5] rounded-full blur-[80px] opacity-10 -translate-y-1/2 translate-x-1/2"></div>

                        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <Calculator className="w-5 h-5 text-[#27bea5]" /> Liquidadores
                        </h3>

                        <div className="space-y-4">
                            <button
                                onClick={() => onViewCalculator('INTEREST')}
                                className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between hover:bg-white/10 transition-colors group text-left"
                            >
                                <div>
                                    <p className="font-bold text-sm">Intereses Moratorios</p>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Tasas DGI Panamá</p>
                                </div>
                                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
                            </button>

                            <button
                                onClick={() => onViewCalculator('SANCTION')}
                                className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between hover:bg-white/10 transition-colors group text-left"
                            >
                                <div>
                                    <p className="font-bold text-sm">Sanción Extemporaneidad</p>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Multas por retraso</p>
                                </div>
                                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>

                    {/* AI ADVISORY PREVIEW */}
                    <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-4">
                                <Sparkles className="w-5 h-5 text-indigo-200" />
                                <span className="text-xs font-bold uppercase tracking-widest text-indigo-100">Próximos Vencimientos</span>
                            </div>
                            <div className="space-y-4">
                                <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
                                    <p className="text-xs font-bold text-indigo-100 opacity-60 uppercase mb-1">15 ENE</p>
                                    <p className="font-bold text-sm">ITBMS - Mi Dulce Hogar S.A.</p>
                                </div>
                                <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
                                    <p className="text-xs font-bold text-indigo-100 opacity-60 uppercase mb-1">20 ENE</p>
                                    <p className="font-bold text-sm">Planilla SIPE - Tech Solutions</p>
                                </div>
                            </div>
                            <button
                                onClick={onViewCalendar}
                                className="w-full mt-6 py-3 bg-white text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-colors"
                            >
                                Ver Calendario Completo
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AccountantDashboard;
