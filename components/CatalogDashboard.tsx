
import React, { useState } from 'react';
import { 
  Plus, Search, Edit2, Trash2, Tag, 
  Sparkles, Loader2, ArrowRight, TrendingUp, X,
  ShoppingBag, MoreVertical, Wand2, Info,
  AlignLeft, List, CalendarClock, Package, Check, Calculator, AlertCircle
} from 'lucide-react';
import { CatalogItem, PriceAnalysisResult } from '../types';
import { analyzePriceMarket, enhanceProductDescription } from '../services/geminiService';

interface CatalogDashboardProps {
  items: CatalogItem[];
  userCountry: string;
  apiKey?: { gemini?: string; openai?: string }; // Updated type
  onUpdate: (items: CatalogItem[]) => void;
  referenceHourlyRate?: number; // New: Benchmark from ExpenseTracker
}

const CatalogDashboard: React.FC<CatalogDashboardProps> = ({ items, userCountry, apiKey, onUpdate, referenceHourlyRate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<Partial<CatalogItem>>({ name: '', price: 0, description: '', isRecurring: false });
  const [descFormat, setDescFormat] = useState<'paragraph' | 'bullets'>('paragraph');
  
  // AI Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<PriceAnalysisResult | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false); 

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (item: CatalogItem) => {
    setEditingItem(item);
    setFormData(item);
    setAnalysis(null);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingItem(null);
    setFormData({ name: '', price: 0, description: '', isRecurring: false });
    setAnalysis(null);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('¿Estás seguro de eliminar este ítem?')) {
      const newItems = items.filter(i => i.id !== id);
      onUpdate(newItems);
    }
  };

  const handleSave = () => {
    if (!formData.name || formData.price === undefined) return;

    if (editingItem) {
      // Update
      const updatedItems = items.map(i => 
        i.id === editingItem.id ? { ...i, ...formData } as CatalogItem : i
      );
      onUpdate(updatedItems);
    } else {
      // Create
      const newItem: CatalogItem = {
        id: Date.now().toString(),
        name: formData.name,
        price: formData.price,
        description: formData.description || '',
        isRecurring: formData.isRecurring
      };
      onUpdate([...items, newItem]);
    }
    setIsModalOpen(false);
  };

  const handleAnalyzePrice = async () => {
    if (!formData.name) return;
    setIsAnalyzing(true);
    setAnalysis(null);
    
    // Pass full apiKey object
    const result = await analyzePriceMarket(formData.name, userCountry || 'Global', apiKey);
    setAnalysis(result);
    setIsAnalyzing(false);
  };

  const handleEnhanceDescription = async () => {
    if (!formData.name || !formData.description) return;
    setIsEnhancing(true);
    // Pass full apiKey object
    const improvedText = await enhanceProductDescription(formData.description, formData.name, descFormat, apiKey);
    setFormData(prev => ({ ...prev, description: improvedText }));
    setIsEnhancing(false);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in pb-12">
      
      {/* HEADER: Visceral - Clean & Welcoming */}
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-6 border-b border-slate-100 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1c2938] tracking-tight">Tu Portafolio de Valor</h1>
          <p className="text-slate-500 mt-1 text-lg font-light">Define y organiza lo que ofreces al mundo.</p>
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
           {/* Reference Benchmark Badge */}
           {referenceHourlyRate && referenceHourlyRate > 0 && (
             <div className="hidden md:flex items-center gap-2 bg-blue-50 border border-blue-100 px-4 py-2 rounded-xl text-blue-700" title="Basado en tu calculadora de gastos">
               <Calculator className="w-4 h-4" />
               <div className="text-xs">
                 <span className="block font-bold uppercase tracking-wider opacity-70">Costo Base</span>
                 <span className="font-bold text-sm">${referenceHourlyRate.toFixed(0)}/hr</span>
               </div>
             </div>
           )}

           {/* Search Bar - Floating Pill */}
           <div className="flex-1 md:w-64 bg-white p-1.5 pl-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 focus-within:ring-2 focus-within:ring-[#27bea5] transition-all">
             <Search className="w-5 h-5 text-slate-400" />
             <input 
               type="text" 
               placeholder="Buscar..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="flex-1 outline-none text-slate-700 font-medium bg-transparent"
             />
           </div>

           <button 
             onClick={handleAddNew}
             className="bg-[#1c2938] text-white px-6 py-3.5 rounded-2xl font-bold hover:bg-[#27bea5] transition-all flex items-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 group"
           >
             <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
             <span className="hidden md:inline">Nuevo Ítem</span>
           </button>
        </div>
      </div>

      {/* GRID LAYOUT */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredItems.map(item => (
           <div key={item.id} className="bg-white p-8 rounded-[2rem] shadow-sm hover:shadow-xl border border-slate-50 hover:border-[#27bea5]/30 transition-all duration-300 group relative flex flex-col hover:-translate-y-1">
              
              {/* Top Row */}
              <div className="flex justify-between items-start mb-6">
                 <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${item.isRecurring ? 'bg-purple-50 text-purple-500' : 'bg-slate-50 text-[#27bea5]'}`}>
                    {item.isRecurring ? <CalendarClock className="w-7 h-7" /> : <Tag className="w-7 h-7" />}
                 </div>
                 
                 {/* Quick Actions (Appear on Hover) */}
                 <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0 duration-300">
                    <button onClick={() => handleEdit(item)} className="p-2.5 text-slate-400 hover:text-[#1c2938] hover:bg-slate-50 rounded-xl transition-colors" title="Editar">
                       <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors" title="Eliminar">
                       <Trash2 className="w-4 h-4" />
                    </button>
                 </div>
              </div>
              
              {/* Content */}
              <div className="flex-1">
                <h3 className="text-xl font-bold text-[#1c2938] mb-2 leading-tight">{item.name}</h3>
                <p className="text-sm text-slate-500 line-clamp-3 leading-relaxed font-light min-h-[60px]">
                  {item.description || 'Sin descripción detallada. Agrega una para potenciar tus ventas.'}
                </p>
              </div>
              
              {/* Footer Price */}
              <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg">
                   {item.isRecurring ? 'Suscripción' : 'Pago Único'}
                 </span>
                 <span className="text-2xl font-bold text-[#1c2938] tracking-tight">
                    ${item.price.toLocaleString()}
                    {item.isRecurring && <span className="text-sm text-slate-400 font-medium">/mes</span>}
                 </span>
              </div>
           </div>
        ))}

        {/* Empty State - Reflective: Encouraging */}
        {filteredItems.length === 0 && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-[3rem] bg-slate-50/50 flex flex-col items-center justify-center">
             <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm">
               <Package className="w-10 h-10 text-slate-300" />
             </div>
             <h3 className="text-xl font-bold text-[#1c2938] mb-2">Tu portafolio está vacío</h3>
             <p className="text-slate-500 max-w-md mx-auto mb-8">
               El primer paso para vender es definir qué ofreces. Agrega tu primer producto o servicio profesional.
             </p>
             <button onClick={handleAddNew} className="text-[#27bea5] font-bold hover:underline hover:text-[#1c2938] transition-colors flex items-center gap-2">
               Comenzar ahora <ArrowRight className="w-4 h-4" />
             </button>
          </div>
        )}
      </div>

      {/* MODAL - Visceral: Clean Studio Feel */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1c2938]/40 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
              
              {/* Modal Header */}
              <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-white flex-shrink-0">
                 <div>
                   <h3 className="font-bold text-[#1c2938] text-2xl tracking-tight">
                     {editingItem ? 'Editar Ítem' : 'Crear Nuevo'}
                   </h3>
                   <p className="text-slate-400 text-sm">Define los detalles de tu oferta</p>
                 </div>
                 <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-slate-100 rounded-full text-slate-400 hover:text-[#1c2938] transition-colors">
                   <X className="w-6 h-6" />
                 </button>
              </div>

              {/* Modal Body */}
              <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar">
                 
                 {/* NAME INPUT */}
                 <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Nombre del Producto/Servicio</label>
                    <input 
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="Ej: Diseño Web Corporativo, Consultoría Legal..."
                      className="w-full p-4 text-lg bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-[#27bea5] focus:bg-white focus:border-transparent outline-none transition-all placeholder:text-slate-300 font-medium text-[#1c2938]"
                      autoFocus
                    />
                 </div>

                 {/* PRICE SECTION */}
                 <div className="space-y-3">
                    <div className="flex justify-between items-center ml-1">
                       <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estrategia de Precio</label>
                       {referenceHourlyRate && referenceHourlyRate > 0 && (
                          <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                             <Calculator className="w-3 h-3" /> Costo Base: ${referenceHourlyRate.toFixed(0)}/hr
                          </span>
                       )}
                    </div>
                    
                    <div className="flex flex-col gap-4">
                       <div className="flex gap-4 items-stretch">
                         <div className="relative flex-1 group">
                            <span className="absolute left-4 top-4 text-slate-400 font-medium">$</span>
                            <input 
                              type="number"
                              value={formData.price}
                              onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value)})}
                              className={`w-full pl-8 p-4 bg-slate-50 border rounded-2xl focus:ring-2 focus:bg-white outline-none text-xl font-bold text-[#1c2938] h-full ${
                                 referenceHourlyRate && (formData.price || 0) < referenceHourlyRate 
                                 ? 'border-amber-200 focus:ring-amber-400 bg-amber-50/50' 
                                 : 'border-slate-100 focus:ring-[#27bea5]'
                              }`}
                            />
                         </div>
                         
                         {/* AI PRICE BUTTON (Integrated & Friendly) */}
                         <button 
                           onClick={handleAnalyzePrice}
                           disabled={!formData.name || isAnalyzing}
                           className="bg-[#1c2938] text-white px-5 py-3 rounded-2xl hover:bg-slate-800 disabled:opacity-50 transition-all flex flex-col items-center justify-center gap-1 group shadow-lg min-w-[120px]"
                           title="Consultar al mercado"
                         >
                           {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <TrendingUp className="w-5 h-5 text-[#27bea5]" />}
                           <span className="text-xs font-bold opacity-80">Analizar Precio</span>
                         </button>
                       </div>

                       {/* PROFITABILITY WARNING */}
                       {referenceHourlyRate && (formData.price || 0) > 0 && (formData.price || 0) < referenceHourlyRate && (
                          <div className="flex items-start gap-3 p-3 bg-amber-50 text-amber-700 rounded-xl border border-amber-100 animate-in slide-in-from-top-2">
                             <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                             <div className="text-sm">
                                <p className="font-bold">¡Atención! Este precio es bajo.</p>
                                <p className="opacity-90">Estás cobrando menos de tu costo hora calculado (${referenceHourlyRate.toFixed(0)}).</p>
                             </div>
                          </div>
                       )}

                       {/* RECURRING TOGGLE */}
                       <label className={`flex items-center gap-4 p-4 border rounded-2xl cursor-pointer transition-all ${formData.isRecurring ? 'border-[#27bea5] bg-[#27bea5]/5' : 'border-slate-100 hover:border-slate-200'}`}>
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${formData.isRecurring ? 'bg-[#27bea5] text-white' : 'bg-slate-100 text-slate-400'}`}>
                             <CalendarClock className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                             <p className={`font-bold ${formData.isRecurring ? 'text-[#1c2938]' : 'text-slate-600'}`}>Venta Recurrente</p>
                             <p className="text-xs text-slate-400">Cobro mensual (Suscripción/Iguala)</p>
                          </div>
                          <div className="relative">
                             <input 
                               type="checkbox"
                               checked={formData.isRecurring || false}
                               onChange={(e) => setFormData({...formData, isRecurring: e.target.checked})}
                               className="peer sr-only"
                             />
                             <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#27bea5]"></div>
                          </div>
                       </label>
                    </div>
                 </div>

                 {/* AI ANALYSIS RESULT (Card Style) */}
                 {analysis && (
                    <div className="relative overflow-hidden bg-gradient-to-br from-[#1c2938] to-slate-800 rounded-2xl p-6 text-white shadow-xl animate-in slide-in-from-top-4">
                       <div className="absolute top-0 right-0 w-32 h-32 bg-[#27bea5] rounded-full blur-[60px] opacity-20 -translate-y-1/2 translate-x-1/2"></div>
                       
                       <div className="relative z-10">
                          <div className="flex items-start gap-3 mb-4">
                             <div className="p-2 bg-white/10 rounded-lg text-[#27bea5]">
                               <Sparkles className="w-5 h-5" />
                             </div>
                             <div>
                                <p className="text-xs font-bold uppercase text-[#27bea5] tracking-widest mb-1">Inteligencia de Mercado</p>
                                <p className="text-sm text-slate-200 leading-relaxed max-w-md">{analysis.reasoning}</p>
                             </div>
                          </div>

                          <div className="flex items-center gap-3">
                             <div className="flex-1 bg-white/5 p-3 rounded-xl text-center border border-white/10">
                                <span className="block text-[10px] text-slate-400 uppercase font-bold">Mínimo</span>
                                <span className="font-bold text-lg text-white">${analysis.minPrice}</span>
                             </div>
                             <div className="flex-1 bg-[#27bea5]/20 p-3 rounded-xl text-center border border-[#27bea5]/50 ring-1 ring-[#27bea5]/30">
                                <span className="block text-[10px] text-[#27bea5] uppercase font-bold">Recomendado</span>
                                <span className="font-bold text-2xl text-white">${analysis.avgPrice}</span>
                             </div>
                             <div className="flex-1 bg-white/5 p-3 rounded-xl text-center border border-white/10">
                                <span className="block text-[10px] text-slate-400 uppercase font-bold">Máximo</span>
                                <span className="font-bold text-lg text-white">${analysis.maxPrice}</span>
                             </div>
                          </div>
                          
                          <button 
                            onClick={() => setFormData({...formData, price: analysis.avgPrice})}
                            className="w-full mt-4 py-2 text-xs font-bold text-[#27bea5] hover:text-white hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center gap-2"
                          >
                            <Check className="w-4 h-4" /> Aplicar Precio Recomendado
                          </button>
                       </div>
                    </div>
                 )}

                 {/* DESCRIPTION SECTION */}
                 <div className="space-y-3 pt-2">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Descripción de Venta</label>
                        <div className="group relative z-50">
                          <Info className="w-4 h-4 text-slate-300 cursor-help hover:text-[#27bea5] transition-colors" />
                          <div className="absolute bottom-full left-0 mb-2 w-64 p-4 bg-[#1c2938] text-white text-xs rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 leading-relaxed">
                             <p className="font-bold mb-1 text-[#27bea5]">💡 Tip de Copywriting</p>
                             Escribe características técnicas clave (ej. "RAM 16GB, SSD 512GB") y la IA redactará un texto persuasivo por ti.
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Format Toggle */}
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                           <button 
                             onClick={() => setDescFormat('paragraph')}
                             className={`p-2 rounded-lg transition-all ${descFormat === 'paragraph' ? 'bg-white text-[#1c2938] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                             title="Párrafo"
                           >
                             <AlignLeft className="w-4 h-4" />
                           </button>
                           <button 
                             onClick={() => setDescFormat('bullets')}
                             className={`p-2 rounded-lg transition-all ${descFormat === 'bullets' ? 'bg-white text-[#1c2938] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                             title="Lista"
                           >
                             <List className="w-4 h-4" />
                           </button>
                        </div>

                        {/* ENHANCE BUTTON */}
                        <button 
                          onClick={handleEnhanceDescription}
                          disabled={!formData.description || !formData.name || isEnhancing}
                          className="bg-[#27bea5] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#22a890] flex items-center gap-2 disabled:opacity-50 shadow-md shadow-teal-100 transition-all hover:-translate-y-0.5 active:translate-y-0"
                        >
                           {isEnhancing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                           Mejorar con IA
                        </button>
                      </div>
                    </div>
                    
                    <textarea 
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      placeholder="Ej: Mantenimiento preventivo, limpieza de filtros y carga de gas..."
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-[#27bea5] focus:bg-white outline-none h-40 resize-none transition-all placeholder:text-slate-300 text-slate-700 leading-relaxed"
                    />
                 </div>
              </div>

              {/* Footer */}
              <div className="p-6 bg-white border-t border-slate-50 flex gap-4 flex-shrink-0">
                 <button 
                   onClick={() => setIsModalOpen(false)}
                   className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-colors"
                 >
                   Cancelar
                 </button>
                 <button 
                   onClick={handleSave}
                   className="flex-1 bg-[#1c2938] text-white py-4 rounded-2xl font-bold hover:bg-[#27bea5] shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 transition-all duration-300"
                 >
                   Guardar Producto
                 </button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default CatalogDashboard;
