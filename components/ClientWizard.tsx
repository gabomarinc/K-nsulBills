
import React, { useState } from 'react';
import { 
  User, Mail, Phone, MapPin, Hash, Check, ArrowRight, ArrowLeft, 
  Building2, Briefcase, Globe, Sparkles 
} from 'lucide-react';

interface ClientWizardProps {
  onSave: (clientData: { name: string; taxId: string; email: string; address: string; phone: string }) => void;
  onCancel: () => void;
}

type Step = 1 | 2 | 3;

const ClientWizard: React.FC<ClientWizardProps> = ({ onSave, onCancel }) => {
  const [step, setStep] = useState<Step>(1);
  const [formData, setFormData] = useState({
    name: '',
    taxId: '',
    email: '',
    phone: '',
    address: '',
    notes: ''
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (step < 3) setStep(prev => (prev + 1) as Step);
    else onSave(formData);
  };

  const handleBack = () => {
    if (step > 1) setStep(prev => (prev - 1) as Step);
    else onCancel();
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col md:flex-row gap-8 animate-in fade-in slide-in-from-bottom-4">
      
      {/* LEFT: INTERACTIVE FORM */}
      <div className="flex-1 flex flex-col">
        {/* Navigation Header */}
        <div className="flex items-center justify-between mb-8">
           <button onClick={handleBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-[#1c2938]">
              <ArrowLeft className="w-6 h-6" />
           </button>
           <div className="flex gap-2">
              {[1,2,3].map(i => (
                 <div key={i} className={`h-1.5 w-8 rounded-full transition-all duration-500 ${step >= i ? 'bg-[#1c2938]' : 'bg-slate-200'}`}></div>
              ))}
           </div>
        </div>

        <div className="flex-1 flex flex-col justify-center max-w-lg mx-auto w-full">
           
           {/* STEP 1: IDENTITY */}
           {step === 1 && (
             <div className="space-y-8 animate-in slide-in-from-right-8">
                <div>
                   <h2 className="text-4xl font-bold text-[#1c2938] mb-2">Nuevo Aliado</h2>
                   <p className="text-slate-500 text-lg">Empecemos por lo básico. ¿A quién vamos a facturar?</p>
                </div>

                <div className="space-y-6">
                   <div className="group">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Nombre del Cliente / Empresa</label>
                      <div className="relative">
                         <User className="absolute left-4 top-4 w-6 h-6 text-slate-300 group-focus-within:text-[#27bea5] transition-colors" />
                         <input 
                           value={formData.name}
                           onChange={(e) => handleChange('name', e.target.value)}
                           className="w-full pl-14 p-4 text-xl font-bold text-[#1c2938] bg-white border-2 border-slate-100 rounded-2xl focus:border-[#27bea5] focus:ring-0 outline-none transition-all placeholder:text-slate-200 shadow-sm"
                           placeholder="Ej. Tech Solutions Inc."
                           autoFocus
                         />
                      </div>
                   </div>

                   <div className="group">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">RUC / ID Fiscal</label>
                      <div className="relative">
                         <Hash className="absolute left-4 top-4 w-6 h-6 text-slate-300 group-focus-within:text-[#27bea5] transition-colors" />
                         <input 
                           value={formData.taxId}
                           onChange={(e) => handleChange('taxId', e.target.value.toUpperCase())}
                           className="w-full pl-14 p-4 text-lg font-mono font-medium text-slate-600 bg-white border-2 border-slate-100 rounded-2xl focus:border-[#27bea5] focus:ring-0 outline-none transition-all placeholder:text-slate-200 shadow-sm uppercase"
                           placeholder="8-123-456 DV 00"
                         />
                      </div>
                   </div>
                </div>
             </div>
           )}

           {/* STEP 2: CONNECTION */}
           {step === 2 && (
             <div className="space-y-8 animate-in slide-in-from-right-8">
                <div>
                   <h2 className="text-4xl font-bold text-[#1c2938] mb-2">Puntos de Contacto</h2>
                   <p className="text-slate-500 text-lg">¿Dónde enviamos las facturas y propuestas?</p>
                </div>

                <div className="space-y-6">
                   <div className="group">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Correo Electrónico</label>
                      <div className="relative">
                         <Mail className="absolute left-4 top-4 w-6 h-6 text-slate-300 group-focus-within:text-[#27bea5] transition-colors" />
                         <input 
                           type="email"
                           value={formData.email}
                           onChange={(e) => handleChange('email', e.target.value)}
                           className="w-full pl-14 p-4 text-lg font-medium text-[#1c2938] bg-white border-2 border-slate-100 rounded-2xl focus:border-[#27bea5] focus:ring-0 outline-none transition-all placeholder:text-slate-200 shadow-sm"
                           placeholder="facturacion@cliente.com"
                           autoFocus
                         />
                      </div>
                   </div>

                   <div className="group">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Teléfono (Opcional)</label>
                      <div className="relative">
                         <Phone className="absolute left-4 top-4 w-6 h-6 text-slate-300 group-focus-within:text-[#27bea5] transition-colors" />
                         <input 
                           value={formData.phone}
                           onChange={(e) => handleChange('phone', e.target.value)}
                           className="w-full pl-14 p-4 text-lg font-medium text-[#1c2938] bg-white border-2 border-slate-100 rounded-2xl focus:border-[#27bea5] focus:ring-0 outline-none transition-all placeholder:text-slate-200 shadow-sm"
                           placeholder="+507 6000-0000"
                         />
                      </div>
                   </div>
                </div>
             </div>
           )}

           {/* STEP 3: DETAILS */}
           {step === 3 && (
             <div className="space-y-8 animate-in slide-in-from-right-8">
                <div>
                   <h2 className="text-4xl font-bold text-[#1c2938] mb-2">Coordenadas</h2>
                   <p className="text-slate-500 text-lg">Dirección fiscal para que los documentos sean válidos.</p>
                </div>

                <div className="space-y-6">
                   <div className="group">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Dirección Física</label>
                      <div className="relative">
                         <MapPin className="absolute left-4 top-4 w-6 h-6 text-slate-300 group-focus-within:text-[#27bea5] transition-colors" />
                         <textarea 
                           value={formData.address}
                           onChange={(e) => handleChange('address', e.target.value)}
                           className="w-full pl-14 p-4 text-lg font-medium text-[#1c2938] bg-white border-2 border-slate-100 rounded-2xl focus:border-[#27bea5] focus:ring-0 outline-none transition-all placeholder:text-slate-200 shadow-sm resize-none h-32"
                           placeholder="Calle 50, Edificio Global, Piso 12..."
                           autoFocus
                         />
                      </div>
                   </div>
                </div>
             </div>
           )}

           {/* ACTION BUTTON */}
           <div className="mt-10">
              <button 
                onClick={handleNext}
                disabled={!formData.name}
                className="w-full bg-[#1c2938] text-white py-4 rounded-2xl font-bold text-lg hover:bg-[#27bea5] disabled:opacity-50 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-3 group"
              >
                 {step === 3 ? 'Guardar Cliente' : 'Continuar'} 
                 {step === 3 ? <Check className="w-6 h-6" /> : <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />}
              </button>
           </div>

        </div>
      </div>

      {/* RIGHT: LIVE CARD PREVIEW (Reflective Design) */}
      <div className="hidden md:flex flex-1 items-center justify-center bg-slate-50 rounded-[3rem] p-12 relative overflow-hidden">
         {/* Background Elements */}
         <div className="absolute top-0 right-0 w-96 h-96 bg-[#27bea5] rounded-full blur-[100px] opacity-10 translate-x-1/2 -translate-y-1/2"></div>
         <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600 rounded-full blur-[80px] opacity-10 -translate-x-1/2 translate-y-1/2"></div>

         <div className="relative z-10 w-full max-w-sm perspective-1000">
            <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 transform rotate-y-6 rotate-x-6 hover:rotate-0 transition-transform duration-700 ease-out preserve-3d group">
                
                {/* Header / Avatar */}
                <div className="flex justify-between items-start mb-8">
                   <div className={`w-20 h-20 rounded-[1.5rem] flex items-center justify-center text-3xl font-bold shadow-lg transition-all duration-500 ${formData.name ? 'bg-gradient-to-br from-[#1c2938] to-slate-800 text-white' : 'bg-slate-100 text-slate-300'}`}>
                      {formData.name ? getInitials(formData.name) : <Building2 className="w-8 h-8" />}
                   </div>
                   <div className="bg-[#27bea5]/10 p-2 rounded-xl text-[#27bea5]">
                      <Briefcase className="w-6 h-6" />
                   </div>
                </div>

                {/* Name & ID */}
                <div className="mb-8 min-h-[5rem]">
                   <h3 className={`text-2xl font-bold leading-tight mb-2 transition-colors ${formData.name ? 'text-[#1c2938]' : 'text-slate-300'}`}>
                      {formData.name || 'Nombre del Cliente'}
                   </h3>
                   <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">ID</span>
                      <span className={`font-mono text-sm font-medium ${formData.taxId ? 'text-slate-600' : 'text-slate-300'}`}>
                         {formData.taxId || '000-000-000'}
                      </span>
                   </div>
                </div>

                {/* Contact Details */}
                <div className="space-y-4 pt-6 border-t border-slate-50">
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-50 rounded-lg text-slate-400 group-hover:text-[#27bea5] group-hover:bg-[#27bea5]/10 transition-colors">
                         <Mail className="w-4 h-4" />
                      </div>
                      <span className={`text-sm ${formData.email ? 'text-slate-600' : 'text-slate-300 italic'}`}>
                         {formData.email || 'correo@ejemplo.com'}
                      </span>
                   </div>
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-50 rounded-lg text-slate-400 group-hover:text-[#27bea5] group-hover:bg-[#27bea5]/10 transition-colors">
                         <Globe className="w-4 h-4" />
                      </div>
                      <span className={`text-sm ${formData.address ? 'text-slate-600' : 'text-slate-300 italic'}`}>
                         {formData.address ? 'Dirección registrada' : 'Sin dirección'}
                      </span>
                   </div>
                </div>

                {/* Status Badge */}
                <div className="mt-8 flex justify-between items-center">
                   <span className="px-3 py-1 bg-purple-50 text-purple-600 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-purple-100 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Nuevo
                   </span>
                   <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Kônsul CRM</p>
                </div>
            </div>
            
            {/* Reflective Message */}
            <p className="text-center mt-8 text-slate-400 font-medium text-sm animate-pulse">
               {step === 1 && "Construyendo identidad..."}
               {step === 2 && "Estableciendo contacto..."}
               {step === 3 && "Finalizando registro..."}
            </p>
         </div>
      </div>

    </div>
  );
};

export default ClientWizard;
