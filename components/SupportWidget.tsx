
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, AlertTriangle, UserCheck, Send, Loader2, Sparkles } from 'lucide-react';
import { askSupportBot } from '../services/geminiService';

interface SupportWidgetProps {
  apiKeys?: {
    gemini?: string;
    openai?: string;
  };
}

const SupportWidget: React.FC<SupportWidgetProps> = ({ apiKeys }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'BOT' | 'HUMAN'>('BOT');
  const [messages, setMessages] = useState<{ sender: 'user' | 'bot' | 'system', text: string }[]>([
    { sender: 'bot', text: 'Hola, soy ZenBot 🤖. ¿En qué puedo ayudarte hoy?' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    
    const userMsg = inputText;
    setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setInputText('');
    
    if (mode === 'HUMAN') {
      // Simulate human response delay
      setIsTyping(true);
      setTimeout(() => {
        setMessages(prev => [...prev, { sender: 'bot', text: 'Un agente humano (Carlos) está revisando tu caso prioritario...' }]);
        setIsTyping(false);
      }, 1500);
      return;
    }

    setIsTyping(true);
    // Use the hybrid AI service (Gemini primary -> OpenAI fallback)
    const botResponse = await askSupportBot(userMsg, apiKeys);
    setMessages(prev => [...prev, { sender: 'bot', text: botResponse }]);
    setIsTyping(false);
  };

  const activatePanicMode = () => {
    setMode('HUMAN');
    setMessages(prev => [
      ...prev, 
      { sender: 'system', text: '🚨 MODO DE EMERGENCIA ACTIVADO' },
      { sender: 'bot', text: 'Te hemos saltado la cola de espera. Un ingeniero de soporte fiscal está leyendo esto ahora mismo. Describe tu error crítico.' }
    ]);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">
      {/* Chat Window */}
      {isOpen && (
        <div className="bg-white w-80 md:w-96 h-[500px] rounded-2xl shadow-2xl flex flex-col pointer-events-auto border border-slate-200 overflow-hidden mb-4 transition-all animate-in slide-in-from-bottom-5">
          {/* Header */}
          <div className={`p-4 flex justify-between items-center ${mode === 'HUMAN' ? 'bg-red-600' : 'bg-[#1c2938]'} text-white`}>
            <div className="flex items-center gap-2">
              {mode === 'HUMAN' ? <UserCheck className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
              <div>
                <span className="font-semibold block leading-none">{mode === 'HUMAN' ? 'Soporte Humano VIP' : 'Ayuda FacturaZen'}</span>
                {mode === 'BOT' && (
                  <span className="text-[10px] text-slate-300 opacity-80 flex items-center gap-1">
                     <Sparkles className="w-3 h-3" /> IA Híbrida Activa
                  </span>
                )}
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                  msg.sender === 'user' 
                    ? 'bg-[#27bea5] text-white rounded-tr-none' 
                    : msg.sender === 'system'
                    ? 'bg-red-100 text-red-800 border border-red-200 text-center w-full'
                    : 'bg-white text-slate-800 border border-slate-200 shadow-sm rounded-tl-none'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl px-4 py-2 rounded-tl-none">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Panic Button Area (Only in Bot Mode) */}
          {mode === 'BOT' && (
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
              <button 
                onClick={activatePanicMode}
                className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 py-2 rounded-lg border border-red-200 transition-colors"
              >
                <AlertTriangle className="w-3 h-3" />
                Hablar con un Humano (Error Crítico)
              </button>
            </div>
          )}

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-slate-200">
            <div className="flex gap-2">
              <input
                className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-[#27bea5] outline-none"
                placeholder="Escribe tu consulta..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              />
              <button 
                onClick={handleSend}
                disabled={!inputText.trim()}
                className="p-2 bg-[#27bea5] text-white rounded-xl hover:bg-[#22a890] disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="pointer-events-auto bg-[#27bea5] hover:bg-[#22a890] text-white rounded-full p-4 shadow-xl hover:scale-110 transition-transform duration-200 flex items-center justify-center"
        >
          <MessageSquare className="w-6 h-6" />
          <span className="absolute right-0 top-0 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
        </button>
      )}
    </div>
  );
};

export default SupportWidget;
