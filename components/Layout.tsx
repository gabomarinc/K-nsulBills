
import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Settings, 
  Building2,
  Briefcase,
  PieChart, 
  ShoppingBag,
  Users,
  TrendingDown,
  ChevronLeft,
  LogOut
} from 'lucide-react';
import { AppView, ProfileType, UserProfile } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  currentProfile: UserProfile;
  onSwitchProfile: () => void;
  isOffline: boolean;
  onToggleOffline: () => void;
  pendingInvoicesCount: number;
  onLogout?: () => void; // New Prop
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeView, 
  onNavigate, 
  currentProfile,
  onSwitchProfile,
  isOffline,
  onToggleOffline,
  pendingInvoicesCount,
  onLogout
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Sidebar */}
      <aside 
        className={`${isCollapsed ? 'w-20' : 'w-64'} bg-white border-r border-slate-100 flex-shrink-0 flex flex-col transition-all duration-300 relative group/sidebar h-screen sticky top-0 z-40`}
      >
        {/* Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`
            absolute -right-3.5 top-9 z-50
            bg-[#27bea5] text-white
            w-7 h-7 flex items-center justify-center
            rounded-full
            border-[3px] border-[#F8FAFC] 
            shadow-[0_4px_12px_rgba(39,190,165,0.4)]
            hover:shadow-[0_4px_20px_rgba(39,190,165,0.7)]
            hover:scale-110 active:scale-95
            transition-all duration-300 ease-out
            opacity-0 group-hover/sidebar:opacity-100
            ${isCollapsed ? 'opacity-100' : ''}
          `}
          title={isCollapsed ? "Expandir menú" : "Colapsar menú"}
        >
          <ChevronLeft className={`w-3.5 h-3.5 transition-transform duration-500 ${isCollapsed ? 'rotate-180' : ''}`} />
        </button>

        {/* Brand Header */}
        <div className={`p-6 flex items-center ${isCollapsed ? 'justify-center' : 'justify-start'} h-24 overflow-hidden`}>
          {isCollapsed ? (
             <img 
               src="https://konsul.digital/wp-content/uploads/2025/07/cropped-3.png" 
               alt="Kônsul Icon" 
               className="w-10 h-10 object-contain transition-all duration-300 animate-in fade-in"
             />
          ) : (
             <img 
               src="https://konsul.digital/wp-content/uploads/2025/11/1-min-e1762361628509.avif" 
               alt="Kônsul" 
               className="h-8 object-contain transition-all duration-300 animate-in slide-in-from-left-2"
             />
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-2 mt-4 overflow-y-auto custom-scrollbar">
          <NavItem 
            icon={<LayoutDashboard size={24} />} 
            label="Inicio" 
            isActive={activeView === AppView.DASHBOARD || activeView === AppView.WIZARD}
            isCollapsed={isCollapsed}
            onClick={() => onNavigate(AppView.DASHBOARD)}
          />
          <NavItem 
            icon={<FileText size={24} />} 
            label="Documentos" 
            isActive={activeView === AppView.INVOICES || activeView === AppView.INVOICE_DETAIL}
            isCollapsed={isCollapsed}
            onClick={() => onNavigate(AppView.INVOICES)}
          />
          <NavItem 
            icon={<Users size={24} />} 
            label="Clientes" 
            isActive={activeView === AppView.CLIENTS}
            isCollapsed={isCollapsed}
            onClick={() => onNavigate(AppView.CLIENTS)}
          />
          <NavItem 
            icon={<TrendingDown size={24} />} 
            label="Gastos" 
            isActive={activeView === AppView.EXPENSES}
            isCollapsed={isCollapsed}
            onClick={() => onNavigate(AppView.EXPENSES)}
          />
          <NavItem 
            icon={<ShoppingBag size={24} />} 
            label="Catálogo" 
            isActive={activeView === AppView.CATALOG}
            isCollapsed={isCollapsed}
            onClick={() => onNavigate(AppView.CATALOG)}
          />
          <NavItem 
            icon={<PieChart size={24} />} 
            label="Reportes" 
            isActive={activeView === AppView.REPORTS}
            isCollapsed={isCollapsed}
            onClick={() => onNavigate(AppView.REPORTS)}
          />
          <NavItem 
            icon={<Settings size={24} />} 
            label="Ajustes" 
            isActive={activeView === AppView.SETTINGS}
            isCollapsed={isCollapsed}
            onClick={() => onNavigate(AppView.SETTINGS)}
          />
        </nav>

        {/* Profile & Footer */}
        <div className="p-4 border-t border-slate-50 space-y-3">
          
          <div className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-start'} gap-3 p-2 rounded-xl border border-slate-100 bg-slate-50/50`}>
            <div className="w-9 h-9 rounded-full bg-white text-slate-500 flex items-center justify-center flex-shrink-0 shadow-sm">
              {currentProfile.type === ProfileType.COMPANY ? <Building2 size={16}/> : <Briefcase size={16} />}
            </div>
            {!isCollapsed && (
              <div className="text-left min-w-0 flex-1 animate-in fade-in">
                <p className="text-xs font-bold text-[#1c2938] truncate">{currentProfile.name}</p>
                <p className="text-[10px] text-slate-400 truncate capitalize">{currentProfile.type}</p>
              </div>
            )}
          </div>

          {/* LOGOUT BUTTON */}
          {onLogout && (
            <button 
              onClick={onLogout}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-start'} gap-3 p-3 rounded-xl text-rose-500 hover:bg-rose-50 transition-colors`}
              title="Cerrar Sesión"
            >
              <LogOut size={20} />
              {!isCollapsed && <span className="text-xs font-bold animate-in fade-in">Salir</span>}
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 custom-scrollbar">
          {children}
        </div>
      </main>
    </div>
  );
};

const NavItem: React.FC<{ 
  icon: React.ReactNode, 
  label: string, 
  isActive: boolean, 
  isCollapsed: boolean,
  onClick: () => void 
}> = ({ icon, label, isActive, isCollapsed, onClick }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-start'} gap-4 px-4 py-3.5 rounded-2xl transition-all duration-200 group relative ${
      isActive 
      ? 'bg-[#27bea5]/10 text-[#27bea5] font-bold' 
      : 'text-slate-400 hover:text-[#27bea5] hover:bg-[#27bea5]/5'
    }`}
    title={isCollapsed ? label : undefined}
  >
    <div className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
      {icon}
    </div>
    {!isCollapsed && (
      <span className="whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-300">{label}</span>
    )}
    {isActive && !isCollapsed && (
      <div className="absolute right-4 w-1.5 h-1.5 rounded-full bg-[#27bea5]"></div>
    )}
  </button>
);

export default Layout;
