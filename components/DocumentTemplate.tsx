
import React from 'react';
import { 
  Building2, CheckCircle2, FileText, Wallet, 
  Calendar, StickyNote, Lock, Link as LinkIcon, Smartphone
} from 'lucide-react';
import { Invoice, UserProfile, PaymentIntegration } from '../types';
// removed unused broken import

interface DocumentTemplateProps {
  invoice: Invoice;
  issuer: UserProfile;
  showPaymentButtons?: boolean;
  onPaymentClick?: (provider: string) => void;
}

const DocumentTemplate: React.FC<DocumentTemplateProps> = ({ 
  invoice, 
  issuer, 
  showPaymentButtons = false,
  onPaymentClick 
}) => {
  const branding = issuer.branding || { primaryColor: '#27bea5', templateStyle: 'Modern' };
  const color = branding.primaryColor;
  const logo = branding.logoUrl;
  const isQuote = invoice.type === 'Quote';

  // --- CALCULATION LOGIC ---
  const subtotal = invoice.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const discountRate = invoice.discountRate || 0;
  const discountAmount = subtotal * (discountRate / 100);
  
  // ITBMS 7%
  const taxTotal = (subtotal - discountAmount) * 0.07;
  const amountPaid = invoice.amountPaid || 0;
  const remainingBalance = invoice.total - amountPaid;

  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'Pagada':
      case 'Aceptada': return 'bg-green-50 text-green-700 border-green-200';
      case 'Rechazada': 
      case 'Incobrable': return 'bg-red-50 text-red-700 border-red-200';
      case 'Negociacion': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Seguimiento': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Abonada': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Enviada': return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'PendingSync': return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200'; 
    }
  };

  const renderPaymentButtons = () => {
    if (isQuote || !remainingBalance || remainingBalance <= 0 || !showPaymentButtons) return null;
    
    const hasPaguelo = !!issuer.paymentIntegration?.cclw;
    const hasYappy = !!issuer.paymentIntegration?.yappyApiKey; 
    const hasStripe = !!issuer.paymentIntegration?.stripeSecretKey;

    if (!hasPaguelo && !hasYappy && !hasStripe) return null;

    return (
        <div className="mt-6 pt-6 border-t border-slate-100" data-html2canvas-ignore>
            <p className="font-bold text-[#1c2938] mb-3 text-sm uppercase tracking-wide">Pagar Online</p>
            <div className="flex flex-wrap gap-3">
                {hasPaguelo && (
                    <button 
                      onClick={() => onPaymentClick?.('PagueloFacil')}
                      className="flex-1 bg-[#009ee3] text-white py-2.5 px-4 rounded-xl font-bold hover:bg-[#008cc9] transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                        <Lock className="w-4 h-4" /> PagueloFacil
                    </button>
                )}
                {hasYappy && (
                    <button 
                      onClick={() => onPaymentClick?.('Yappy')}
                      className="flex-1 bg-[#ff6b00] text-white py-2.5 px-4 rounded-xl font-bold hover:bg-[#e65c00] transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                        <Smartphone className="w-4 h-4" /> Yappy
                    </button>
                )}
                {hasStripe && (
                    <button 
                      onClick={() => onPaymentClick?.('Stripe')}
                      className="flex-1 bg-[#635BFF] text-white py-2.5 px-4 rounded-xl font-bold hover:bg-[#5249e5] transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                        <Lock className="w-4 h-4" /> Stripe
                    </button>
                )}
            </div>
            <p className="text-[10px] text-slate-400 mt-2 text-center italic">Al hacer clic serás redirigido a la pasarela de pago segura.</p>
        </div>
    );
  };

  const renderModern = () => (
    <div className="bg-white shadow-xl rounded-xl overflow-hidden min-h-[1050px] flex flex-col relative print:shadow-none w-[190mm] border border-slate-100">
      <div className="h-4 w-full" style={{ backgroundColor: color }}></div>
      <div className="p-12 flex-1">
        <div className="flex justify-between items-start mb-12">
          <div>
              <div className="flex items-center gap-3 mb-4">
                {logo ? (
                   <img src={logo} alt="Logo" className="h-[96px] w-auto max-w-[250px] object-contain" />
                ) : (
                  <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                    <Building2 className="w-8 h-8" />
                  </div>
                )}
                {!logo && (
                  <div>
                    <h1 className="text-xl font-bold text-[#1c2938]">{issuer.name}</h1>
                    <p className="text-sm text-slate-500">{issuer.taxId}</p>
                  </div>
                )}
              </div>
              <div className="text-sm text-slate-500 space-y-1">
                {logo && (
                   <>
                     <p className="font-bold text-[#1c2938] text-lg leading-tight">{issuer.name}</p>
                     {issuer.legalName && <p className="text-xs font-medium text-slate-400 mb-2">{issuer.legalName}</p>}
                   </>
                )}
                <p>{issuer.address}</p>
                <p>{issuer.country}</p>
                <p className="text-xs mt-2">{issuer.fiscalRegime}</p>
              </div>
          </div>

          <div className="text-right">
            <h2 className="text-4xl font-bold text-slate-200 uppercase tracking-widest mb-2">
              {isQuote ? 'Cotización' : 'Factura'}
            </h2>
            <p className="font-mono text-xl font-semibold text-slate-700">#{invoice.id.toUpperCase()}</p>
            <div className="mt-4 space-y-1 text-sm">
              <div className="flex justify-end gap-4">
                <span className="text-slate-400">Fecha:</span>
                <span className="font-medium text-slate-800">{new Date(invoice.date).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
                <span className={`px-4 py-1.5 rounded-full text-sm font-bold border uppercase tracking-wide flex items-center gap-1 ${getStatusStyle(invoice.status)}`}>
                    {invoice.status === 'PendingSync' ? 'Offline' : invoice.status}
                </span>
            </div>
          </div>
        </div>

        <div className="mb-12 bg-slate-50 rounded-xl p-8 border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Cliente</p>
            <h3 className="text-2xl font-bold text-[#1c2938]">{invoice.clientName}</h3>
            {invoice.clientTaxId && <p className="text-slate-600 font-mono text-base mt-1">{invoice.clientTaxId}</p>}
            {invoice.clientEmail && <p className="text-slate-500 text-sm mt-1">{invoice.clientEmail}</p>}
        </div>

        <div className="mb-12">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b-2 border-slate-100">
                <th className="py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Descripción</th>
                <th className="py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center w-20">Cant</th>
                <th className="py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right w-32">Precio</th>
                <th className="py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right w-32">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {invoice.items.map((item, idx) => (
                <tr key={idx} className="break-inside-avoid">
                  <td className="py-5">
                    <p className="font-medium text-slate-800 text-lg">{item.description}</p>
                    {item.details && <p className="text-sm text-slate-500 mt-1 whitespace-pre-wrap leading-relaxed">{item.details}</p>}
                  </td>
                  <td className="py-5 text-center text-slate-600 align-top pt-6">{item.quantity}</td>
                  <td className="py-5 text-right text-slate-600 align-top pt-6">${item.price.toFixed(2)}</td>
                  <td className="py-5 text-right font-bold text-[#1c2938] text-lg align-top pt-6">${(item.quantity * item.price).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-row gap-12">
            <div className="flex-1 space-y-6">
              {invoice.notes && (
                  <div className="p-6 rounded-xl text-sm bg-slate-50 border border-slate-100">
                      <p className="font-bold mb-2 flex items-center gap-2 text-slate-700 uppercase tracking-wider text-xs">
                          <StickyNote className="w-4 h-4"/> Notas
                      </p>
                      <p className="text-slate-600 whitespace-pre-wrap leading-relaxed">{invoice.notes}</p>
                  </div>
              )}

              {isQuote ? (
                <div style={{ backgroundColor: color + '15', color: color }} className="p-6 rounded-xl text-sm border border-transparent">
                  <p className="font-bold mb-2 flex items-center gap-2 text-lg"><CheckCircle2 className="w-5 h-5"/> Condiciones</p>
                  <p className="opacity-90 text-[#1c2938] leading-relaxed">Esta cotización incluye impuestos. Para aprobar, favor de firmar y enviar respuesta a este correo.</p>
                </div>
              ) : (
                <div className="bg-slate-50 p-6 rounded-xl text-slate-700 text-sm">
                  <p className="font-bold mb-2 text-lg">Datos Bancarios</p>
                  <p className="font-bold text-[#1c2938]">{issuer.legalName || issuer.name}</p>
                  {issuer.bankName && <p className="font-medium text-slate-600">{issuer.bankName}</p>}
                  <p className="font-mono text-base mb-1">
                     <span className="text-xs font-bold text-slate-400 uppercase mr-1">{issuer.bankAccountType || 'Cuenta'}:</span> 
                     {issuer.bankAccount || 'No configurado'}
                  </p>
                  
                  {renderPaymentButtons()}

                  {issuer.paymentIntegration?.stripeSecretKey && !isQuote && (
                      <div className="mt-4 p-4 border border-dashed border-indigo-200 rounded-lg text-center bg-indigo-50/30">
                          <p className="text-[10px] text-slate-400 uppercase font-bold mb-2">Pago Electrónico Directo</p>
                          <div className="text-indigo-600 font-bold text-sm flex items-center justify-center gap-1">
                             <LinkIcon className="w-3 h-3" /> Pagar Factura Online
                          </div>
                      </div>
                  )}
                </div>
              )}
            </div>

            <div className="w-80 space-y-4">
              <div className="flex justify-between text-slate-500 text-lg">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-lg">
                    <span className="text-slate-500">Descuento ({discountRate.toFixed(1)}%)</span>
                    <span className="text-green-600 font-medium">-${discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500 text-lg">
                <span>ITBMS (7%)</span>
                <span>${taxTotal.toFixed(2)}</span>
              </div>
              <div className="pt-6 border-t-2 border-slate-100 flex justify-between items-end">
                  <span className="font-bold text-[#1c2938] text-xl">Total</span>
                  <span className="font-bold text-[#1c2938] text-4xl" style={{ color: color }}>
                    {invoice.currency} {invoice.total.toFixed(2)}
                  </span>
              </div>
              
              {!isQuote && amountPaid > 0 && (
                <div className="pt-4 mt-2 border-t border-slate-100">
                    <div className="flex justify-between text-sm mb-1">
                        <span className="font-bold text-green-600">Pagado</span>
                        <span className="font-bold text-slate-600">{invoice.currency} {amountPaid.toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 mb-1">
                        <div 
                            className="bg-green-500 h-2.5 rounded-full" 
                            style={{ width: `${Math.min(100, (amountPaid / invoice.total) * 100)}%` }}
                        ></div>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                        <span>{((amountPaid / invoice.total) * 100).toFixed(0)}% Completado</span>
                        <span>Resta: {invoice.currency} {remainingBalance.toFixed(2)}</span>
                    </div>
                </div>
              )}
            </div>
        </div>
      </div>
      <div className="bg-slate-50 p-8 text-center border-t border-slate-100 mt-auto">
          <p className="text-slate-400 text-xs font-medium">Generado con Kônsul Bills</p>
      </div>
    </div>
  );

  const renderClassic = () => (
    <div className="bg-white shadow-xl min-h-[1050px] flex flex-col relative print:shadow-none p-16 border-t-[12px] w-[190mm]" style={{ borderColor: color }}>
       <div className="text-center border-b-4 border-slate-100 pb-8 mb-8">
          <h1 className="text-3xl font-serif font-bold text-slate-800 uppercase tracking-widest mb-1">{issuer.name}</h1>
          {issuer.legalName && <p className="text-slate-600 font-serif font-bold text-sm mb-1">{issuer.legalName}</p>}
          <p className="text-slate-500 font-serif italic text-sm">{issuer.address} • {issuer.country}</p>
       </div>

       <div className="flex justify-between items-start mb-12">
          <div className="border-l-4 pl-4" style={{ borderColor: color }}>
             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Facturado A</p>
             <h3 className="text-xl font-serif font-bold text-slate-800">{invoice.clientName}</h3>
             <p className="text-slate-600 text-sm mt-1">{invoice.clientTaxId}</p>
          </div>
          <div className="text-right">
             <h2 className="text-2xl font-serif font-bold text-slate-800">{isQuote ? 'COTIZACIÓN' : 'FACTURA'}</h2>
             <p className="text-slate-500 text-lg">#{invoice.id}</p>
             <p className="text-slate-400 text-sm mt-1">{new Date(invoice.date).toLocaleDateString()}</p>
          </div>
       </div>

       <table className="w-full text-left mb-12">
          <thead>
             <tr className="border-b-2 border-slate-800">
                <th className="py-3 font-serif font-bold text-slate-800 uppercase text-sm">Ítem</th>
                <th className="py-3 font-serif font-bold text-slate-800 uppercase text-sm text-right">Cant</th>
                <th className="py-3 font-serif font-bold text-slate-800 uppercase text-sm text-right">Precio</th>
                <th className="py-3 font-serif font-bold text-slate-800 uppercase text-sm text-right">Total</th>
             </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
             {invoice.items.map((item, idx) => (
                <tr key={idx} className="break-inside-avoid">
                   <td className="py-4 font-serif text-slate-700">
                      <p>{item.description}</p>
                      {item.details && <p className="text-sm text-slate-500 mt-1 italic">{item.details}</p>}
                   </td>
                   <td className="py-4 font-serif text-slate-700 text-right align-top pt-4">{item.quantity}</td>
                   <td className="py-4 font-serif text-slate-700 text-right align-top pt-4">${item.price.toFixed(2)}</td>
                   <td className="py-4 font-serif font-bold text-slate-800 text-right align-top pt-4">${(item.quantity * item.price).toFixed(2)}</td>
                </tr>
             ))}
          </tbody>
       </table>

       <div className="flex justify-end mb-16">
          <div className="w-64 space-y-3">
             <div className="flex justify-between text-slate-600 font-serif text-sm">
                <span>Subtotal:</span>
                <span>${subtotal.toFixed(2)}</span>
             </div>
             {discountAmount > 0 && (
                <div className="flex justify-between text-slate-600 font-serif text-sm">
                    <span>Descuento:</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                </div>
             )}
             <div className="flex justify-between text-slate-600 font-serif text-sm border-b border-slate-300 pb-2">
                <span>Impuesto:</span>
                <span>${taxTotal.toFixed(2)}</span>
             </div>
             <div className="flex justify-between font-serif font-bold text-xl text-slate-900">
                <span>Total:</span>
                <span>{invoice.currency} ${invoice.total.toFixed(2)}</span>
             </div>
          </div>
       </div>

       {invoice.notes && (
           <div className="mb-8 p-4 border-t border-slate-200">
               <p className="font-serif font-bold text-sm text-slate-800 mb-1">Notas:</p>
               <p className="font-serif text-sm text-slate-600 italic">{invoice.notes}</p>
           </div>
       )}

       {!isQuote && (
           <div className="mb-8 p-4 border border-slate-200 rounded text-center">
               <p className="font-serif font-bold text-sm text-slate-800">Métodos de Pago</p>
               <p className="font-serif text-sm font-bold text-slate-900">{issuer.legalName || issuer.name}</p>
               <p className="font-serif text-sm text-slate-600">{issuer.bankName}</p>
               <p className="font-serif text-sm text-slate-600 font-bold">{issuer.bankAccountType}: {issuer.bankAccount}</p>
               
               {renderPaymentButtons()}

               {issuer.paymentIntegration?.stripeSecretKey && !isQuote && (
                   <div className="mt-4 p-4 border border-slate-200 rounded text-center">
                       <p className="font-serif text-[10px] text-slate-400 uppercase font-bold mb-1">Pago Directo Online</p>
                       <div className="text-slate-900 font-serif font-bold text-sm">
                          Pagar vía Stripe
                       </div>
                   </div>
               )}
           </div>
       )}

       <div className="mt-auto text-center text-slate-400 text-xs font-serif italic border-t border-slate-100 pt-8">
          Gracias por su confianza. {issuer.name}
       </div>
    </div>
  );

  const renderMinimal = () => (
    <div className="bg-white shadow-xl min-h-[1050px] flex flex-col relative print:shadow-none p-12 font-sans w-[190mm]">
       <div className="flex justify-between items-center mb-16">
          <div className="flex items-center gap-3">
             <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }}></div>
             <div>
                <h1 className="font-bold text-slate-900 text-xl tracking-tight">{issuer.name}</h1>
                {issuer.legalName && <p className="text-xs text-slate-500">{issuer.legalName}</p>}
             </div>
          </div>
          <div className="text-right">
             <p className="text-sm font-bold text-slate-900">{isQuote ? 'Cotización' : 'Factura'} {invoice.id}</p>
             <p className="text-xs text-slate-400">{new Date(invoice.date).toLocaleDateString()}</p>
          </div>
       </div>

       <div className="mb-16">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Para</p>
          <h2 className="text-3xl font-light text-slate-900 mb-2">{invoice.clientName}</h2>
          <p className="text-sm text-slate-500">{invoice.clientTaxId}</p>
       </div>

       <div className="space-y-4 mb-16">
          {invoice.items.map((item, idx) => (
             <div key={idx} className="flex justify-between items-start py-4 border-b border-slate-50 break-inside-avoid">
                <div>
                   <p className="font-medium text-slate-900 text-lg">{item.description}</p>
                   {item.details && <p className="text-sm text-slate-500 mt-1">{item.details}</p>}
                   <p className="text-xs text-slate-400 mt-1">{item.quantity} x ${item.price.toFixed(2)}</p>
                </div>
                <p className="font-bold text-slate-900 text-lg">${(item.quantity * item.price).toFixed(2)}</p>
             </div>
          ))}
       </div>

        <div className="flex justify-end mb-8">
          <div className="text-right space-y-1">
             <div className="flex justify-end gap-8 text-sm text-slate-500">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
             </div>
             {discountAmount > 0 && (
                <div className="flex justify-end gap-8 text-sm text-slate-500">
                    <span>Descuento</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                </div>
             )}
             <div className="flex justify-end gap-8 text-sm text-slate-500 pb-4">
                <span>Impuesto</span>
                <span>${taxTotal.toFixed(2)}</span>
             </div>
             
             <p className="text-xs text-slate-400 uppercase tracking-widest mb-1 pt-4 border-t border-slate-100">Total a Pagar</p>
             <h2 className="text-5xl font-bold text-slate-900 tracking-tighter" style={{ color: color }}>
                {invoice.currency} {invoice.total.toLocaleString()}
             </h2>
          </div>
       </div>

       {!isQuote && (
           <div className="border-t border-slate-100 pt-8 mt-auto">
                <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                    <div className="text-sm">
                        <p className="font-bold text-slate-900 mb-2">Datos de Pago</p>
                        <p className="text-slate-600">{issuer.legalName || issuer.name}</p>
                        <p className="text-slate-500">{issuer.bankName} • {issuer.bankAccount}</p>
                    </div>
                    <div>
                        {renderPaymentButtons()}
                        {issuer.paymentIntegration?.stripeSecretKey && (
                            <div className="mt-4 text-right">
                                <div 
                                  className="text-xs font-bold uppercase tracking-widest"
                                  style={{ color: color }}
                                >
                                   Pagar vía Stripe →
                                </div>
                            </div>
                        )}
                    </div>
                </div>
           </div>
       )}

       {invoice.notes && (
           <div className="mt-16 text-slate-500 text-sm">
               {invoice.notes}
           </div>
       )}
    </div>
  );

  if (branding.templateStyle === 'Classic') return renderClassic();
  if (branding.templateStyle === 'Minimal') return renderMinimal();
  return renderModern();
};

export default DocumentTemplate;
