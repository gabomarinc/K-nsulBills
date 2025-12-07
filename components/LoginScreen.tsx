
import React, { useState } from 'react';
import { 
  Mail, Lock, Eye, EyeOff, ArrowRight, 
  Loader2, ShieldCheck, Sparkles, AlertCircle 
} from 'lucide-react';
import { authenticateUser } from '../services/neon';
import { UserProfile } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
  onRegisterClick: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, onRegisterClick }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    setError(null);

    try {
      // Attempt login via Neon DB
      const user = await authenticateUser(email, password);
      
      if (user) {
        onLoginSuccess(user);
      } else {
        setError('Credenciales incorrectas. Intenta con: juan@facturazen.com / password123');
      }
    } catch (err) {
      setError('Error de conexión. Verifica tu internet.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      
      {/* LEFT SIDE: VISCERAL / BRANDING */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#1c2938] relative overflow-hidden flex-col justify-between p-16 text-white">
        {/* Abstract Background */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#27bea5] rounded-full blur-[150px] opacity-10 -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-600 rounded-full blur-[150px] opacity-10 translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
        
        <div className="relative z-10">
          {/* Official Icon (Desktop Large) */}
          <img 
            src="https://konsul.digital/wp-content/uploads/2025/07/cropped-3.png" 
            alt="Kônsul Icon" 
            className="w-20 h-20 object-contain mb-8 rounded-2xl bg-white/5 p-2 backdrop-blur-sm"
          />
          <h1 className="text-5xl font-bold tracking-tight leading-tight mb-6">
            Tu negocio, <br/>
            <span className="text-[#27bea5]">en piloto automático.</span>
          </h1>
          <p className="text-xl text-slate-300 font-light max-w-md leading-relaxed">
            Gestión inteligente, facturación sin fricción y análisis financiero en tiempo real. Bienvenido al futuro de tu trabajo.
          </p>
        </div>

        <div className="relative z-10 space-y-6">
           <div className="flex items-center gap-4 bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 max-w-sm">
              <div className="p-3 bg-[#27bea5]/20 rounded-xl text-[#27bea5]">
                 <Sparkles className="w-6 h-6" />
              </div>
              <div>
                 <p className="font-bold text-white">Potenciado por IA</p>
                 <p className="text-xs text-slate-400">Gemini & OpenAI integrados</p>
              </div>
           </div>
           
           <div className="flex items-center gap-2 text-xs text-slate-500 font-medium uppercase tracking-widest">
              <ShieldCheck className="w-4 h-4" /> Secure SSL Encryption
           </div>
        </div>
      </div>

      {/* RIGHT SIDE: BEHAVIORAL / FORM */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative">
        <div className="w-full max-w-md space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
           
           <div className="text-center lg:text-left">
              {/* Official Icon (Mobile) */}
              <img 
                src="https://konsul.digital/wp-content/uploads/2025/07/cropped-3.png" 
                alt="Kônsul" 
                className="lg:hidden w-16 h-16 object-contain mx-auto mb-6" 
              />
              <h2 className="text-3xl font-bold text-[#1c2938]">Bienvenido de nuevo</h2>
              <p className="text-slate-500 mt-2">Ingresa a tu cuenta para continuar.</p>
           </div>

           <form onSubmit={handleLogin} className="space-y-6">
              
              <div className="space-y-2">
                 <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Correo Electrónico</label>
                 <div className="relative group">
                    <Mail className="absolute left-4 top-4 w-5 h-5 text-slate-300 group-focus-within:text-[#27bea5] transition-colors" />
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nombre@empresa.com"
                      className="w-full pl-12 p-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#27bea5] focus:border-transparent outline-none transition-all font-medium text-[#1c2938] shadow-sm"
                      required
                    />
                 </div>
              </div>

              <div className="space-y-2">
                 <div className="flex justify-between items-center ml-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Contraseña</label>
                    <button type="button" className="text-xs font-bold text-[#27bea5] hover:underline" tabIndex={-1}>
                       ¿Olvidaste tu contraseña?
                    </button>
                 </div>
                 <div className="relative group">
                    <Lock className="absolute left-4 top-4 w-5 h-5 text-slate-300 group-focus-within:text-[#27bea5] transition-colors" />
                    <input 
                      type={showPassword ? "text" : "password"} 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-12 pr-12 p-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#27bea5] focus:border-transparent outline-none transition-all font-medium text-[#1c2938] shadow-sm"
                      required
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-4 text-slate-300 hover:text-slate-500 transition-colors"
                      tabIndex={-1}
                    >
                       {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                 </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm flex items-center gap-3 animate-pulse">
                   <AlertCircle className="w-5 h-5 flex-shrink-0" />
                   {error}
                </div>
              )}

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#1c2938] text-white p-4 rounded-2xl font-bold text-lg hover:bg-[#27bea5] transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 disabled:opacity-70 disabled:transform-none flex items-center justify-center gap-2 group"
              >
                 {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Iniciar Sesión'}
                 {!isLoading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
              </button>

           </form>

           <div className="text-center pt-4">
              <p className="text-slate-500">
                 ¿No tienes cuenta? {' '}
                 <button onClick={onRegisterClick} className="font-bold text-[#1c2938] hover:text-[#27bea5] transition-colors">
                    Crear cuenta gratis
                 </button>
              </p>
           </div>
           
           {/* Mock Credentials Hint for Demo */}
           <div className="mt-8 p-4 bg-slate-100 rounded-xl border border-slate-200 text-xs text-slate-500 text-center">
              <p className="font-bold mb-1 uppercase tracking-wider">Credenciales Demo:</p>
              <p>juan@facturazen.com / password123</p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
