
import React from 'react';
import { 
  CheckCircle2, 
  Mail, 
  Eye, 
  MousePointer2, 
  FileText, 
  Clock, 
  CreditCard,
  TrendingUp,
  AlertCircle,
  Smartphone
} from 'lucide-react';
import { TimelineEvent } from '../types';

interface DocumentTimelineProps {
  events?: TimelineEvent[];
  type: 'Invoice' | 'Quote' | 'Expense';
  successProbability?: number;
}

const DocumentTimeline: React.FC<DocumentTimelineProps> = ({ events = [], type, successProbability }) => {
  
  // Helper to get icon
  const getIcon = (eventType: string) => {
    switch (eventType) {
      case 'CREATED': return <FileText className="w-4 h-4" />;
      case 'SENT': return <Mail className="w-4 h-4" />;
      case 'OPENED': return <Eye className="w-4 h-4" />;
      case 'CLICKED': return <MousePointer2 className="w-4 h-4" />;
      case 'APPROVED': return <CheckCircle2 className="w-4 h-4" />;
      case 'PAID': return <CreditCard className="w-4 h-4" />;
      case 'REMINDER': return <Clock className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getSuccessLevel = (prob: number) => {
    if (prob >= 80) return { label: 'Muy Alta', color: 'text-green-600', bg: 'bg-green-100', bar: 'bg-green-500' };
    if (prob >= 50) return { label: 'Moderada', color: 'text-yellow-600', bg: 'bg-yellow-100', bar: 'bg-yellow-500' };
    return { label: 'Baja', color: 'text-red-600', bg: 'bg-red-100', bar: 'bg-red-500' };
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 h-full flex flex-col">
      <h3 className="font-bold text-[#1c2938] text-lg mb-6 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-[#27bea5]" /> Signos Vitales
      </h3>

      {/* AI Success Prediction (Only for Quotes) */}
      {type === 'Quote' && successProbability !== undefined && (
        <div className="mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <div className="flex justify-between items-end mb-2">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Probabilidad de Cierre</p>
              <p className={`text-2xl font-bold ${getSuccessLevel(successProbability).color}`}>
                {successProbability}% <span className="text-sm font-medium opacity-80">({getSuccessLevel(successProbability).label})</span>
              </p>
            </div>
            <div className={`p-2 rounded-full ${getSuccessLevel(successProbability).bg}`}>
              <TrendingUp className={`w-5 h-5 ${getSuccessLevel(successProbability).color}`} />
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
             <div 
               className={`h-full ${getSuccessLevel(successProbability).bar} transition-all duration-1000 ease-out`} 
               style={{ width: `${successProbability}%` }}
             ></div>
          </div>
          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> IA basada en historial del cliente
          </p>
        </div>
      )}

      {/* Timeline */}
      <div className="relative pl-4 space-y-8 flex-1 overflow-y-auto custom-scrollbar pr-2">
        {/* Vertical Line */}
        <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-slate-100"></div>

        {events.map((event, index) => {
          const isLast = index === events.length - 1;
          const isOpened = event.type === 'OPENED';
          
          return (
            <div key={event.id} className={`relative flex gap-4 ${isLast ? 'opacity-100' : 'opacity-80'}`}>
              
              {/* Icon Bubble */}
              <div className={`
                relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-sm flex-shrink-0
                ${isLast ? 'bg-[#1c2938] text-white scale-110' : 'bg-slate-50 text-slate-400'}
                ${isOpened ? 'bg-blue-50 text-blue-500' : ''}
              `}>
                {getIcon(event.type)}
                {isLast && (
                   <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#27bea5] rounded-full animate-pulse border-2 border-white"></span>
                )}
              </div>

              {/* Content */}
              <div className={`flex-1 pt-1 ${isLast ? 'font-medium' : ''}`}>
                <div className="flex justify-between items-start">
                   <h4 className={`text-sm font-bold ${isLast ? 'text-[#1c2938]' : 'text-slate-600'}`}>
                     {event.title}
                   </h4>
                   <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap bg-slate-50 px-2 py-0.5 rounded-full">
                     {new Date(event.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                   </span>
                </div>
                
                <p className="text-xs text-slate-500 mt-0.5">{event.description}</p>
                
                {/* Specific Metadata Badges */}
                {event.type === 'OPENED' && (
                  <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-md">
                    <Smartphone className="w-3 h-3" /> Leído en iPhone
                  </div>
                )}
                
                <p className="text-[10px] text-slate-300 mt-1">
                   {new Date(event.timestamp).toLocaleDateString()}
                </p>
              </div>
            </div>
          );
        })}

        {events.length === 0 && (
          <div className="text-center py-10 text-slate-400">
            <p className="text-sm">Sin actividad aún</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentTimeline;
