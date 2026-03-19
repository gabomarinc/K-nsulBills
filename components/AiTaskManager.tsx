import React, { useState } from 'react';
import {
    Sparkles, Plus, Search, Filter, Calendar,
    CheckCircle2, Clock, AlertCircle, Building2,
    BrainCircuit, ChevronRight, Tag
} from 'lucide-react';
import { AccountantTask } from '../types';

interface AiTaskManagerProps {
    tasks: AccountantTask[];
    onAddTask: (task: Partial<AccountantTask>) => void;
    onUpdateStatus: (taskId: string, status: AccountantTask['status']) => void;
}

const AiTaskManager: React.FC<AiTaskManagerProps> = ({ tasks, onAddTask, onUpdateStatus }) => {
    const [activeFilter, setActiveFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');

    const filteredTasks = tasks.filter(t => {
        if (activeFilter === 'PENDING') return t.status !== 'COMPLETED';
        if (activeFilter === 'COMPLETED') return t.status === 'COMPLETED';
        return true;
    });

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-[#1c2938] flex items-center gap-3">
                        <Sparkles className="w-8 h-8 text-[#27bea5]" /> Gestor de Tareas IA
                    </h2>
                    <p className="text-slate-500">Optimización y seguimiento automático de tus compromisos fiscales.</p>
                </div>
                <button
                    onClick={() => onAddTask({})}
                    className="bg-[#1c2938] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#27bea5] transition-all flex items-center gap-2 shadow-lg"
                >
                    <Plus className="w-5 h-5" />
                    Nueva Tarea
                </button>
            </div>

            {/* AI RECOMMENDATION BANNER */}
            <div className="bg-gradient-to-r from-teal-500 to-[#27bea5] rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-[100px] opacity-10 translate-x-1/2 -translate-y-1/2"></div>
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                    <div className="p-5 bg-white/20 backdrop-blur-md rounded-3xl border border-white/20">
                        <BrainCircuit className="w-10 h-10 text-white" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-xl font-bold mb-2">Recomendación Estratégica IA</h3>
                        <p className="text-white/80 leading-relaxed font-medium">
                            Detectamos 3 declaraciones de ITBMS que vencen en 4 días. Te recomendamos priorizar a "Servicios Globales S.A." debido a su volumen de facturación y complejidad de retenciones.
                        </p>
                    </div>
                    <button className="bg-white text-[#27bea5] px-6 py-3 rounded-xl font-bold hover:bg-slate-50 transition-colors shadow-lg">
                        Ver Prioridades
                    </button>
                </div>
            </div>

            {/* TASK LIST FILTERS */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100">
                    {(['ALL', 'PENDING', 'COMPLETED'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveFilter(tab)}
                            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeFilter === tab ? 'bg-[#1c2938] text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {tab === 'ALL' ? 'Todas' : tab === 'PENDING' ? 'Pendientes' : 'Completadas'}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-4 top-3 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar tarea..."
                            className="pl-10 pr-4 py-2.5 bg-white border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-[#27bea5] outline-none transition-all shadow-sm"
                        />
                    </div>
                    <button className="p-3 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-[#1c2938] transition-colors shadow-sm">
                        <Filter className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* TASKS LIST */}
            <div className="space-y-4">
                {filteredTasks.map(task => (
                    <div
                        key={task.id}
                        className={`bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group ${task.status === 'COMPLETED' ? 'opacity-60' : ''}`}
                    >
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => onUpdateStatus(task.id, task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED')}
                                    className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${task.status === 'COMPLETED' ? 'bg-[#27bea5] border-[#27bea5] text-white' : 'bg-white border-slate-200 group-hover:border-[#27bea5]'}`}
                                >
                                    {task.status === 'COMPLETED' && <CheckCircle2 className="w-5 h-5" />}
                                </button>
                                <div>
                                    <h4 className={`font-bold text-[#1c2938] transition-all ${task.status === 'COMPLETED' ? 'line-through text-slate-400' : ''}`}>
                                        {task.title}
                                    </h4>
                                    <div className="flex flex-wrap items-center gap-3 mt-1">
                                        <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-md">
                                            <Building2 className="w-3 h-3" /> {task.linkedClientId || 'Empresa General'}
                                        </span>
                                        <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${task.priority === 'HIGH' ? 'bg-rose-50 text-rose-500' :
                                                task.priority === 'MEDIUM' ? 'bg-amber-50 text-amber-500' :
                                                    'bg-blue-50 text-blue-500'
                                            }`}>
                                            <AlertCircle className="w-3 h-3" /> {task.priority}
                                        </span>
                                        <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            <Calendar className="w-3 h-3" /> {new Date(task.dueDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {task.aiSuggestion && (
                                <div className="flex-1 max-w-sm px-4 py-2 bg-indigo-50/50 border border-indigo-100 rounded-xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-1">
                                        <Sparkles className="w-3 h-3 text-indigo-400" />
                                    </div>
                                    <p className="text-[10px] text-indigo-600 font-medium italic leading-snug">
                                        "AI: {task.aiSuggestion}"
                                    </p>
                                </div>
                            )}

                            <div className="flex items-center gap-2">
                                <button className="p-2 text-slate-400 hover:text-[#1c2938] transition-colors rounded-lg hover:bg-slate-50">
                                    <Tag className="w-4 h-4" />
                                </button>
                                <button className="p-2 text-slate-400 hover:text-[#1c2938] transition-colors rounded-lg hover:bg-slate-50">
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {filteredTasks.length === 0 && (
                <div className="py-20 text-center">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                        <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h4 className="font-bold text-slate-500">¡Todo al día!</h4>
                    <p className="text-sm text-slate-400">No tienes tareas pendientes en esta categoría.</p>
                </div>
            )}
        </div>
    );
};

export default AiTaskManager;
