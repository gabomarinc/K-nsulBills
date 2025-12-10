
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle, Trash2 } from 'lucide-react';

type AlertType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: AlertType;
  title: string;
  message?: string;
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'info';
}

interface AlertContextType {
  addToast: (type: AlertType, title: string, message?: string) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};

export const AlertProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  // --- TOAST LOGIC ---
  const addToast = useCallback((type: AlertType, title: string, message?: string) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, title, message }]);
    
    // Auto dismiss
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // --- CONFIRM LOGIC ---
  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmDialog({ isOpen: true, options, resolve });
    });
  }, []);

  const handleConfirm = () => {
    if (confirmDialog) {
      confirmDialog.resolve(true);
      setConfirmDialog(null);
    }
  };

  const handleCancel = () => {
    if (confirmDialog) {
      confirmDialog.resolve(false);
      setConfirmDialog(null);
    }
  };

  // --- RENDER HELPERS ---
  const getIcon = (type: AlertType) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="w-6 h-6 text-green-500" />;
      case 'error': return <X className="w-6 h-6 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-6 h-6 text-amber-500" />;
      default: return <Info className="w-6 h-6 text-blue-500" />;
    }
  };

  const getToastStyles = (type: AlertType) => {
    switch (type) {
      case 'success': return 'border-l-4 border-green-500 bg-white';
      case 'error': return 'border-l-4 border-red-500 bg-white';
      case 'warning': return 'border-l-4 border-amber-500 bg-white';
      default: return 'border-l-4 border-blue-500 bg-white';
    }
  };

  return (
    <AlertContext.Provider value={{ addToast, confirm }}>
      {children}

      {/* TOAST CONTAINER */}
      <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <div 
            key={toast.id} 
            className={`pointer-events-auto min-w-[320px] max-w-sm rounded-2xl shadow-xl p-4 flex items-start gap-4 transform transition-all duration-300 animate-in slide-in-from-right-8 ${getToastStyles(toast.type)}`}
          >
            <div className="mt-0.5">{getIcon(toast.type)}</div>
            <div className="flex-1">
              <h4 className="font-bold text-[#1c2938] text-sm">{toast.title}</h4>
              {toast.message && <p className="text-slate-500 text-xs mt-1 leading-relaxed">{toast.message}</p>}
            </div>
            <button onClick={() => removeToast(toast.id)} className="text-slate-300 hover:text-slate-500">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* CONFIRM MODAL */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[110] bg-[#1c2938]/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl transform transition-all animate-in zoom-in-95 scale-100">
             <div className="flex flex-col items-center text-center">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${confirmDialog.options.type === 'danger' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                   {confirmDialog.options.type === 'danger' ? <Trash2 className="w-10 h-10" /> : <Info className="w-10 h-10" />}
                </div>
                
                <h3 className="text-2xl font-bold text-[#1c2938] mb-2">{confirmDialog.options.title}</h3>
                <p className="text-slate-500 mb-8 leading-relaxed">
                  {confirmDialog.options.message}
                </p>

                <div className="flex gap-4 w-full">
                   <button 
                     onClick={handleCancel}
                     className="flex-1 py-3.5 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                   >
                     {confirmDialog.options.cancelText || 'Cancelar'}
                   </button>
                   <button 
                     onClick={handleConfirm}
                     className={`flex-1 py-3.5 rounded-xl font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all active:translate-y-0 ${confirmDialog.options.type === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-[#1c2938] hover:bg-[#27bea5]'}`}
                   >
                     {confirmDialog.options.confirmText || 'Confirmar'}
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}
    </AlertContext.Provider>
  );
};
