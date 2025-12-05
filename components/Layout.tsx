
import React from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Settings, 
  ChevronDown, 
  LogOut, 
  Wifi, 
  WifiOff, 
  Building2,
  Briefcase,
  PieChart, 
  ShoppingBag // Added icon
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
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeView, 
  onNavigate, 
  currentProfile,
  onSwitchProfile,
  isOffline,
  onToggleOffline,
  pendingInvoicesCount
}) => {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Sidebar - Simplified */}
      <aside className="w-20 lg:w-64 bg-white border-r border-slate-100 flex-shrink-0 flex flex-col transition-all duration-300">
        <div className="p-6 flex items-center justify-center lg:justify-start">
          <div className="w-10 h-10 bg-[#27bea5] rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-teal-100">
            Z
          </div>
          <span className="ml-3 font-bold text-xl tracking-tight text-[#1c2938] hidden lg:block">FacturaZen</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-4 mt-8">
          <NavItem 
            icon={<LayoutDashboard size={24} />} 
            label="Inicio" 
            isActive={activeView === AppView.DASHBOARD || activeView === AppView.WIZARD}
            onClick={() => onNavigate(AppView.DASHBOARD)}
          />
          <NavItem 
            icon={<FileText size={24} />} 
            label="Documentos" 
            isActive={activeView === AppView.INVOICES}
            onClick={() => onNavigate(AppView.INVOICES)}
          />
          <NavItem 
            icon={<ShoppingBag size={24} />} 
            label="Catálogo" 
            isActive={activeView === AppView.CATALOG}
            onClick={() => onNavigate(AppView.CATALOG)}
          />
          <NavItem 
            icon={<PieChart size={24} />} 
            label="Reportes" 
            isActive={activeView === AppView.REPORTS}
            onClick={() => onNavigate(AppView.REPORTS)}
          />
          <NavItem 
            icon={<Settings size={24} />} 
            label="Ajustes" 
            isActive={activeView === AppView.SETTINGS}
            onClick={() => onNavigate(AppView.SETTINGS)}
          />
        </nav>

        {/* Profile & Connection */}
        <div className="p-4 border-t border-slate-50 space-y-4">
          
          <button 
             onClick={onToggleOffline}
             className={`w-full flex items-center justify-center lg:justify-start gap-2 p-2 rounded-xl transition-colors ${
               isOffline ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'
             }`}
             title={isOffline ? "Modo Offline" : "Conectado"}
          >
            {isOffline ? <WifiOff size={20} /> : <Wifi size={20} />}
            <span className="hidden lg:inline text-xs font-semibold">
              {isOffline ? 'Offline' : 'Online'}
            </span>
          </button>

          <button 
            onClick={onSwitchProfile}
            className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors group"
          >
            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
              {currentProfile.type === ProfileType.COMPANY ? <Building2 size={18}/> : <Briefcase size={18} />}
            </div>
            <div className="hidden lg:block text-left min-w-0 flex-1">
              <p className="text-sm font-bold text-[#1c2938] truncate">{currentProfile.name}</p>
              <p className="text-xs text-slate-400 truncate">Cambiar perfil</p>
            </div>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12">
          {children}
        </div>
      </main>
    </div>
  );
};

const NavItem: React.FC<{ icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }> = ({ icon, label, isActive, onClick }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center justify-center lg:justify-start gap-4 px-4 py-4 rounded-2xl transition-all duration-200 group ${
      isActive 
      ? 'bg-[#27bea5]/10 text-[#27bea5] font-bold' 
      : 'text-slate-400 hover:text-[#27bea5] hover:bg-[#27bea5]/5'
    }`}
    title={label}
  >
    <div className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
      {icon}
    </div>
    <span className="hidden lg:block">{label}</span>
  </button>
);

export default Layout;
