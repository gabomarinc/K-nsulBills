import React, { useEffect, useRef } from 'react';
import {
  ArrowRight, ShieldCheck, Sparkles, UserPlus
} from 'lucide-react';
import { useKindeAuth } from '@kinde-oss/kinde-auth-react';

const LoginScreen: React.FC = () => {
  const { login, register, isLoading, isAuthenticated } = useKindeAuth();
  const hasAttemptedSilentLogin = useRef(false);

  useEffect(() => {
    // Check if we just returned from a failed silent login
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'login_required' || params.get('error') === 'interaction_required' || params.has('error')) {
      return;
    }

    // Attempt silent SSO across subdomains
    if (!isLoading && !isAuthenticated && !hasAttemptedSilentLogin.current) {
      hasAttemptedSilentLogin.current = true;
      login({ prompt: "none" } as any).catch(console.error);
    }
  }, [isLoading, isAuthenticated, login]);

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
            src="https://konsul.digital/images/Konsul%20logo%20general.png"
            alt="Kônsul Icon"
            className="w-20 h-20 object-contain mb-8 rounded-2xl bg-white/5 p-2 backdrop-blur-sm"
          />
          <h1 className="text-5xl font-bold tracking-tight leading-tight mb-6">
            Tu negocio, <br />
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
            <ShieldCheck className="w-4 h-4" /> Secure SSO & SSL Encryption
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: BEHAVIORAL / FORM */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative">
        <div className="w-full max-w-md space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="text-center lg:text-left">
            {/* Official Icon (Mobile) */}
            <img
              src="https://konsul.digital/images/Konsul%20logo%20general.png"
              alt="Kônsul"
              className="lg:hidden w-16 h-16 object-contain mx-auto mb-6"
            />
            <h2 className="text-3xl font-bold text-[#1c2938]">Bienvenido</h2>
            <p className="text-slate-500 mt-2">Ingresa a tu ecosistema Kônsul para continuar.</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => login()}
              disabled={isLoading}
              className="w-full bg-[#1c2938] text-white p-4 rounded-2xl font-bold text-lg hover:bg-[#27bea5] transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 disabled:opacity-70 disabled:transform-none flex items-center justify-center gap-2 group"
            >
              Iniciar Sesión Seguro
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            
            <button
              onClick={() => register()}
              disabled={isLoading}
              className="w-full bg-white text-[#1c2938] border-2 border-[#1c2938] p-4 rounded-2xl font-bold text-lg hover:bg-slate-50 transition-all flex items-center justify-center gap-2 group disabled:opacity-70"
            >
              <UserPlus className="w-5 h-5" />
              Crear cuenta gratis
            </button>
          </div>

          <div className="text-center pt-4">
            <p className="text-slate-400 text-xs mt-6 flex items-center justify-center gap-1">
              <ShieldCheck className="w-4 h-4" /> Autenticación protegida por Kinde SSO
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;

