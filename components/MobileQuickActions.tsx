
import React, { useState } from 'react';
import { Plus, FileText, Users, TrendingDown, X } from 'lucide-react';
import { AppView } from '../types';

interface MobileQuickActionsProps {
    onNavigate: (view: AppView) => void;
}

const MobileQuickActions: React.FC<MobileQuickActionsProps> = ({ onNavigate }) => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleMenu = () => setIsOpen(!isOpen);

    const handleAction = (view: AppView) => {
        onNavigate(view);
        setIsOpen(false);
    };

    return (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[60] md:hidden">
            {/* Menu Options */}
            {isOpen && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 mb-2 animate-in slide-in-from-bottom-10 duration-500 w-max">
                    <MenuOption
                        icon={<FileText size={22} />}
                        label="Nueva Factura"
                        onClick={() => handleAction(AppView.WIZARD)}
                        color="bg-teal-50 text-teal-500"
                    />
                    <MenuOption
                        icon={<TrendingDown size={22} />}
                        label="Nuevo Gasto"
                        onClick={() => handleAction(AppView.EXPENSE_WIZARD)}
                        color="bg-amber-50 text-amber-500"
                    />
                    <MenuOption
                        icon={<Users size={22} />}
                        label="Nuevo Cliente"
                        onClick={() => handleAction(AppView.CLIENT_WIZARD)}
                        color="bg-purple-50 text-purple-500"
                    />
                </div>
            )}

            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[-1] animate-in fade-in duration-500"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Main FAB */}
            <div className="relative group">
                <div className={`absolute inset-0 bg-[#27bea5] rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity ${isOpen ? 'hidden' : ''}`}></div>
                <button
                    onClick={toggleMenu}
                    className={`
                        w-16 h-16 rounded-full flex items-center justify-center text-white shadow-2xl 
                        transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) active:scale-95 relative z-10
                        ${isOpen ? 'bg-slate-800 rotate-[135deg]' : 'bg-[#27bea5]'}
                    `}
                >
                    <Plus size={32} />
                </button>
            </div>
        </div>
    );
};

const MenuOption: React.FC<{
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    color: string;
}> = ({ icon, label, onClick, color }) => (
    <button
        onClick={onClick}
        className="flex items-center gap-4 bg-white px-6 py-4 rounded-[3rem] shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/20 transition-all active:scale-95 group animate-in fade-in slide-in-from-bottom-4 duration-300 w-full min-w-[240px]"
    >
        <div className={`w-12 h-12 ${color} rounded-full flex items-center justify-center transition-transform group-hover:scale-110`}>
            {icon}
        </div>
        <span className="text-[#1c2938] font-bold text-base tracking-tight flex-1 text-left">
            {label}
        </span>
    </button>
);

export default MobileQuickActions;
