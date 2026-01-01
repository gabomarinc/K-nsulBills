
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
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 mb-2 animate-in slide-in-from-bottom-10 duration-300 w-max">
                    <MenuOption
                        icon={<FileText size={20} />}
                        label="Documentos"
                        onClick={() => handleAction(AppView.INVOICES)}
                        color="bg-white"
                        isCentered={true}
                    />
                    <MenuOption
                        icon={<Users size={20} />}
                        label="Clientes"
                        onClick={() => handleAction(AppView.CLIENTS)}
                        color="bg-white"
                        isCentered={true}
                    />
                    <MenuOption
                        icon={<TrendingDown size={20} />}
                        label="Gastos"
                        onClick={() => handleAction(AppView.EXPENSES)}
                        color="bg-white"
                        isCentered={true}
                    />
                </div>
            )}

            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[-1] animate-in fade-in duration-300"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Main FAB */}
            <button
                onClick={toggleMenu}
                className={`
          w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg 
          transition-all duration-300 ease-out active:scale-95
          ${isOpen ? 'bg-slate-800 rotate-45' : 'bg-[#27bea5]'}
          hover:shadow-[0_8px_30px_rgb(39,190,165,0.4)]
        `}
            >
                {isOpen ? <X size={28} /> : <Plus size={28} />}
            </button>
        </div>
    );
};

const MenuOption: React.FC<{
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    color: string;
    isCentered?: boolean;
}> = ({ icon, label, onClick, color, isCentered }) => (
    <button
        onClick={onClick}
        className={`flex ${isCentered ? 'flex-col-reverse' : 'items-center'} gap-3 group animate-in fade-in zoom-in duration-200 items-center`}
    >
        <span className="bg-white text-slate-700 font-bold text-[10px] px-2 py-1 rounded-lg shadow-sm border border-slate-100 uppercase tracking-wider">
            {label}
        </span>
        <div className={`w-14 h-14 ${color} text-[#27bea5] rounded-full flex items-center justify-center shadow-lg border border-slate-50 transition-transform active:scale-90`}>
            {icon}
        </div>
    </button>
);

export default MobileQuickActions;
