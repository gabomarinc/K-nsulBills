
import React, { useState, useRef, useEffect } from 'react';
import { 
  Building2, MapPin, CreditCard, Palette, UploadCloud, 
  Save, Crown, Calendar, Globe,
  Coins, Sparkles, Key, Eye, EyeOff, ShieldCheck,
  Smartphone, Mail, ChevronRight,
  LayoutTemplate, Check, Database
} from 'lucide-react';
import { UserProfile } from '../types';

interface UserProfileSettingsProps {
  currentUser: UserProfile;
  onUpdate: (updatedProfile: UserProfile) => void;
}

const UserProfileSettings: React.FC<UserProfileSettingsProps> = ({ currentUser, onUpdate }) => {
  const [profile, setProfile] = useState<UserProfile>(currentUser);
  const [isSaving, setIsSaving] = useState(false);
  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({});
  const [dbUrl, setDbUrl] = useState(''); // Local state for DB URL
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load DB URL from local storage on mount
  useEffect(() => {
    const storedUrl = localStorage.getItem('NEON_DATABASE_URL');
    if (storedUrl) setDbUrl(storedUrl);
  }, []);

  const handleInputChange = (field: keyof UserProfile, value: any) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleBrandingChange = (field: keyof any, value: any) => {
    setProfile(prev => ({
      ...prev,
      branding: { ...prev.branding, [field]: value } as any
    }));
  };
  
  const handleApiKeyChange = (provider: 'gemini' | 'openai', value: string) => {
    setProfile(prev => ({
      ...prev,
      apiKeys: { ...prev.apiKeys, [provider]: value }
    }));
  };

  const toggleKeyVisibility = (provider: string) => {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleBrandingChange('logoUrl', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const saveChanges = () => {
    setIsSaving(true);
    
    // Save DB URL to localStorage
    if (dbUrl) {
      localStorage.setItem('NEON_DATABASE_URL', dbUrl);
    } else {
      localStorage.removeItem('NEON_DATABASE_URL');
    }

    // Simulate API call
    setTimeout(() => {
      onUpdate(profile);
      setIsSaving(false);
      // Force reload to pick up new DB connection if changed
      window.location.reload(); 
    }, 800);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in pb-12">
      
      {/* HEADER: Visceral & Reflective - Welcoming and empowering */}
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 border-b border-slate-100 pb-6">
        <div>
           <h1 className="text-3xl font-bold text-[#1c2938] tracking-tight">Tu Espacio de Trabajo</h1>
           <p className="text-slate-500 mt-1 text-lg font-light">Personaliza cómo te ven tus clientes y cómo trabaja tu IA.</p>
        </div>
        <button 
          onClick={saveChanges}
          disabled={isSaving}
          className="bg-[#1c2938] text-white px-8 py-3 rounded-2xl font-bold hover:bg-[#27bea5] transition-all duration-300 flex items-center gap-3 shadow-lg hover:shadow-xl hover:-translate-y-1 active:translate-y-0 active:scale-95 disabled:opacity-70 disabled:transform-none"
        >
          {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          {!isSaving && <Save className="w-5 h-5" />}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* COLUMN 1: PUBLIC IMAGE (Behavioral: High priority items) */}
        <div className="space-y-8 xl:col-span-2">
          
          {/* CARD: BUSINESS IDENTITY */}
          <div className="bg-white p-8 rounded-[2rem] shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-50 relative group">
             <div className="absolute top-0 left-0 w-2 h-full bg-[#27bea5] rounded-l-[2rem] opacity-0 group-hover:opacity-100 transition-opacity"></div>
             
             <h3 className="text-xl font-bold text-[#1c2938] mb-6 flex items-center gap-3">
               <div className="p-2 bg-slate-50 rounded-xl text-[#27bea5]">
                 <Building2 className="w-6 h-6" />
               </div>
               El Rostro de tu Negocio
             </h3>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-2">
                 <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nombre Comercial</label>
                 <input 
                   value={profile.name}
                   onChange={(e) => handleInputChange('name', e.target.value)}
                   className="w-full p-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-[#27bea5] focus:bg-white focus:border-transparent outline-none transition-all font-medium text-[#1c2938]"
                   placeholder="Ej. Estudio Creativo"
                 />
               </div>
               <div className="space-y-2">
                 <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">ID Fiscal (RFC/NIF)</label>
                 <input 
                   value={profile.taxId}
                   onChange={(e) => handleInputChange('taxId', e.target.value)}
                   className="w-full p-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-[#27bea5] focus:bg-white focus:border-transparent outline-none transition-all font-mono text-slate-600"
                 />
               </div>
               <div className="md:col-span-2 space-y-2">
                 <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dirección Fiscal</label>
                 <div className="relative group/input">
                    <MapPin className="absolute left-4 top-4 w-5 h-5 text-slate-300 group-focus-within/input:text-[#27bea5] transition-colors" />
                    <input 
                      value={profile.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      className="w-full pl-12 p-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-[#27bea5] focus:bg-white focus:border-transparent outline-none transition-all text-slate-600"
                    />
                 </div>
               </div>
               <div className="space-y-2">
                 <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">País de Operación</label>
                 <div className="relative group/input">
                    <Globe className="absolute left-4 top-4 w-5 h-5 text-slate-300 group-focus-within/input:text-[#27bea5] transition-colors" />
                    <select 
                      value={profile.country}
                      onChange={(e) => handleInputChange('country', e.target.value)}
                      className="w-full pl-12 p-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-[#27bea5] focus:bg-white focus:border-transparent outline-none transition-all appearance-none cursor-pointer text-slate-600"
                    >
                      {['México', 'Argentina', 'España', 'Colombia', 'Otro'].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <ChevronRight className="absolute right-4 top-4 w-5 h-5 text-slate-300 rotate-90 pointer-events-none" />
                 </div>
               </div>
             </div>
          </div>

          {/* CARD: FINANCE */}
          <div className="bg-white p-8 rounded-[2rem] shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-50 relative group">
             <div className="absolute top-0 left-0 w-2 h-full bg-blue-500 rounded-l-[2rem] opacity-0 group-hover:opacity-100 transition-opacity"></div>

             <h3 className="text-xl font-bold text-[#1c2938] mb-6 flex items-center gap-3">
               <div className="p-2 bg-slate-50 rounded-xl text-blue-500">
                 <CreditCard className="w-6 h-6" />
               </div>
               Configuración Financiera
             </h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cuenta Bancaria (IBAN/CLABE)</label>
                  <input 
                    value={profile.bankAccount || ''}
                    onChange={(e) => handleInputChange('bankAccount', e.target.value)}
                    placeholder="Para recibir transferencias"
                    className="w-full p-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent outline-none transition-all font-medium text-slate-600"
                  />
                </div>
                <div className="space-y-2">
                   <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Moneda Principal</label>
                   <div className="relative group/input">
                      <Coins className="absolute left-4 top-4 w-5 h-5 text-slate-300 group-focus-within/input:text-blue-500 transition-colors" />
                      <select 
                        value={profile.defaultCurrency || 'USD'}
                        onChange={(e) => handleInputChange('defaultCurrency', e.target.value)}
                        className="w-full pl-12 p-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent outline-none appearance-none cursor-pointer text-slate-600"
                      >
                         {['USD', 'EUR', 'MXN', 'ARS', 'COP'].map(c => (
                            <option key={c} value={c}>{c}</option>
                         ))}
                      </select>
                      <ChevronRight className="absolute right-4 top-4 w-5 h-5 text-slate-300 rotate-90 pointer-events-none" />
                   </div>
                </div>
             </div>
          </div>

          {/* CARD: AI BRAIN (Reflective: Empowerment) */}
          <div className="bg-gradient-to-br from-[#1c2938] to-slate-900 p-8 rounded-[2rem] shadow-xl text-white relative overflow-hidden">
             {/* Abstract Decor */}
             <div className="absolute top-0 right-0 w-64 h-64 bg-[#27bea5] rounded-full blur-[80px] opacity-10 -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

             <h3 className="text-xl font-bold mb-2 flex items-center gap-3 relative z-10">
               <div className="p-2 bg-white/10 rounded-xl text-[#27bea5]">
                 <Sparkles className="w-6 h-6" />
               </div>
               Tu Cerebro Digital
             </h3>
             <p className="text-sm text-slate-400 mb-8 ml-14 max-w-lg">
               Conecta tus herramientas para darle superpoderes ilimitados a tu asistente.
             </p>
             
             <div className="space-y-6 relative z-10">
                {/* Neon DB */}
                <div className="space-y-2">
                   <label className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                      <span>Neon Database URL</span>
                      <span className="text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded text-[10px]">Cloud Data</span>
                   </label>
                   <div className="relative group/input">
                      <Database className="absolute left-4 top-3.5 w-5 h-5 text-slate-500 group-focus-within/input:text-blue-400 transition-colors" />
                      <input 
                        type={showKeys['neon'] ? "text" : "password"}
                        value={dbUrl}
                        onChange={(e) => setDbUrl(e.target.value)}
                        placeholder="postgres://user:pass@ep-xyz.neon.tech/neondb..."
                        className="w-full pl-12 pr-12 p-3.5 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-white placeholder:text-slate-600 font-mono text-sm transition-all focus:bg-white/10"
                      />
                      <button 
                        onClick={() => toggleKeyVisibility('neon')}
                        className="absolute right-3 top-3.5 p-1 text-slate-500 hover:text-white transition-colors rounded-lg hover:bg-white/10"
                      >
                        {showKeys['neon'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                   </div>
                   <p className="text-[10px] text-slate-500 pl-2">Pega aquí tu "Connection String" de Neon para sincronizar datos reales.</p>
                </div>

                <div className="h-px bg-white/10 my-4"></div>

                {/* Gemini */}
                <div className="space-y-2">
                   <label className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                      <span>Google Gemini API Key</span>
                      <span className="text-[#27bea5] bg-[#27bea5]/10 px-2 py-0.5 rounded text-[10px]">Recomendado</span>
                   </label>
                   <div className="relative group/input">
                      <Key className="absolute left-4 top-3.5 w-5 h-5 text-slate-500 group-focus-within/input:text-[#27bea5] transition-colors" />
                      <input 
                        type={showKeys['gemini'] ? "text" : "password"}
                        value={profile.apiKeys?.gemini || ''}
                        onChange={(e) => handleApiKeyChange('gemini', e.target.value)}
                        placeholder="Pega tu llave aquí..."
                        className="w-full pl-12 pr-12 p-3.5 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-[#27bea5] outline-none text-white placeholder:text-slate-600 font-mono text-sm transition-all focus:bg-white/10"
                      />
                      <button 
                        onClick={() => toggleKeyVisibility('gemini')}
                        className="absolute right-3 top-3.5 p-1 text-slate-500 hover:text-white transition-colors rounded-lg hover:bg-white/10"
                      >
                        {showKeys['gemini'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                   </div>
                </div>

                {/* OpenAI */}
                <div className="space-y-2">
                   <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">OpenAI API Key (Backup)</label>
                   <div className="relative group/input">
                      <Key className="absolute left-4 top-3.5 w-5 h-5 text-slate-500 group-focus-within/input:text-white transition-colors" />
                      <input 
                        type={showKeys['openai'] ? "text" : "password"}
                        value={profile.apiKeys?.openai || ''}
                        onChange={(e) => handleApiKeyChange('openai', e.target.value)}
                        placeholder="sk-..."
                        className="w-full pl-12 pr-12 p-3.5 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-white/30 outline-none text-white placeholder:text-slate-600 font-mono text-sm transition-all focus:bg-white/10"
                      />
                      <button 
                        onClick={() => toggleKeyVisibility('openai')}
                        className="absolute right-3 top-3.5 p-1 text-slate-500 hover:text-white transition-colors rounded-lg hover:bg-white/10"
                      >
                         {showKeys['openai'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                   </div>
                </div>
             </div>
          </div>
        </div>

        {/* COLUMN 2: BRAND & STATUS (Visceral: Identity) */}
        <div className="space-y-8">
           
           {/* CARD: BRANDING */}
           <div className="bg-white p-8 rounded-[2rem] shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-50">
              <h3 className="text-xl font-bold text-[#1c2938] mb-6 flex items-center gap-3">
                <div className="p-2 bg-purple-50 rounded-xl text-purple-500">
                   <Palette className="w-6 h-6" />
                </div>
                Identidad Visual
              </h3>
              
              <div className="mb-8 text-center">
                 <div 
                   onClick={() => fileInputRef.current?.click()}
                   className="relative group cursor-pointer inline-block"
                 >
                   <div className="w-32 h-32 rounded-full border-4 border-slate-50 bg-white shadow-inner flex items-center justify-center overflow-hidden hover:border-[#27bea5] transition-all duration-300">
                     {profile.branding?.logoUrl ? (
                        <img src={profile.branding.logoUrl} className="w-full h-full object-contain p-4" />
                     ) : (
                        <UploadCloud className="w-10 h-10 text-slate-300 group-hover:text-[#27bea5] transition-colors" />
                     )}
                   </div>
                   <div className="absolute bottom-0 right-0 bg-[#1c2938] text-white p-2 rounded-full shadow-lg group-hover:bg-[#27bea5] transition-colors">
                      <UploadCloud className="w-4 h-4" />
                   </div>
                   <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*"
                      onChange={handleLogoUpload}
                   />
                 </div>
                 <p className="text-xs font-bold text-slate-400 mt-3 uppercase tracking-wider">Tu Sello Distintivo</p>
              </div>

              <div className="space-y-6">
                <div>
                   <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block">Color de Marca</label>
                   <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-2xl border border-slate-100">
                     <input 
                       type="color"
                       value={profile.branding?.primaryColor || '#27bea5'}
                       onChange={(e) => handleBrandingChange('primaryColor', e.target.value)}
                       className="w-12 h-12 rounded-xl cursor-pointer border-none bg-transparent"
                     />
                     <div className="flex-1">
                       <p className="text-xs text-slate-400">Código Hex</p>
                       <p className="font-mono text-sm font-bold text-slate-700 uppercase">{profile.branding?.primaryColor}</p>
                     </div>
                   </div>
                </div>

                <div>
                   <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block">Estilo de Documentos</label>
                   <div className="grid grid-cols-1 gap-3">
                     {['Modern', 'Classic', 'Minimal'].map(style => (
                        <button 
                          key={style}
                          onClick={() => handleBrandingChange('templateStyle', style)}
                          className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all group ${
                            profile.branding?.templateStyle === style 
                             ? 'border-[#27bea5] bg-[#27bea5]/5 text-[#27bea5]' 
                             : 'border-slate-100 text-slate-500 hover:border-slate-200 bg-white'
                          }`}
                        >
                          <span className="flex items-center gap-2 font-medium">
                            <LayoutTemplate className="w-4 h-4" /> {style}
                          </span>
                          {profile.branding?.templateStyle === style && <Check className="w-4 h-4" />}
                        </button>
                     ))}
                   </div>
                </div>
              </div>
           </div>

           {/* CARD: MEMBERSHIP (Reflective: Pride) */}
           <div className="relative rounded-[2rem] shadow-xl overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-[#27bea5] to-[#1e9984] transition-transform duration-500 group-hover:scale-105"></div>
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
              
              <div className="relative z-10 p-8 text-white">
                 <div className="flex justify-between items-start mb-8">
                   <div>
                     <p className="text-xs font-bold text-teal-100 uppercase tracking-wider mb-1">Membresía Kônsul</p>
                     <h3 className="text-2xl font-bold flex items-center gap-2">
                       {profile.plan || 'Emprendedor Pro'} <Crown className="w-5 h-5 text-yellow-300 fill-yellow-300" />
                     </h3>
                   </div>
                 </div>
                 
                 <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 mb-6">
                   <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-teal-50 font-medium">Renovación</span>
                      <span className="text-sm font-bold flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" /> {profile.renewalDate || '25 Oct 2024'}
                      </span>
                   </div>
                   <div className="w-full bg-black/10 h-1.5 rounded-full overflow-hidden">
                     <div className="bg-white w-3/4 h-full rounded-full"></div>
                   </div>
                 </div>

                 <div className="flex items-center justify-between text-sm border-t border-white/20 pt-4">
                    <div className="flex items-center gap-2 opacity-90">
                       <CreditCard className="w-4 h-4" /> •••• 4242
                    </div>
                    <button className="font-bold hover:underline decoration-2 underline-offset-4">
                       Gestionar
                    </button>
                 </div>
              </div>
           </div>

        </div>
      </div>
    </div>
  );
};

export default UserProfileSettings;
