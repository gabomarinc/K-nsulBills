import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, WifiOff, CheckCircle2, Sparkles } from 'lucide-react';
import { Invoice, InvoiceItem, ParsedInvoiceData } from '../types';
import MagicInput from './MagicInput';

interface InvoiceBuilderProps {
  isOffline: boolean;
  onSave: (invoice: Invoice) => void;
}

const InvoiceBuilder: React.FC<InvoiceBuilderProps> = ({ isOffline, onSave }) => {
  const [clientName, setClientName] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: '1', description: '', quantity: 1, price: 0, tax: 21 }
  ]);
  const [currency, setCurrency] = useState('USD');
  const [type, setType] = useState<'Invoice' | 'Quote' | 'Expense'>('Invoice');
  const [notification, setNotification] = useState<string | null>(null);

  // Smart Template Simulation: If client name matches "Juan", autofill
  useEffect(() => {
    if (clientName.toLowerCase().includes('juan')) {
      // Simulate "learning" from previous invoices
      if (items[0].description === '') {
        setItems([{ 
          id: Date.now().toString(), 
          description: 'Consultoría Mensual (Autocompletado)', 
          quantity: 1, 
          price: 500, 
          tax: 21 
        }]);
      }
    }
  }, [clientName]);

  const handleMagicParsed = (data: ParsedInvoiceData) => {
    setClientName(data.clientName);
    setCurrency(data.currency);
    setType(data.detectedType);
    setItems([{
      id: Date.now().toString(),
      description: data.concept,
      quantity: 1,
      price: data.amount,
      tax: 21 // Default tax
    }]);
    setNotification("✨ Datos autocompletados con IA");
    setTimeout(() => setNotification(null), 3000);
  };

  const addItem = () => {
    setItems([...items, { id: Date.now().toString(), description: '', quantity: 1, price: 0, tax: 21 }]);
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return items.reduce((acc, item) => acc + (item.quantity * item.price * (1 + item.tax / 100)), 0);
  };

  const handleSave = () => {
    const newInvoice: Invoice = {
      id: Math.random().toString(36).substr(2, 9),
      clientName,
      date: new Date().toISOString(),
      items,
      total: calculateTotal(),
      status: isOffline ? 'PendingSync' : 'Sent',
      currency,
      type
    };
    onSave(newInvoice);
    
    // Reset form
    setClientName('');
    setItems([{ id: Date.now().toString(), description: '', quantity: 1, price: 0, tax: 21 }]);
    setType('Invoice');
    setNotification(isOffline ? "Guardado en cola segura (Offline)" : "Factura emitida correctamente");
    setTimeout(() => setNotification(null), 4000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <MagicInput onParsed={handleMagicParsed} />

      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-top-2 ${notification.includes('Offline') ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-green-100 text-green-800 border border-green-200'}`}>
          {notification.includes('Offline') ? <WifiOff className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {notification}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
        <h2 className="text-xl font-bold text-[#1c2938] mb-6">Nueva Factura</h2>
        
        {/* Header Data */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Buscar o crear cliente..."
              className="w-full rounded-lg border-slate-300 border px-3 py-2 focus:ring-2 focus:ring-[#27bea5] focus:border-[#27bea5]"
            />
            {clientName.toLowerCase().includes('juan') && (
              <p className="text-xs text-[#27bea5] mt-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Preferencias de Juan Pérez cargadas
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
            <select 
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full rounded-lg border-slate-300 border px-3 py-2 focus:ring-[#27bea5]"
            >
              <option value="Invoice">Factura</option>
              <option value="Quote">Cotización</option>
              <option value="Expense">Gasto</option>
            </select>
          </div>
          <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">Moneda</label>
             <select 
               value={currency}
               onChange={(e) => setCurrency(e.target.value)}
               className="w-full rounded-lg border-slate-300 border px-3 py-2 focus:ring-[#27bea5]"
             >
               <option value="USD">USD - Dólar Americano</option>
               <option value="EUR">EUR - Euro</option>
               <option value="MXN">MXN - Peso Mexicano</option>
               <option value="ARS">ARS - Peso Argentino</option>
             </select>
          </div>
        </div>

        {/* Items Table */}
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3 rounded-l-lg">Descripción</th>
                <th className="px-4 py-3 w-24">Cant.</th>
                <th className="px-4 py-3 w-32">Precio</th>
                <th className="px-4 py-3 w-24">IVA %</th>
                <th className="px-4 py-3 w-32 text-right">Total</th>
                <th className="px-4 py-3 w-10 rounded-r-lg"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(index, 'description', e.target.value)}
                      placeholder="Servicio o producto..."
                      className="w-full bg-transparent border-none focus:ring-0 p-0 placeholder-slate-400"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value))}
                      className="w-full bg-transparent border-none focus:ring-0 p-0"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={item.price}
                      onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value))}
                      className="w-full bg-transparent border-none focus:ring-0 p-0"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={item.tax}
                      onChange={(e) => updateItem(index, 'tax', parseFloat(e.target.value))}
                      className="w-full bg-transparent border-none focus:ring-0 p-0 text-slate-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {(item.quantity * item.price * (1 + item.tax / 100)).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => removeItem(index)} className="text-slate-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button onClick={addItem} className="text-sm text-[#27bea5] font-medium flex items-center gap-1 hover:text-[#22a890] mb-8">
          <Plus className="w-4 h-4" /> Agregar línea
        </button>

        {/* Footer Actions */}
        <div className="flex flex-col md:flex-row justify-between items-center pt-6 border-t border-slate-100 gap-4">
          <div className="text-slate-500 text-sm">
            {isOffline && (
              <span className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                <WifiOff className="w-3 h-3" /> Modo Offline: Se guardará en cola
              </span>
            )}
          </div>
          <div className="flex items-center gap-6 w-full md:w-auto">
            <div className="text-right">
              <span className="block text-xs text-slate-500 uppercase tracking-wide">Total a Pagar</span>
              <span className="text-2xl font-bold text-[#1c2938]">{currency} {calculateTotal().toFixed(2)}</span>
            </div>
            <button
              onClick={handleSave}
              disabled={!clientName || calculateTotal() === 0}
              className="flex-1 md:flex-none bg-[#1c2938] text-white px-8 py-3 rounded-xl font-medium hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {isOffline ? 'Guardar en Cola' : 'Emitir Factura'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceBuilder;