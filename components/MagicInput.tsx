
import React, { useState } from 'react';
import { Mic, Send, Sparkles, Loader2 } from 'lucide-react';
import { parseInvoiceRequest } from '../services/geminiService';
import { ParsedInvoiceData } from '../types';

interface MagicInputProps {
  onParsed: (data: ParsedInvoiceData) => void;
  apiKeys?: { gemini?: string; openai?: string };
}

const MagicInput: React.FC<MagicInputProps> = ({ onParsed, apiKeys }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setIsLoading(true);
    try {
      // Pass apiKeys to service
      const result = await parseInvoiceRequest(input, apiKeys);
      if (result) {
        onParsed(result);
        setInput(''); // Clear on success
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-[#27bea5] to-[#1c2938] p-6 rounded-2xl shadow-lg text-white mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-yellow-300" />
        <h3 className="font-semibold text-lg">Piloto Automático</h3>
      </div>
      <p className="text-white/90 text-sm mb-4">
        Escribe o dicta: "Factura a Juan Pérez 500 dólares por consultoría de marketing".
      </p>
      
      <form onSubmit={handleSubmit} className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe tu factura aquí..."
          className="w-full pl-4 pr-24 py-4 rounded-xl text-[#1c2938] focus:outline-none focus:ring-4 focus:ring-[#27bea5]/50 shadow-inner"
          disabled={isLoading}
        />
        <div className="absolute right-2 top-2 flex gap-1">
          <button
            type="button"
            className="p-2 text-slate-400 hover:text-[#27bea5] hover:bg-slate-100 rounded-lg transition-colors"
            title="Dictar (Simulado)"
          >
            <Mic className="w-5 h-5" />
          </button>
          <button
            type="submit"
            disabled={isLoading || !input}
            className="p-2 bg-[#27bea5] text-white rounded-lg hover:bg-[#22a890] disabled:opacity-50 transition-colors flex items-center justify-center w-10"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MagicInput;
