
import React, { useState } from 'react';
import { UploadCloud, Loader2, ArrowLeft, Check, X, Camera, FileText } from 'lucide-react';
import { UserProfile, Invoice } from '../types';
import { parseExpenseImage, AI_ERROR_BLOCKED } from '../services/geminiService';

interface ExpenseWizardProps {
  currentUser: UserProfile;
  onSave: (invoice: Invoice) => void;
  onCancel: () => void;
}

const ExpenseWizard: React.FC<ExpenseWizardProps> = ({ currentUser, onSave, onCancel }) => {
  const [step, setStep] = useState<'UPLOAD' | 'REVIEW'>('UPLOAD');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'pdf'>('image');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  
  const [expenseData, setExpenseData] = useState<{
    clientName: string;
    amount: number;
    currency: string;
    concept: string;
    date: string;
    // New Fields
    isDeductible: boolean; 
    isValidDoc: boolean; // Has fiscal invoice?
  }>({
    clientName: '',
    amount: 0,
    currency: currentUser.defaultCurrency || 'USD',
    concept: '',
    date: new Date().toISOString().split('T')[0],
    isDeductible: true,
    isValidDoc: true
  });

  const hasAiAccess = !!currentUser.apiKeys?.gemini || !!currentUser.apiKeys?.openai;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isPdf = file.type === 'application/pdf';
      setFileType(isPdf ? 'pdf' : 'image');

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        setUploadedImage(base64String);
        
        // Strip header for API if image/pdf
        const rawBase64 = base64String.split(',')[1];
        const mimeType = file.type;

        // If AI is available, parse it (Supports Images AND PDFs now)
        if (hasAiAccess) {
            setIsLoading(true);
            setLoadingMsg(isPdf ? 'Analizando documento PDF...' : 'Escaneando recibo con IA...');
            try {
                const result = await parseExpenseImage(rawBase64, mimeType, currentUser.apiKeys);
                if (result) {
                    setExpenseData({
                        clientName: result.clientName || 'Proveedor Desconocido',
                        amount: result.amount || 0,
                        currency: result.currency || 'USD',
                        concept: result.concept || 'Gasto Varios',
                        date: result.date || new Date().toISOString().split('T')[0],
                        isDeductible: true,
                        isValidDoc: true
                    });
                }
            } catch (err) {
                console.error("Vision Error", err);
                if ((err as any).message === AI_ERROR_BLOCKED) {
                    alert("Función bloqueada: Configura tus API Keys.");
                }
            } finally {
                setIsLoading(false);
                setStep('REVIEW'); 
            }
        } else {
            // Manual flow if AI blocked
            setExpenseData({ ...expenseData, concept: file.name });
            setStep('REVIEW');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    const newExpense: Invoice = {
        id: `EXP-${Date.now()}`,
        type: 'Expense',
        clientName: expenseData.clientName,
        date: expenseData.date,
        currency: expenseData.currency,
        total: expenseData.amount,
        status: 'Pagada', // Expenses are usually paid
        
        // NEW FISCAL FIELDS
        expenseDeductibility: expenseData.isDeductible ? 'FULL' : 'NONE',
        isValidFiscalDoc: expenseData.isValidDoc,

        items: [{
            id: Date.now().toString(),
            description: expenseData.concept,
            quantity: 1,
            price: expenseData.amount,
            tax: 0
        }],
        receiptUrl: uploadedImage || undefined
    };
    onSave(newExpense);
  };

  if (step === 'UPLOAD') {
      return (
          <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl shadow-lg text-center mt-10">
              <h2 className="text-2xl font-bold text-[#1c2938] mb-4">Nuevo Gasto</h2>
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center gap-4 hover:bg-slate-50 transition-colors relative">
                  <input type="file" onChange={handleImageUpload} accept="image/*,application/pdf" className="absolute inset-0 opacity-0 cursor-pointer" />
                  {isLoading ? (
                      <div className="flex flex-col items-center">
                          <Loader2 className="w-10 h-10 animate-spin text-[#27bea5] mb-2" />
                          <p className="text-slate-500">{loadingMsg}</p>
                      </div>
                  ) : (
                      <>
                          <div className="w-16 h-16 bg-[#27bea5]/10 rounded-full flex items-center justify-center text-[#27bea5]">
                              <Camera className="w-8 h-8" />
                          </div>
                          <p className="text-slate-500 font-medium">Sube una foto o PDF de tu recibo</p>
                          <button className="bg-[#1c2938] text-white px-6 py-2 rounded-xl font-bold">Seleccionar Archivo</button>
                      </>
                  )}
              </div>
              <div className="mt-6 flex justify-between">
                  <button onClick={onCancel} className="text-slate-400 font-bold hover:text-slate-600">Cancelar</button>
                  <button onClick={() => setStep('REVIEW')} className="text-[#27bea5] font-bold hover:underline">Saltar a Manual</button>
              </div>
          </div>
      );
  }

  return (
      <div className="max-w-4xl mx-auto p-6 bg-white rounded-3xl shadow-lg mt-10">
          <div className="flex items-center gap-4 mb-6">
              <button onClick={() => setStep('UPLOAD')} className="p-2 hover:bg-slate-100 rounded-full"><ArrowLeft className="w-6 h-6" /></button>
              <h2 className="text-2xl font-bold text-[#1c2938]">Revisar Detalles</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                  <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Proveedor</label>
                      <input 
                        value={expenseData.clientName}
                        onChange={(e) => setExpenseData({...expenseData, clientName: e.target.value})}
                        className="w-full p-3 bg-slate-50 rounded-xl font-bold text-[#1c2938] outline-none focus:ring-2 focus:ring-[#27bea5]"
                      />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Concepto</label>
                      <input 
                        value={expenseData.concept}
                        onChange={(e) => setExpenseData({...expenseData, concept: e.target.value})}
                        className="w-full p-3 bg-slate-50 rounded-xl font-medium text-slate-700 outline-none focus:ring-2 focus:ring-[#27bea5]"
                      />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Total</label>
                          <input 
                            type="number"
                            value={expenseData.amount}
                            onChange={(e) => setExpenseData({...expenseData, amount: parseFloat(e.target.value)})}
                            className="w-full p-3 bg-slate-50 rounded-xl font-bold text-[#1c2938] outline-none focus:ring-2 focus:ring-[#27bea5]"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Fecha</label>
                          <input 
                            type="date"
                            value={expenseData.date}
                            onChange={(e) => setExpenseData({...expenseData, date: e.target.value})}
                            className="w-full p-3 bg-slate-50 rounded-xl font-medium text-slate-700 outline-none focus:ring-2 focus:ring-[#27bea5]"
                          />
                      </div>
                  </div>

                  {/* FISCAL CHECKS */}
                  <div className="pt-4 border-t border-slate-100">
                      <p className="text-xs font-bold text-[#27bea5] uppercase mb-3 flex items-center gap-1">
                          <FileText className="w-3 h-3" /> Validación Fiscal
                      </p>
                      
                      <div className="space-y-3">
                          <label className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                              <input 
                                type="checkbox"
                                checked={expenseData.isValidDoc}
                                onChange={(e) => setExpenseData({...expenseData, isValidDoc: e.target.checked})}
                                className="w-5 h-5 text-[#27bea5] rounded focus:ring-0"
                              />
                              <div className="flex-1">
                                  <span className="block font-bold text-slate-700 text-sm">Tiene Factura Fiscal</span>
                                  <span className="text-xs text-slate-400">Desmarca si es voucher o recibo simple (No deduce ITBMS)</span>
                              </div>
                          </label>

                          <label className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                              <input 
                                type="checkbox"
                                checked={expenseData.isDeductible}
                                onChange={(e) => setExpenseData({...expenseData, isDeductible: e.target.checked})}
                                className="w-5 h-5 text-[#27bea5] rounded focus:ring-0"
                              />
                              <div className="flex-1">
                                  <span className="block font-bold text-slate-700 text-sm">Es Gasto Deducible</span>
                                  <span className="text-xs text-slate-400">Relacionado directamente al negocio</span>
                              </div>
                          </label>
                      </div>
                  </div>
              </div>
              
              <div className="bg-slate-100 rounded-2xl flex items-center justify-center p-4 overflow-hidden max-h-80">
                  {uploadedImage ? (
                      fileType === 'pdf' ? (
                          <div className="text-slate-500 font-medium">Vista previa de PDF no disponible</div>
                      ) : (
                          <img src={uploadedImage} alt="Receipt" className="object-contain h-full w-full rounded-lg" />
                      )
                  ) : (
                      <div className="text-slate-400 font-medium">Sin imagen</div>
                  )}
              </div>
          </div>

          <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-slate-100">
              <button onClick={onCancel} className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-50">Cancelar</button>
              <button onClick={handleSave} className="bg-[#1c2938] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#27bea5] flex items-center gap-2">
                  <Check className="w-5 h-5" /> Guardar Gasto
              </button>
          </div>
      </div>
  );
};

export default ExpenseWizard;
