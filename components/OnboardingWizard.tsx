
import React, { useState, useRef } from 'react';
import { 
  Building2, Check, ChevronRight, Palette, CreditCard, ShoppingBag, Mail, Sparkles,
  Loader2, Globe, UploadCloud, LayoutTemplate, Search, MapPin, AlertCircle, X,
  Coins, Smartphone, Server, AtSign, ShieldCheck, Zap, ArrowRight, PenLine,
  User, CheckCircle2, Hash, Lock, Eye, EyeOff, Crown, Rocket
} from 'lucide-react';
import { UserProfile, CatalogItem, EmailConfig } from '../types';
import { suggestCatalogItems, generateEmailTemplate } from '../services/geminiService';
import { consultarRucDGI } from '../services/dgiService'; 

interface OnboardingWizardProps {
  onComplete: (profileData: Partial<UserProfile> & { password?: string, email?: string }) => void;
}

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

// Panama only configuration
const DEFAULT_COUNTRY = 'Panamá';
const DEFAULT_CURRENCY = 'USD';
const DEFAULT_PHONE_CODE = '+507';

const CURRENCIES = ['USD', 'EUR', 'MXN', 'ARS', 'COP', 'CLP', 'PEN'];

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  // Step 1 State - Identity & Credentials
  const [personType, setPersonType] = useState<'NATURAL' | 'JURIDICA' | null>(null);
  const [taxId, setTaxId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState(''); // New
  const [password, setPassword] = useState(''); // New
  const [showPassword, setShowPassword] = useState(false);
  const [manualEntryMode, setManualEntryMode] = useState(false);

  // Step 2 State
  const [primaryColor, setPrimaryColor] = useState('#27bea5');
  const [templateStyle, setTemplateStyle] = useState<'Modern' | 'Classic' | 'Minimal'>('Modern');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3 State
  const [bankAccount, setBankAccount] = useState('');
  const [acceptsOnline, setAcceptsOnline] = useState(false);
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);

  // Step 4 State
  const [businessDesc, setBusinessDesc] = useState('');
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);

  // Step 5 State
  const [tone, setTone] = useState<'Formal' | 'Casual' | null>(null);
  const [emailPreview, setEmailPreview] = useState('');

  // Step 6 State (Channels)
  const [whatsappCountryCode, setWhatsappCountryCode] = useState(DEFAULT_PHONE_CODE);
  const [whatsappNumber, setWhatsappNumber] = useState('');

  // Step 7 State (Plan)
  const [selectedPlan, setSelectedPlan] = useState<'Free' | 'Emprendedor Pro' | 'Empresa Scale'>('Free');

  // --- ACTIONS ---

  const handlePersonTypeSelect = (type: 'NATURAL' | 'JURIDICA') => {
    setPersonType(type);
    setManualEntryMode(true); 
    setTaxId('');
    setCompanyName('');
    setAddress('');
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateCatalog = async () => {
    if (!businessDesc) return;
    setIsLoading(true);
    const items = await suggestCatalogItems(businessDesc);
    setCatalogItems(items);
    setIsLoading(false);
  };

  const updateCatalogItem = (index: number, field: keyof CatalogItem, value: any) => {
    const newItems = [...catalogItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setCatalogItems(newItems);
  };

  const generateEmail = async (selectedTone: 'Formal' | 'Casual') => {
    setTone(selectedTone);
    setIsLoading(true);
    const text = await generateEmailTemplate(selectedTone);
    setEmailPreview(text);
    setIsLoading(false);
  };

  const initiatePayment = async (userId: string) => {
    try {
      setIsRedirecting(true);
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: selectedPlan,
          email: email,
          userId: userId
        })
      });
      
      const { url, error } = await response.json();
      
      if (error) throw new Error(error);
      if (url) window.location.href = url;
      
    } catch (error) {
      console.error("Payment Error:", error);
      setIsRedirecting(false);
      alert("Hubo un error iniciando el pago. Por favor intenta más tarde.");
    }
  };

  const finishOnboarding = async () => {
    const emailConfig: EmailConfig = {
      provider: 'SYSTEM',
      email: email
    };

    // We create the user object but we might delay "complete" if payment is needed
    // However, logic here is: Save User -> If Paid, Redirect -> If Free, Enter App.
    // The App component will handle authentication.
    
    // NOTE: This calls `onComplete` in App.tsx which creates the user in DB.
    // We need to ensure we can capture the userId to pass to Stripe if needed,
    // but createUserInDb is void/boolean.
    // Strategy: We pass the plan to onComplete. 
    
    const profileData = {
      name: companyName || 'Usuario Nuevo',
      taxId,
      address,
      country: DEFAULT_COUNTRY,
      fiscalRegime: personType === 'JURIDICA' ? 'Sociedad Anónima' : 'Persona Natural',
      branding: { primaryColor, templateStyle, logoUrl: logoPreview || undefined },
      bankAccount,
      acceptsOnlinePayment: acceptsOnline,
      defaultCurrency: currency,
      defaultServices: catalogItems,
      toneOfVoice: tone || 'Casual',
      emailConfig,
      whatsappNumber,
      whatsappCountryCode,
      plan: selectedPlan,
      isOnboardingComplete: true, // Will be set to true in DB
      email, 
      password
    };

    if (selectedPlan === 'Free') {
        onComplete(profileData);
    } else {
        // 1. Create User in DB first via onComplete (Assume success for UI flow)
        // We need the User ID for Stripe to reconcile later. 
        // Since we don't have the ID here easily without refactoring App.tsx significantly,
        // We will pass the email as reference to Stripe and reconcile by email on return.
        
        // Optimistic UI: Redirecting...
        setIsRedirecting(true);
        
        // We trigger creation in background so the user exists when they return from Stripe
        // But we DON'T wait for it to finish to start redirect logic to feel snappier,
        // though we need the ID. 
        // *Correction*: We must wait for creation or Stripe won't have an ID if we want strict linking.
        // Let's rely on email linking in `create-checkout-session.js`.
        
        await onComplete(profileData); // This saves to DB and logs in
        
        // After onComplete, App.tsx sets currentUser. We can't access it here easily.
        // But we can just fire the payment link for the email.
        // On return, App.tsx checks query params.
        
        await initiatePayment(email); // Using email as temp ID for this flow
    }
  };

  // --- RENDER HELPERS ---
  const renderTemplatePreview = (style: 'Modern' | 'Classic' | 'Minimal') => {
    // ... (Keep existing preview logic)
    const isSelected = templateStyle === style;
    switch (style) {
      case 'Modern':
        return (
          <div className="h-full flex flex-col bg-white">
            <div style={{ backgroundColor: primaryColor }} className="h-16 w-full flex items-center px-2 relative transition-colors duration-300">
               {logoPreview && <img src={logoPreview} className="h-8 w-8 object-contain bg-white rounded-md p-0.5 shadow-sm" />}
            </div>
            <div className="p-3 space-y-2">
              <div className="h-1.5 bg-slate-100 w-3/4 rounded-full"></div>
              <div className="h-1.5 bg-slate-100 w-1/2 rounded-full"></div>
            </div>
            <div className="mt-auto p-3 border-t border-slate-50 flex justify-between items-center">
               <span className="text-[6px] font-bold text-slate-400">TOTAL</span>
               <div style={{ color: primaryColor }} className="text-[10px] font-bold">$1,250.00</div>
            </div>
          </div>
        );
      case 'Classic':
        return (
           <div className="h-full flex flex-col bg-white p-4 border-4 border-double" style={{ borderColor: isSelected ? primaryColor : '#e2e8f0' }}>
             <div className="text-center mb-3 border-b pb-2" style={{ borderColor: primaryColor }}>
               <span className="text-[8px] font-serif font-bold text-[#1c2938] uppercase tracking-widest">Factura</span>
             </div>
             <div className="flex justify-between items-start mb-2">
               {logoPreview ? <img src={logoPreview} className="h-6 w-6 object-contain" /> : <div className="h-6 w-6 bg-slate-100 rounded"></div>}
               <div className="space-y-1 text-right">
                  <div className="h-1 bg-slate-200 w-8 ml-auto"></div>
                  <div className="h-1 bg-slate-200 w-5 ml-auto"></div>
               </div>
             </div>
           </div>
        );
      case 'Minimal':
        return (
          <div className="h-full flex flex-col bg-white p-4">
            <div className="flex items-center gap-3 mb-6">
              {logoPreview ? (
                <img src={logoPreview} className="h-8 w-8 object-contain" />
              ) : (
                <div style={{ backgroundColor: primaryColor }} className="h-4 w-4 rounded-full"></div>
              )}
              <div className="h-2 w-16 bg-slate-100 rounded"></div>
            </div>
            <div className="mt-auto text-right">
               <p className="text-[8px] text-slate-400 uppercase">Total a Pagar</p>
               <span style={{ color: primaryColor }} className="text-xs font-bold tracking-tighter text-2xl">$1,250</span>
            </div>
          </div>
        );
    }
  };


  // --- STEPS ---

  const renderStep1_Fiscal = () => (
    <div className="animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-blue-100 shadow-sm">
           <span>🇵🇦</span> Edición Panamá
        </div>
        <h2 className="text-4xl font-bold text-[#1c2938] mb-3">Tu Identidad Fiscal</h2>
        <p className="text-slate-500 text-lg">Selecciona tu tipo de entidad para configurar tu perfil.</p>
      </div>

      <div className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 max-w-2xl mx-auto">
        
        {/* Person Type Selector */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
           <button 
             onClick={() => handlePersonTypeSelect('NATURAL')}
             className={`p-6 rounded-2xl border-2 text-left transition-all duration-300 group ${
                personType === 'NATURAL' 
                ? 'border-[#27bea5] bg-[#27bea5]/5 ring-2 ring-[#27bea5]/10 shadow-lg' 
                : 'border-slate-100 hover:border-slate-300 bg-white hover:shadow-md'
             }`}
           >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${personType === 'NATURAL' ? 'bg-[#27bea5] text-white' : 'bg-slate-100 text-slate-400'}`}>
                 <User className="w-6 h-6" />
              </div>
              <h3 className={`font-bold text-lg ${personType === 'NATURAL' ? 'text-[#1c2938]' : 'text-slate-600'}`}>Persona Natural</h3>
              <p className="text-sm text-slate-400 mt-1">Profesional Independiente (Cédula)</p>
           </button>

           <button 
             onClick={() => handlePersonTypeSelect('JURIDICA')}
             className={`p-6 rounded-2xl border-2 text-left transition-all duration-300 group ${
                personType === 'JURIDICA' 
                ? 'border-[#27bea5] bg-[#27bea5]/5 ring-2 ring-[#27bea5]/10 shadow-lg' 
                : 'border-slate-100 hover:border-slate-300 bg-white hover:shadow-md'
             }`}
           >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${personType === 'JURIDICA' ? 'bg-[#27bea5] text-white' : 'bg-slate-100 text-slate-400'}`}>
                 <Building2 className="w-6 h-6" />
              </div>
              <h3 className={`font-bold text-lg ${personType === 'JURIDICA' ? 'text-[#1c2938]' : 'text-slate-600'}`}>Sociedad</h3>
              <p className="text-sm text-slate-400 mt-1">Empresa Jurídica (RUC)</p>
           </button>
        </div>

        {/* Manual Entry Form */}
        {(personType) && (
          <div className="mt-8 bg-slate-50 p-6 rounded-3xl border border-slate-100 animate-in slide-in-from-bottom-6">
             <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-[#1c2938] flex items-center gap-2">
                  <PenLine className="w-5 h-5 text-[#27bea5]" /> 
                  Datos Oficiales
                </h3>
             </div>

             <div className="space-y-4">
               {/* 1. Tax ID */}
               <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                    {personType === 'NATURAL' ? 'Cédula de Identidad' : 'RUC (Registro Único)'}
                  </label>
                  <div className="relative group/input">
                    <Hash className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within/input:text-[#27bea5] transition-colors" />
                    <input 
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value.toUpperCase())}
                      className="w-full pl-12 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#27bea5] outline-none font-mono font-bold text-[#1c2938] placeholder:text-slate-300 uppercase"
                      placeholder={personType === 'NATURAL' ? "Ej: 8-123-456" : "Ej: 15569888-2-2021 DV 55"}
                      autoFocus
                    />
                  </div>
               </div>

               {/* 2. Name */}
               <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                    {personType === 'NATURAL' ? 'Nombre Completo' : 'Razón Social'}
                  </label>
                  <div className="relative group/input">
                    {personType === 'NATURAL' ? (
                       <User className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within/input:text-[#27bea5] transition-colors" />
                    ) : (
                       <Building2 className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within/input:text-[#27bea5] transition-colors" />
                    )}
                    <input 
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full pl-12 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#27bea5] outline-none font-bold text-[#1c2938] placeholder:text-slate-300"
                      placeholder={personType === 'JURIDICA' ? "Nombre de la Sociedad" : "Tu Nombre Completo"}
                    />
                  </div>
               </div>

               {/* 3. Address */}
               <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Dirección Fiscal</label>
                  <div className="relative group/input">
                    <MapPin className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within/input:text-[#27bea5] transition-colors" />
                    <input 
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full pl-12 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#27bea5] outline-none text-slate-700 placeholder:text-slate-300"
                      placeholder="Calle, Corregimiento, Ciudad de Panamá"
                    />
                  </div>
               </div>

               {/* 4. Credentials (NEW) */}
               <div className="pt-4 border-t border-slate-200">
                  <h4 className="text-sm font-bold text-[#1c2938] mb-4 flex items-center gap-2">
                     <ShieldCheck className="w-4 h-4 text-[#27bea5]" /> Crea tu Acceso Seguro
                  </h4>
                  <div className="space-y-4">
                     <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Correo Electrónico</label>
                        <div className="relative group/input">
                           <Mail className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within/input:text-[#27bea5] transition-colors" />
                           <input 
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className="w-full pl-12 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#27bea5] outline-none text-slate-700 placeholder:text-slate-300"
                              placeholder="tu@email.com"
                           />
                        </div>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Contraseña</label>
                        <div className="relative group/input">
                           <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within/input:text-[#27bea5] transition-colors" />
                           <input 
                              type={showPassword ? "text" : "password"}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="w-full pl-12 pr-12 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#27bea5] outline-none text-slate-700 placeholder:text-slate-300"
                              placeholder="••••••••"
                           />
                           <button 
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-3.5 text-slate-400 hover:text-[#1c2938] transition-colors"
                           >
                              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                           </button>
                        </div>
                     </div>
                  </div>
               </div>
             </div>
          </div>
        )}

        {/* Action Button */}
        <div className="mt-10 flex justify-end">
           <button 
            onClick={() => setStep(2)}
            disabled={!companyName || !address || !taxId || !email || !password}
            className="group w-full md:w-auto bg-[#1c2938] text-white py-4 px-10 rounded-2xl font-bold text-lg hover:bg-[#27bea5] disabled:opacity-30 disabled:hover:bg-[#1c2938] transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-3 cursor-pointer"
          >
            Siguiente <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep2_Branding = () => (
    <div className="animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="text-center mb-10">
        <h2 className="text-4xl font-bold text-[#1c2938] mb-3">Diseña tu Marca</h2>
        <p className="text-slate-500 text-lg">Personaliza cómo te verán tus clientes.</p>
      </div>

      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Controls */}
        <div className="lg:col-span-5 space-y-8">
           
           {/* Logo Uploader */}
           <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
              <h3 className="font-bold text-[#1c2938] mb-4 flex items-center gap-2">
                 <UploadCloud className="w-5 h-5 text-[#27bea5]" /> Logotipo
              </h3>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleLogoUpload}
              />
              
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="relative group cursor-pointer border-2 border-dashed border-slate-200 rounded-2xl h-48 flex flex-col items-center justify-center hover:border-[#27bea5] hover:bg-slate-50 transition-all overflow-hidden"
              >
                 {logoPreview ? (
                   <>
                     <img src={logoPreview} className="w-full h-full object-contain p-6" />
                     <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold">
                        Cambiar Logo
                     </div>
                   </>
                 ) : (
                   <>
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-[#27bea5]" />
                      </div>
                      <p className="text-sm font-bold text-slate-500">Arrastra o haz clic</p>
                   </>
                 )}
              </div>
           </div>

           {/* Color Picker */}
           <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
              <h3 className="font-bold text-[#1c2938] mb-4 flex items-center gap-2">
                 <Palette className="w-5 h-5 text-[#27bea5]" /> Color Principal
              </h3>
              <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                 <input 
                   type="color"
                   value={primaryColor}
                   onChange={(e) => setPrimaryColor(e.target.value)}
                   className="w-14 h-14 rounded-xl cursor-pointer border-none bg-transparent"
                 />
                 <div className="flex-1">
                    <p className="text-xs font-bold text-slate-400 uppercase">HEX Code</p>
                    <p className="font-mono text-lg font-bold text-[#1c2938]">{primaryColor}</p>
                 </div>
              </div>
           </div>

           {/* Navigation */}
           <div className="flex gap-4">
              <button 
                onClick={() => setStep(1)}
                className="flex-1 py-4 font-bold text-slate-500 hover:text-[#1c2938] hover:bg-white rounded-2xl transition-colors cursor-pointer"
              >
                Atrás
              </button>
              <button 
                onClick={() => setStep(3)}
                className="flex-[2] bg-[#1c2938] text-white py-4 rounded-2xl font-bold hover:bg-[#27bea5] transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer"
              >
                Se ve genial <ArrowRight className="w-5 h-5" />
              </button>
           </div>
        </div>

        {/* Right Column: Interactive Preview */}
        <div className="lg:col-span-7">
           <div className="bg-slate-100 p-8 rounded-[3rem] h-full flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-slate-500 uppercase tracking-widest text-xs mb-6 text-center">Selecciona tu Estilo</h3>
                <div className="grid grid-cols-3 gap-4 mb-8">
                   {(['Modern', 'Classic', 'Minimal'] as const).map(style => (
                      <button
                        key={style}
                        onClick={() => setTemplateStyle(style)}
                        className={`py-3 px-2 rounded-xl text-sm font-bold transition-all ${
                          templateStyle === style 
                            ? 'bg-white text-[#1c2938] shadow-md ring-1 ring-black/5' 
                            : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                        }`}
                      >
                        {style}
                      </button>
                   ))}
                </div>
              </div>

              {/* The "Document" */}
              <div className="flex-1 bg-white rounded-xl shadow-2xl shadow-slate-300/50 overflow-hidden transform transition-all duration-500 hover:scale-[1.02] origin-bottom mx-auto w-full max-w-sm aspect-[3/4] relative">
                 {renderTemplatePreview(templateStyle)}
                 <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-tr from-transparent via-white/20 to-transparent opacity-50 pointer-events-none"></div>
              </div>
           </div>
        </div>

      </div>
    </div>
  );

  const renderStep3_Finance = () => (
    <div className="animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="text-center mb-10">
        <h2 className="text-4xl font-bold text-[#1c2938] mb-3">Tu Bóveda Financiera</h2>
        <p className="text-slate-500 text-lg">Define cómo y en qué moneda recibirás tus pagos.</p>
      </div>

      <div className="max-w-xl mx-auto space-y-6">
        
        {/* Bank Account Card */}
        <div className="bg-gradient-to-br from-[#1c2938] to-slate-800 p-8 rounded-[2.5rem] shadow-2xl text-white relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-64 h-64 bg-[#27bea5] rounded-full blur-[80px] opacity-10 -translate-y-1/2 translate-x-1/2"></div>
           
           <div className="relative z-10 space-y-6">
              <div className="flex justify-between items-center">
                 <CreditCard className="w-8 h-8 text-[#27bea5]" />
                 <span className="text-xs font-bold bg-white/10 px-3 py-1 rounded-full text-slate-300 uppercase tracking-widest">Principal</span>
              </div>

              <div>
                 <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Cuenta Bancaria (IBAN / ACH)</label>
                 <input 
                   value={bankAccount}
                   onChange={(e) => setBankAccount(e.target.value)}
                   placeholder="0000 0000 0000 0000"
                   className="w-full bg-transparent text-2xl md:text-3xl font-mono text-white placeholder:text-slate-600 outline-none border-b border-slate-600 focus:border-[#27bea5] py-2 transition-colors"
                 />
              </div>

              <div className="flex gap-4">
                 <div className="flex-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Moneda Base</label>
                    <div className="relative">
                       <select 
                         value={currency}
                         onChange={(e) => setCurrency(e.target.value)}
                         className="w-full bg-white/10 text-white p-3 rounded-xl outline-none appearance-none cursor-pointer hover:bg-white/20 transition-colors font-bold"
                       >
                         {CURRENCIES.map(c => <option key={c} value={c} className="text-slate-900">{c}</option>)}
                       </select>
                       <Coins className="absolute right-3 top-3 w-5 h-5 text-slate-400 pointer-events-none" />
                    </div>
                 </div>
                 <div className="flex-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Banco</label>
                    <input className="w-full bg-white/10 text-white p-3 rounded-xl outline-none placeholder:text-slate-500 font-medium" placeholder="Ej. Banco General" />
                 </div>
              </div>
           </div>
        </div>

        {/* Online Payments Toggle */}
        <div 
           onClick={() => setAcceptsOnline(!acceptsOnline)}
           className={`p-6 rounded-[2rem] border-2 cursor-pointer transition-all duration-300 flex items-center justify-between group ${
             acceptsOnline ? 'bg-[#27bea5]/5 border-[#27bea5]' : 'bg-white border-slate-100 hover:border-slate-300'
           }`}
        >
           <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                 acceptsOnline ? 'bg-[#27bea5] text-white' : 'bg-slate-100 text-slate-400'
              }`}>
                 <Zap className="w-6 h-6 fill-current" />
              </div>
              <div>
                 <h4 className={`font-bold text-lg ${acceptsOnline ? 'text-[#1c2938]' : 'text-slate-600'}`}>Pagos Digitales</h4>
                 <p className="text-sm text-slate-400">Habilitar enlaces de pago y QR</p>
              </div>
           </div>
           
           <div className={`w-14 h-8 rounded-full relative transition-colors ${acceptsOnline ? 'bg-[#27bea5]' : 'bg-slate-200'}`}>
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform shadow-sm ${acceptsOnline ? 'left-7' : 'left-1'}`}></div>
           </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button 
            onClick={() => setStep(2)}
            className="flex-1 py-4 font-bold text-slate-500 hover:text-[#1c2938] hover:bg-white rounded-2xl transition-colors cursor-pointer"
          >
            Atrás
          </button>
          <button 
            onClick={() => setStep(4)}
            className="flex-[2] bg-[#1c2938] text-white py-4 rounded-2xl font-bold hover:bg-[#27bea5] transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer"
          >
            Guardar Billetera <ArrowRight className="w-5 h-5" />
          </button>
        </div>

      </div>
    </div>
  );

  const renderStep4_Catalog = () => (
    <div className="animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="text-center mb-10">
        <h2 className="text-4xl font-bold text-[#1c2938] mb-3">Tu Oferta de Valor</h2>
        <p className="text-slate-500 text-lg">Describe tu negocio y la IA creará tu catálogo inicial.</p>
      </div>

      <div className="max-w-3xl mx-auto">
         
         {/* Magic Input */}
         <div className="bg-white p-2 rounded-[2rem] shadow-xl shadow-indigo-100/50 border border-slate-100 flex flex-col md:flex-row gap-2 relative z-10">
            <input 
              value={businessDesc}
              onChange={(e) => setBusinessDesc(e.target.value)}
              placeholder="Ej: Soy diseñador gráfico freelance y hago branding..."
              className="flex-1 p-6 text-lg bg-transparent outline-none text-[#1c2938] placeholder:text-slate-300 font-medium"
              onKeyDown={(e) => e.key === 'Enter' && generateCatalog()}
              autoFocus
            />
            <button 
              onClick={generateCatalog}
              disabled={!businessDesc || isLoading}
              className="bg-[#27bea5] text-white px-8 py-4 rounded-[1.5rem] font-bold hover:bg-[#22a890] disabled:opacity-50 transition-all flex items-center gap-2 min-w-[160px] justify-center group cursor-pointer"
            >
              {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : <Sparkles className="w-5 h-5 group-hover:scale-125 transition-transform" />}
              <span>{isLoading ? 'Creando...' : 'Generar'}</span>
            </button>
         </div>

         {/* Results Area */}
         <div className="mt-10 min-h-[300px]">
            {catalogItems.length > 0 ? (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-8">
                  {catalogItems.map((item, idx) => (
                     <div key={idx} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 hover:border-[#27bea5] transition-all group hover:-translate-y-1 flex flex-col gap-3 relative">
                        {/* Edit Indicator */}
                        <div className="absolute top-4 right-4 text-slate-300 group-hover:text-[#27bea5] transition-colors pointer-events-none">
                           <PenLine className="w-4 h-4" />
                        </div>

                        <div className="flex justify-between items-start mb-1">
                           <div className="p-3 bg-indigo-50 text-indigo-500 rounded-2xl group-hover:bg-[#27bea5] group-hover:text-white transition-colors flex-shrink-0">
                              <ShoppingBag className="w-6 h-6" />
                           </div>
                           <div className="flex items-center text-xl font-bold text-[#1c2938]">
                              <span className="text-slate-400 mr-1 text-sm">$</span>
                              <input 
                                 type="number"
                                 value={item.price}
                                 onChange={(e) => updateCatalogItem(idx, 'price', parseFloat(e.target.value) || 0)}
                                 className="w-24 bg-transparent outline-none border-b border-transparent focus:border-[#27bea5] transition-colors text-right"
                              />
                           </div>
                        </div>
                        <input 
                           type="text"
                           value={item.name}
                           onChange={(e) => updateCatalogItem(idx, 'name', e.target.value)}
                           className="font-bold text-lg text-slate-800 bg-transparent outline-none border-b border-transparent focus:border-[#27bea5] transition-colors w-full"
                        />
                        <p className="text-sm text-slate-400 font-light">Servicio sugerido</p>
                     </div>
                  ))}
                  
                  {/* Next Step Card */}
                  <div className="flex items-center justify-center p-6">
                     <button 
                       onClick={() => setStep(5)}
                       className="w-full bg-[#1c2938] text-white py-4 rounded-2xl font-bold hover:bg-[#27bea5] transition-all shadow-xl hover:shadow-2xl flex items-center justify-center gap-2 cursor-pointer"
                     >
                       Continuar <ArrowRight className="w-5 h-5" />
                     </button>
                  </div>
               </div>
            ) : (
               <div className="flex flex-col items-center justify-center text-slate-300 h-64 border-2 border-dashed border-slate-100 rounded-[3rem]">
                  <ShoppingBag className="w-16 h-16 mb-4 opacity-20" />
                  <p className="font-medium">Tus servicios aparecerán aquí</p>
               </div>
            )}
         </div>
      </div>
    </div>
  );

  const renderStep5_Comms = () => (
    <div className="animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="text-center mb-10">
        <h2 className="text-4xl font-bold text-[#1c2938] mb-3">Tu Voz ante el Cliente</h2>
        <p className="text-slate-500 text-lg">Elige el tono de comunicación para tus correos automáticos.</p>
      </div>

      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        {/* Tone Selectors */}
        <div className="space-y-6">
          {(['Formal', 'Casual'] as const).map((t) => (
             <button 
               key={t}
               onClick={() => generateEmail(t)}
               className={`w-full p-8 text-left rounded-[2.5rem] border-2 transition-all duration-300 group hover:shadow-lg cursor-pointer ${
                 tone === t 
                   ? 'border-[#27bea5] bg-white ring-4 ring-[#27bea5]/10 shadow-lg' 
                   : 'border-transparent bg-white shadow-sm hover:border-slate-200'
               }`}
             >
               <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-2xl ${tone === t ? 'bg-[#27bea5] text-white' : 'bg-slate-100 text-slate-400'}`}>
                    {t === 'Formal' ? <Building2 className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
                  </div>
                  {tone === t && <div className="w-6 h-6 bg-[#27bea5] rounded-full flex items-center justify-center text-white"><Check className="w-4 h-4"/></div>}
               </div>
               <h3 className="text-2xl font-bold text-[#1c2938] mb-2">{t === 'Formal' ? 'Corporativo' : 'Cercano'}</h3>
               <p className="text-slate-500 font-light leading-relaxed">
                 {t === 'Formal' 
                   ? "Ideal para empresas grandes. Serio, directo y profesional. Genera confianza institucional." 
                   : "Perfecto para creativos y freelancers. Amigable, usa emojis y calidez humana."}
               </p>
             </button>
          ))}
        </div>

        {/* Live Preview (Phone Style) */}
        <div className="relative mx-auto">
           <div className="w-[320px] h-[580px] bg-[#1c2938] rounded-[3rem] p-4 shadow-2xl relative border-4 border-[#2c3e50]">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-[#1c2938] rounded-b-2xl z-20"></div>
              <div className="bg-slate-50 w-full h-full rounded-[2.2rem] overflow-hidden flex flex-col relative">
                 <div className="bg-white p-4 pt-10 border-b border-slate-100 shadow-sm z-10">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 bg-slate-200 rounded-full"></div>
                       <div className="h-2 bg-slate-200 w-24 rounded-full"></div>
                    </div>
                 </div>
                 <div className="p-6 flex-1 overflow-y-auto">
                    {isLoading ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-[#27bea5]" />
                        <span className="text-xs font-bold uppercase tracking-widest">Escribiendo...</span>
                      </div>
                    ) : tone ? (
                      <div className="animate-in fade-in slide-in-from-bottom-4">
                         <div className="font-serif text-slate-800 text-lg leading-relaxed mb-6">
                           {emailPreview || (tone === 'Formal' ? "Estimado cliente..." : "Hola!...")}
                         </div>
                         <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                           <div className="w-10 h-10 bg-red-50 text-red-500 rounded-lg flex items-center justify-center">
                             <span className="font-bold text-xs">PDF</span>
                           </div>
                           <div>
                             <p className="text-xs font-bold text-slate-700">Factura_001.pdf</p>
                             <p className="text-[10px] text-slate-400">125 KB</p>
                           </div>
                         </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-300 text-center px-4">
                        <Sparkles className="w-12 h-12 mb-4 opacity-30" />
                        <p className="font-medium text-sm">Selecciona un estilo.</p>
                      </div>
                    )}
                 </div>
              </div>
           </div>
           <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-full flex justify-center">
              <button 
                onClick={() => setStep(6)}
                disabled={!tone}
                className="bg-[#27bea5] text-white px-10 py-4 rounded-full font-bold shadow-xl hover:bg-[#22a890] hover:scale-105 transition-all flex items-center gap-2 disabled:opacity-50 disabled:hover:scale-100 cursor-pointer"
              >
                Continuar <ArrowRight className="w-5 h-5" />
              </button>
           </div>
        </div>
      </div>
    </div>
  );

  const renderStep6_Channels = () => (
    <div className="animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="text-center mb-10">
        <h2 className="text-4xl font-bold text-[#1c2938] mb-3">Conexiones Finales</h2>
        <p className="text-slate-500 text-lg">El correo oficial ya está configurado. Opcionalmente, agrega WhatsApp.</p>
      </div>

      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Email Channel Card (System Only) */}
        <div className="p-8 rounded-[2.5rem] bg-[#1c2938] text-white shadow-xl flex flex-col justify-between">
           <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-blue-500/20 text-blue-400 rounded-2xl">
                <Mail className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-bold text-xl">Correo Oficial</h3>
                <p className="text-sm text-slate-400">Entrega garantizada por Resend</p>
              </div>
           </div>

           <div className="bg-white/10 p-6 rounded-2xl border border-white/10 mb-4">
              <div className="flex items-center gap-3 text-green-400 font-bold mb-2">
                 <CheckCircle2 className="w-5 h-5" />
                 <span>Activado</span>
              </div>
              <p className="text-sm text-slate-300">
                 Tus facturas se enviarán automáticamente desde nuestro servidor seguro. No requiere configuración adicional.
              </p>
           </div>
        </div>

        {/* WhatsApp Channel Card */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-between">
           <div>
              <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-green-50 text-green-600 rounded-2xl">
                    <Smartphone className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl text-[#1c2938]">WhatsApp Business</h3>
                    <p className="text-sm text-slate-400">Entrega rápida (Opcional)</p>
                  </div>
              </div>
              
              <div className="bg-slate-50 p-6 rounded-3xl space-y-4">
                 <div>
                    <label className="text-xs font-bold text-slate-400 uppercase ml-1 mb-1 block">Código</label>
                    <select 
                       value={whatsappCountryCode}
                       onChange={(e) => setWhatsappCountryCode(e.target.value)}
                       className="w-full p-3 bg-white rounded-xl border border-slate-200 font-bold text-[#1c2938] outline-none"
                    >
                       <option value="+507">🇵🇦 +507 (Panamá)</option>
                       <option value="+1">🇺🇸 +1</option>
                    </select>
                 </div>
                 <div>
                    <label className="text-xs font-bold text-slate-400 uppercase ml-1 mb-1 block">Número</label>
                    <input 
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      className="w-full p-3 bg-white rounded-xl border border-slate-200 font-bold text-[#1c2938] outline-none placeholder:text-slate-300"
                      placeholder="6123-4567"
                    />
                 </div>
              </div>
           </div>
        </div>
      </div>

      <div className="flex justify-center mt-12">
        <button 
          onClick={() => setStep(7)} // Move to Step 7 (Plan)
          className="bg-[#1c2938] text-white py-5 px-16 rounded-[2rem] font-bold text-xl hover:bg-[#27bea5] transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 flex items-center gap-3 cursor-pointer"
        >
          Siguiente <ArrowRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );

  const renderStep7_Plan = () => (
    <div className="animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="text-center mb-10">
        <h2 className="text-4xl font-bold text-[#1c2938] mb-3">Elige tu Plan</h2>
        <p className="text-slate-500 text-lg">Potencia tu negocio con las herramientas adecuadas.</p>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* FREE PLAN */}
        <div 
          onClick={() => setSelectedPlan('Free')}
          className={`p-8 rounded-[2.5rem] border-2 cursor-pointer transition-all duration-300 flex flex-col justify-between hover:-translate-y-1 ${
            selectedPlan === 'Free' 
              ? 'border-[#27bea5] bg-white ring-4 ring-[#27bea5]/10 shadow-xl' 
              : 'border-transparent bg-white shadow-sm hover:border-slate-200'
          }`}
        >
           <div>
              <h3 className="text-xl font-bold text-[#1c2938] mb-2">Gratis</h3>
              <p className="text-3xl font-black text-[#1c2938] mb-6">$0 <span className="text-sm font-medium text-slate-400">/mes</span></p>
              <ul className="space-y-3 text-sm text-slate-600 mb-8">
                 <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#27bea5]" /> 10 Facturas/mes</li>
                 <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#27bea5]" /> Clientes limitados</li>
                 <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#27bea5]" /> Marca de agua Kônsul</li>
              </ul>
           </div>
           <div className={`w-full py-3 rounded-xl font-bold text-center transition-colors ${selectedPlan === 'Free' ? 'bg-[#1c2938] text-white' : 'bg-slate-100 text-slate-500'}`}>
              {selectedPlan === 'Free' ? 'Seleccionado' : 'Elegir Gratis'}
           </div>
        </div>

        {/* PRO PLAN */}
        <div 
          onClick={() => setSelectedPlan('Emprendedor Pro')}
          className={`p-8 rounded-[2.5rem] border-2 cursor-pointer transition-all duration-300 flex flex-col justify-between hover:-translate-y-1 relative overflow-hidden ${
            selectedPlan === 'Emprendedor Pro' 
              ? 'border-amber-400 bg-amber-50/10 ring-4 ring-amber-400/20 shadow-xl' 
              : 'border-transparent bg-white shadow-sm hover:border-amber-200'
          }`}
        >
           {selectedPlan === 'Emprendedor Pro' && <div className="absolute top-0 right-0 bg-amber-400 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">POPULAR</div>}
           <div>
              <div className="flex items-center gap-2 mb-2">
                 <h3 className="text-xl font-bold text-[#1c2938]">Emprendedor Pro</h3>
                 <Crown className="w-5 h-5 text-amber-500 fill-amber-500" />
              </div>
              <p className="text-3xl font-black text-[#1c2938] mb-6">$15 <span className="text-sm font-medium text-slate-400">/mes</span></p>
              <ul className="space-y-3 text-sm text-slate-600 mb-8">
                 <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-500" /> Facturación Ilimitada</li>
                 <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-500" /> Sin Marca de Agua</li>
                 <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-500" /> IA Básica (Gemini)</li>
                 <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-500" /> Soporte Email</li>
              </ul>
           </div>
           <div className={`w-full py-3 rounded-xl font-bold text-center transition-colors ${selectedPlan === 'Emprendedor Pro' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {selectedPlan === 'Emprendedor Pro' ? 'Seleccionado' : 'Elegir Pro'}
           </div>
        </div>

        {/* SCALE PLAN */}
        <div 
          onClick={() => setSelectedPlan('Empresa Scale')}
          className={`p-8 rounded-[2.5rem] border-2 cursor-pointer transition-all duration-300 flex flex-col justify-between hover:-translate-y-1 ${
            selectedPlan === 'Empresa Scale' 
              ? 'border-purple-500 bg-purple-50/10 ring-4 ring-purple-500/20 shadow-xl' 
              : 'border-transparent bg-white shadow-sm hover:border-purple-200'
          }`}
        >
           <div>
              <div className="flex items-center gap-2 mb-2">
                 <h3 className="text-xl font-bold text-[#1c2938]">Empresa Scale</h3>
                 <Rocket className="w-5 h-5 text-purple-500 fill-purple-500" />
              </div>
              <p className="text-3xl font-black text-[#1c2938] mb-6">$35 <span className="text-sm font-medium text-slate-400">/mes</span></p>
              <ul className="space-y-3 text-sm text-slate-600 mb-8">
                 <li className="flex items-center gap-2"><Check className="w-4 h-4 text-purple-500" /> Todo lo de Pro</li>
                 <li className="flex items-center gap-2"><Check className="w-4 h-4 text-purple-500" /> IA Avanzada (Análisis)</li>
                 <li className="flex items-center gap-2"><Check className="w-4 h-4 text-purple-500" /> Múltiples Usuarios</li>
                 <li className="flex items-center gap-2"><Check className="w-4 h-4 text-purple-500" /> Soporte Prioritario 24/7</li>
              </ul>
           </div>
           <div className={`w-full py-3 rounded-xl font-bold text-center transition-colors ${selectedPlan === 'Empresa Scale' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {selectedPlan === 'Empresa Scale' ? 'Seleccionado' : 'Elegir Scale'}
           </div>
        </div>

      </div>

      <div className="flex justify-center mt-12">
        <button 
          onClick={finishOnboarding}
          disabled={isRedirecting}
          className="bg-[#1c2938] text-white py-5 px-16 rounded-[2rem] font-bold text-xl hover:bg-[#27bea5] transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 flex items-center gap-3 animate-pulse-slow cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isRedirecting ? (
             <><Loader2 className="w-6 h-6 animate-spin" /> Procesando...</>
          ) : selectedPlan === 'Free' ? (
             <><ShieldCheck className="w-6 h-6" /> Finalizar y Entrar</>
          ) : (
             <><CreditCard className="w-6 h-6" /> Pagar y Activar</>
          )}
        </button>
      </div>
    </div>
  );

  // --- MAIN LAYOUT ---
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#27bea5] rounded-full blur-[120px] opacity-5 -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#1c2938] rounded-full blur-[120px] opacity-5 translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

      {/* Header / Progress */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-6 pt-8 pb-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
           {/* Official Icon */}
           <img 
             src="https://konsul.digital/wp-content/uploads/2025/07/cropped-3.png" 
             alt="Kônsul Icon" 
             className="w-12 h-12 object-contain" 
           />
           <div>
             {/* Official Logo Text */}
             <img 
               src="https://konsul.digital/wp-content/uploads/2025/11/1-min-e1762361628509.avif" 
               alt="Kônsul" 
               className="h-6 object-contain block mb-1"
             />
             <span className="text-xs text-slate-400 font-medium">Asistente de Configuración</span>
           </div>
        </div>
        
        {/* Visual Progress Steps */}
        <div className="hidden md:flex gap-2">
          {[1,2,3,4,5,6,7].map((i) => (
            <div 
              key={i} 
              className={`h-1.5 rounded-full transition-all duration-500 ${
                step >= i ? 'w-8 bg-[#27bea5]' : 'w-4 bg-slate-200'
              }`} 
            />
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col justify-center py-8 relative z-10 px-4">
        <div className="w-full">
          {step === 1 && renderStep1_Fiscal()}
          {step === 2 && renderStep2_Branding()}
          {step === 3 && renderStep3_Finance()}
          {step === 4 && renderStep4_Catalog()}
          {step === 5 && renderStep5_Comms()}
          {step === 6 && renderStep6_Channels()}
          {step === 7 && renderStep7_Plan()}
        </div>
      </div>
      
      {/* Footer / Skip */}
      <div className="text-center pb-8 relative z-10">
         {step > 1 && step < 6 && (
            <button onClick={() => setStep(step + 1 as Step)} className="text-slate-400 hover:text-slate-600 text-sm font-medium">
              Saltar por ahora
            </button>
         )}
      </div>

    </div>
  );
};

export default OnboardingWizard;
