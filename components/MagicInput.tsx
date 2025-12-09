
import React, { useState } from 'react';
import { Mic, Send, Sparkles, Loader2, Lock } from 'lucide-react';
import { parseInvoiceRequest } from '../services/geminiService';
import { ParsedInvoiceData } from '../types';

interface MagicInputProps {
  onParsed: (data: ParsedInvoiceData) => void;
  apiKeys?: { gemini?: string; openai?: string };
}

const MagicInput: React.FC<MagicInputProps> = ({ onParsed, apiKeys }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Check if user has at least one AI key configured
  const hasAiAccess = !!apiKeys?.gemini || !!apiKeys?.openai;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !hasAiAccess) return;

    setIsLoading(true);
    try {
      const result = await parseInvoiceRequest(input, apiKeys);
      if (result) {
        onParsed(result);
        setInput('');
      }
    } catch (e: any) {
        if (e.message === 'AI_BLOCKED_MISSING_KEYS') {
            alert("Función bloqueada: Configura tus API Keys en Ajustes.");
        }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`p-6 rounded-2xl shadow-lg text-white mb-8 transition-colors ${hasAiAccess ? 'bg-gradient-to-r from-[#27bea5] to-[#1c2938]' : 'bg-slate-800'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
            <Sparkles className={`w-5 h-5 ${hasAiAccess ? 'text-yellow-300' : 'text-slate-500'}`} />
            <h3 className="font-semibold text-lg">Piloto Automático</h3>
        </div>
        {!hasAiAccess && (
            <span className="text-xs bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-1 rounded flex items-center gap-1">
                <Lock className="w-3 h-3" /> IA Bloqueada
            </span>
        )}
      </div>
      
      <p className="text-white/90 text-sm mb-4">
        {hasAiAccess 
          ? 'Escribe o dicta: "Factura a Juan Pérez 500 dólares por consultoría de marketing".'
          : 'Configura tus API Keys en Ajustes para habilitar el asistente inteligente.'
        }
      </p>
      
      <form onSubmit={handleSubmit} className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={hasAiAccess ? "Describe tu factura aquí..." : "⚠️ Función desactivada (Falta API Key)"}
          className={`w-full pl-4 pr-24 py-4 rounded-xl text-[#1c2938] focus:outline-none shadow-inner ${
              hasAiAccess ? 'bg-white focus:ring-4 focus:ring-[#27bea5]/50' : 'bg-slate-200 cursor-not-allowed text-slate-500'
          }`}
          disabled={isLoading || !hasAiAccess}
        />
        <div className="absolute right-2 top-2 flex gap-1">
          {hasAiAccess && (
            <button
                type="button"
                className="p-2 text-slate-400 hover:text-[#27bea5] hover:bg-slate-100 rounded-lg transition-colors"
                title="Dictar (Simulado)"
            >
                <Mic className="w-5 h-5" />
            </button>
          )}
          <button
            type="submit"
            disabled={isLoading || !input || !hasAiAccess}
            className={`p-2 rounded-lg text-white transition-colors flex items-center justify-center w-10 ${
                hasAiAccess ? 'bg-[#27bea5] hover:bg-[#22a890]' : 'bg-slate-400 cursor-not-allowed'
            }`}
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MagicInput;
