
import React, { useState, useRef, useEffect } from 'react';
import { 
  Building2, MapPin, CreditCard, Palette, UploadCloud, 
  Save, Crown, Calendar, Globe,
  Coins, Sparkles, Key, Eye, EyeOff, ShieldCheck,
  Check, Zap, Loader2, CheckCircle2, XCircle, AlertTriangle, Lock, ArrowRight,
  ChevronRight, FileText
} from 'lucide-react';
import { UserProfile, PaymentIntegration, ProfileType } from '../types';
import { testAiConnection } from '../services/geminiService';

interface UserProfileSettingsProps {
  currentUser: UserProfile;
  onUpdate: (updatedProfile: UserProfile) => Promise<void>;
}

const UserProfileSettings: React.FC<UserProfileSettingsProps> = ({ currentUser, onUpdate }) => {
  const [profile, setProfile] = useState<UserProfile>(currentUser);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({});
  const [testStatus, setTestStatus] = useState<{ [key: string]: 'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR' }>({});
  const [activePaymentTab, setActivePaymentTab] = useState<'PAGUELOFACIL' | 'YAPPY'>('PAGUELOFACIL');

  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setTestStatus(prev => ({ ...prev, [provider]: 'IDLE' }));
  };

  const toggleKeyVisibility = (provider: string) => {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  const togglePaymentIntegration = () => {
    setProfile(prev => {
      const isEnabled = !prev.paymentIntegration?.enabled;
      return {
        ...prev,
        paymentIntegration: {
          provider: prev.paymentIntegration?.provider || 'PAGUELOFACIL',
          enabled: isEnabled,
          cclw: prev.paymentIntegration?.cclw || '',
          token: prev.paymentIntegration?.token || '',
          yappyMerchantId: prev.paymentIntegration?.yappyMerchantId || '',
          yappySecretKey: prev.paymentIntegration?.yappySecretKey || ''
        }
      };
    });
  };

  // Smart Logic for Coexistence
  const handlePaymentConfigChange = (field: keyof PaymentIntegration, value: string) => {
    setProfile(prev => {
      const currentInt = prev.paymentIntegration || { provider: 'PAGUELOFACIL', enabled: true };
      
      // Update specific field
      const updatedInt = { ...currentInt, [field]: value };
      
      // Check which services are fully configured
      const hasPaguelo = !!updatedInt.cclw && !!updatedInt.token;
      const hasYappy = !!updatedInt.yappyMerchantId && !!updatedInt.yappySecretKey;
      
      // Determine provider mode: If both present -> BOTH
      let newProvider: 'PAGUELOFACIL' | 'YAPPY' | 'BOTH' = updatedInt.provider;
      
      if (hasPaguelo && hasYappy) {
        newProvider = 'BOTH';
      } else if (hasYappy) {
        newProvider = 'YAPPY';
      } else if (hasPaguelo) {
        newProvider = 'PAGUELOFACIL';
      }

      return {
        ...prev,
        paymentIntegration: {
          ...updatedInt,
          provider: newProvider
        }
      };
    });
  };

  const runConnectionTest = async (provider: 'gemini' | 'openai') => {
    const key = profile.apiKeys?.[provider];
    if (!key) return;

    setTestStatus(prev => ({ ...prev, [provider]: 'LOADING' }));
    const success = await testAiConnection(provider, key);
    setTestStatus(prev => ({ ...prev, [provider]: success ? 'SUCCESS' : 'ERROR' }));
    
    if (success) {
      setTimeout(() => {
        setTestStatus(prev => ({ ...prev, [provider]: 'IDLE' }));
      }, 3000);
    }
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

  const saveChanges = async () => {
    setIsSaving(true);
    setSaveStatus('IDLE');
    
    try {
      await onUpdate(profile);
      
      setSaveStatus('SUCCESS');
      setTimeout(() => setSaveStatus('IDLE'), 3000);
    } catch (error) {
      console.error("Failed to save:", error);
      setSaveStatus('ERROR');
    } finally {
      setIsSaving(false);
    }
  };

  // Helper statuses for UI
  const isPagueloConfigured = !!profile.paymentIntegration?.cclw && !!profile.paymentIntegration?.token;
  const isYappyConfigured = !!profile.paymentIntegration?.yappyMerchantId && !!profile.paymentIntegration?.yappySecretKey;

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in pb-12 relative">
      
      {/* Toast Notification */}
      {saveStatus === 'SUCCESS' && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-bold">¡Cambios guardados con éxito!</span>
        </div>
      )}
      {saveStatus === 'ERROR' && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <AlertTriangle className="w-5 h-5" />
          <span className="font-bold">Error al guardar. Revisa tu conexión.</span>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 border-b border-slate-100 pb-6">
        <div>
           <h1 className="text-3xl font-bold text-[#1c2938] tracking-tight">Tu Espacio de Trabajo</h1>
           <p className="text-slate-500 mt-1 text-lg font-light">Personaliza cómo te ven tus clientes y cómo trabaja tu IA.</p>
        </div>
        <button 
          onClick={saveChanges}
          disabled={isSaving}
          className={`px-8 py-3 rounded-2xl font-bold transition-all duration-300 flex items-center gap-3 shadow-lg hover:shadow-xl hover:-translate-y-1 active:translate-y-0 active:scale-95 disabled:opacity-70 disabled:transform-none ${
             saveStatus === 'SUCCESS' ? 'bg-green-500 text-white' : 'bg-[#1c2938] text-white hover:bg-[#27bea5]'
          }`}
        >
          {isSaving ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Guardando...</>
          ) : saveStatus === 'SUCCESS' ? (
            <><Check className="w-5 h-5" /> Guardado</>
          ) : (
            <>Guardar Cambios <Save className="w-5 h-5" /></>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* COLUMN 1: PUBLIC IMAGE & FINANCE */}
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
                 <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Razón Social (Nombre Legal)</label>
                 <div className="relative group/input">
                    <FileText className="absolute left-4 top-4 w-5 h-5 text-slate-300 group-focus-within/input:text-[#27bea5] transition-colors" />
                    <input 
                      value={profile.legalName || ''}
                      onChange={(e) => handleInputChange('legalName', e.target.value)}
                      className="w-full pl-12 p-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-[#27bea5] focus:bg-white focus:border-transparent outline-none transition-all font-medium text-slate-700"
                      placeholder="Ej. Servicios S.A."
                    />
                 </div>
               </div>
               
               {/* ENTITY TYPE SELECTOR */}
               <div className="space-y-2">
                 <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tipo de Entidad Legal</label>
                 <div className="relative group/input">
                    <select 
                      value={profile.fiscalRegime || 'Persona Natural'}
                      onChange={(e) => {
                        const regime = e.target.value;
                        let newType = ProfileType.FREELANCE;
                        // Determine type based on regime selection
                        if (regime === 'Sociedad Anónima' || regime === 'Sociedad de Emprendimiento') {
                           newType = ProfileType.COMPANY;
                        }
                        
                        setProfile(prev => ({
                           ...prev,
                           fiscalRegime: regime,
                           type: newType
                        }));
                      }}
                      className="w-full p-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-[#27bea5] focus:bg-white focus:border-transparent outline-none transition-all appearance-none cursor-pointer text-slate-600 font-medium"
                    >
                      <option value="Persona Natural">Persona Natural</option>
                      <option value="Sociedad Anónima">Sociedad Anónima (S.A.)</option>
                      <option value="Sociedad de Emprendimiento">Sociedad de Emprendimiento</option>
                    </select>
                    <ChevronRight className="absolute right-4 top-4 w-5 h-5 text-slate-300 rotate-90 pointer-events-none" />
                 </div>
               </div>

               <div className="space-y-2">
                 <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">ID Fiscal (RFC/NIF)</label>
                 <input 
                   value={profile.taxId}
                   onChange={(e) => handleInputChange('taxId', e.target.value)}
                   className="w-full p-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-[#27bea5] focus:bg-white focus:border-transparent outline-none transition-all font-mono text-slate-600"
                 />
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
                      {['México', 'Argentina', 'España', 'Colombia', 'Panamá', 'Otro'].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <ChevronRight className="absolute right-4 top-4 w-5 h-5 text-slate-300 rotate-90 pointer-events-none" />
                 </div>
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
             </div>
          </div>

          {/* CARD: FINANCIAL VAULT */}
          <div className="bg-gradient-to-br from-[#1c2938] to-slate-900 p-8 rounded-[2.5rem] shadow-2xl text-white relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-64 h-64 bg-[#27bea5] rounded-full blur-[80px] opacity-10 -translate-y-1/2 translate-x-1/2"></div>
             
             <div className="relative z-10 space-y-8">
                <div className="flex justify-between items-center">
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/10 rounded-xl text-[#27bea5]">
                         <CreditCard className="w-6 h-6" />
                      </div>
                      <h3 className="text-xl font-bold">Bóveda Financiera</h3>
                   </div>
                   <span className="text-xs font-bold bg-white/10 px-3 py-1 rounded-full text-slate-300 uppercase tracking-widest border border-white/5">
                      Seguridad Bancaria
                   </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Cuenta Bancaria (IBAN/ACH)</label>
                      <input 
                        value={profile.bankAccount || ''}
                        onChange={(e) => handleInputChange('bankAccount', e.target.value)}
                        placeholder="0000 0000 0000 0000"
                        className="w-full bg-transparent text-xl font-mono text-white placeholder:text-slate-600 outline-none border-b border-slate-600 focus:border-[#27bea5] py-2 transition-colors"
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Moneda Base</label>
                      <div className="relative">
                         <select 
                           value={profile.defaultCurrency || 'USD'}
                           onChange={(e) => handleInputChange('defaultCurrency', e.target.value)}
                           className="w-full bg-white/10 text-white p-3 rounded-xl outline-none appearance-none cursor-pointer hover:bg-white/20 transition-colors font-bold border border-white/5 focus:border-[#27bea5]"
                         >
                           {['USD', 'EUR', 'MXN', 'ARS', 'COP'].map(c => <option key={c} value={c} className="text-slate-900">{c}</option>)}
                         </select>
                         <Coins className="absolute right-3 top-3 w-5 h-5 text-slate-400 pointer-events-none" />
                      </div>
                   </div>
                </div>

                {/* DIGITAL PAYMENTS TOGGLE */}
                <div className="pt-6 border-t border-white/10">
                   <div 
                      onClick={togglePaymentIntegration}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all duration-300 flex flex-col gap-4 group/toggle ${
                        profile.paymentIntegration?.enabled 
                          ? 'bg-[#27bea5]/10 border-[#27bea5] ring-1 ring-[#27bea5]/50' 
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                   >
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                               profile.paymentIntegration?.enabled ? 'bg-[#27bea5] text-white' : 'bg-slate-700 text-slate-400'
                            }`}>
                               <Zap className="w-5 h-5 fill-current" />
                            </div>
                            <div>
                               <h4 className={`font-bold ${profile.paymentIntegration?.enabled ? 'text-white' : 'text-slate-400'}`}>Pagos Digitales</h4>
                               <p className="text-xs text-slate-500">Pasarela PagueloFacil / Yappy</p>
                            </div>
                         </div>
                         
                         {/* Switch UI */}
                         <div className={`w-12 h-7 rounded-full relative transition-colors ${profile.paymentIntegration?.enabled ? 'bg-[#27bea5]' : 'bg-slate-600'}`}>
                            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${profile.paymentIntegration?.enabled ? 'left-6' : 'left-1'}`}></div>
                         </div>
                      </div>

                      {/* CONFIG FORM (CONDITIONAL) */}
                      {profile.paymentIntegration?.enabled && (
                         <div className="animate-in slide-in-from-top-2 pt-4 space-y-4 border-t border-white/10 mt-4" onClick={(e) => e.stopPropagation()}>
                            
                            {/* PROVIDER TABS WITH STATUS INDICATORS */}
                            <div className="flex p-1 bg-black/20 rounded-xl">
                               <button
                                 onClick={() => setActivePaymentTab('PAGUELOFACIL')}
                                 className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${activePaymentTab === 'PAGUELOFACIL' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                               >
                                 PagueloFacil
                                 {isPagueloConfigured && <CheckCircle2 className="w-3 h-3 text-green-400" />}
                               </button>
                               <button
                                 onClick={() => setActivePaymentTab('YAPPY')}
                                 className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${activePaymentTab === 'YAPPY' ? 'bg-[#ff6b00] text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                               >
                                 Yappy
                                 {isYappyConfigured && <CheckCircle2 className="w-3 h-3 text-green-400" />}
                               </button>
                            </div>

                            {/* PAGUELOFACIL FORM */}
                            {activePaymentTab === 'PAGUELOFACIL' && (
                              <div className="space-y-4 animate-in fade-in">
                                  {/* LOGO */}
                                  <div className="bg-white p-3 rounded-xl flex items-center justify-center mb-4 shadow-sm">
                                     <img 
                                       src="https://assets.paguelofacil.com/images/logos-svg/paguelofacil.svg" 
                                       alt="PagueloFacil" 
                                       className="h-8" 
                                     />
                                  </div>

                                  <div className="space-y-2">
                                     <label className="text-[10px] font-bold text-[#27bea5] uppercase tracking-widest flex items-center gap-1">
                                        <Lock className="w-3 h-3" /> CCLW (Código de Comercio)
                                     </label>
                                     <input 
                                       value={profile.paymentIntegration?.cclw || ''}
                                       onChange={(e) => handlePaymentConfigChange('cclw', e.target.value)}
                                       className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-[#27bea5] transition-colors font-mono"
                                       placeholder="Ej. ABCD12345"
                                     />
                                  </div>
                                  <div className="space-y-2">
                                     <label className="text-[10px] font-bold text-[#27bea5] uppercase tracking-widest flex items-center gap-1">
                                        <Key className="w-3 h-3" /> API Token (Llave Secreta)
                                     </label>
                                     <div className="relative">
                                        <input 
                                          type={showKeys['pf_token'] ? "text" : "password"}
                                          value={profile.paymentIntegration?.token || ''}
                                          onChange={(e) => handlePaymentConfigChange('token', e.target.value)}
                                          className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-[#27bea5] transition-colors font-mono pr-10"
                                          placeholder="Pegar token de PagueloFacil"
                                        />
                                        <button 
                                          onClick={() => toggleKeyVisibility('pf_token')}
                                          className="absolute right-3 top-3 text-slate-500 hover:text-white transition-colors"
                                        >
                                          {showKeys['pf_token'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                     </div>
                                  </div>
                                  <div className="flex justify-end">
                                     <a 
                                       href="https://developers.paguelofacil.com/api/diccionario-de-datos" 
                                       target="_blank" 
                                       rel="noreferrer"
                                       className="text-[10px] text-slate-400 hover:text-[#27bea5] underline flex items-center gap-1"
                                     >
                                       Ver documentación API <ArrowRight className="w-3 h-3" />
                                     </a>
                                  </div>
                              </div>
                            )}

                            {/* YAPPY FORM */}
                            {activePaymentTab === 'YAPPY' && (
                              <div className="space-y-4 animate-in fade-in">
                                  {/* LOGO IMAGE */}
                                  <div className="bg-white p-3 rounded-xl flex items-center justify-center mb-4 shadow-sm">
                                     <img 
                                       src="https://konsul.digital/wp-content/uploads/2025/12/yappy-color-landscape.avif" 
                                       alt="Yappy" 
                                       className="h-10 object-contain" 
                                     />
                                  </div>

                                  <div className="space-y-2">
                                     <label className="text-[10px] font-bold text-[#ff6b00] uppercase tracking-widest flex items-center gap-1">
                                        <Lock className="w-3 h-3" /> Merchant ID
                                     </label>
                                     <input 
                                       value={profile.paymentIntegration?.yappyMerchantId || ''}
                                       onChange={(e) => handlePaymentConfigChange('yappyMerchantId', e.target.value)}
                                       className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-[#ff6b00] transition-colors font-mono"
                                       placeholder="Ej. ID de Comercio Yappy"
                                     />
                                  </div>
                                  <div className="space-y-2">
                                     <label className="text-[10px] font-bold text-[#ff6b00] uppercase tracking-widest flex items-center gap-1">
                                        <Key className="w-3 h-3" /> Secret Key
                                     </label>
                                     <div className="relative">
                                        <input 
                                          type={showKeys['yappy_secret'] ? "text" : "password"}
                                          value={profile.paymentIntegration?.yappySecretKey || ''}
                                          onChange={(e) => handlePaymentConfigChange('yappySecretKey', e.target.value)}
                                          className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-[#ff6b00] transition-colors font-mono pr-10"
                                          placeholder="Pegar llave secreta de Yappy"
                                        />
                                        <button 
                                          onClick={() => toggleKeyVisibility('yappy_secret')}
                                          className="absolute right-3 top-3 text-slate-500 hover:text-white transition-colors"
                                        >
                                          {showKeys['yappy_secret'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                     </div>
                                  </div>
                                  <div className="flex justify-end">
                                     <a 
                                       href="https://www.yappy.com.pa/comercial/desarrolladores/boton-de-pago-yappy-nueva-integracion/" 
                                       target="_blank" 
                                       rel="noreferrer"
                                       className="text-[10px] text-slate-400 hover:text-[#ff6b00] underline flex items-center gap-1"
                                     >
                                       Guía de Integración <ArrowRight className="w-3 h-3" />
                                     </a>
                                  </div>
                              </div>
                            )}

                         </div>
                      )}
                   </div>
                </div>
             </div>
          </div>

          {/* CARD: AI BRAIN */}
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
               Conecta tus llaves de IA para darle superpoderes ilimitados a tu asistente.
             </p>
             
             <div className="space-y-6 relative z-10">
                {/* Gemini */}
                <div className="space-y-2">
                   <label className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                      <span>Google Gemini API Key</span>
                      <span className="text-[#27bea5] bg-[#27bea5]/10 px-2 py-0.5 rounded text-[10px]">Recomendado</span>
                   </label>
                   <div className="relative flex gap-2">
                      <div className="relative group/input flex-1">
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
                      
                      {/* TEST BUTTON */}
                      <button 
                        onClick={() => runConnectionTest('gemini')}
                        disabled={!profile.apiKeys?.gemini || testStatus['gemini'] === 'LOADING'}
                        className={`p-3.5 rounded-2xl border transition-all flex items-center justify-center ${
                          testStatus['gemini'] === 'SUCCESS' ? 'bg-green-500/20 border-green-500 text-green-400' : 
                          testStatus['gemini'] === 'ERROR' ? 'bg-red-500/20 border-red-500 text-red-400' :
                          'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                        title="Probar Conexión"
                      >
                         {testStatus['gemini'] === 'LOADING' ? <Loader2 className="w-5 h-5 animate-spin" /> : 
                          testStatus['gemini'] === 'SUCCESS' ? <CheckCircle2 className="w-5 h-5" /> : 
                          testStatus['gemini'] === 'ERROR' ? <XCircle className="w-5 h-5" /> : 
                          <Zap className="w-5 h-5" />}
                      </button>
                   </div>
                </div>

                {/* OpenAI */}
                <div className="space-y-2">
                   <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">OpenAI API Key (Backup)</label>
                   <div className="relative flex gap-2">
                      <div className="relative group/input flex-1">
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
                      
                      {/* TEST BUTTON */}
                      <button 
                        onClick={() => runConnectionTest('openai')}
                        disabled={!profile.apiKeys?.openai || testStatus['openai'] === 'LOADING'}
                        className={`p-3.5 rounded-2xl border transition-all flex items-center justify-center ${
                          testStatus['openai'] === 'SUCCESS' ? 'bg-green-500/20 border-green-500 text-green-400' : 
                          testStatus['openai'] === 'ERROR' ? 'bg-red-500/20 border-red-500 text-red-400' :
                          'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                        title="Probar Conexión"
                      >
                         {testStatus['openai'] === 'LOADING' ? <Loader2 className="w-5 h-5 animate-spin" /> : 
                          testStatus['openai'] === 'SUCCESS' ? <CheckCircle2 className="w-5 h-5" /> : 
                          testStatus['openai'] === 'ERROR' ? <XCircle className="w-5 h-5" /> : 
                          <Zap className="w-5 h-5" />}
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
                            {style}
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
