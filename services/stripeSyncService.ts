
import { Invoice, UserProfile, DbClient } from '../types';

export const performAutomatedStripeSync = async (
  currentUser: UserProfile,
  invoices: Invoice[],
  dbClients: DbClient[],
  onUpdateInvoice: (invoice: Invoice) => Promise<void>,
  onUpdateStatus: (id: string, status: any, extras: any) => void
) => {
  if (!currentUser?.paymentIntegration?.stripeSecretKey) return { autoCount: 0, createdCount: 0 };

  try {
    const res = await fetch('/api/stripe-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stripeSecretKey: currentUser.paymentIntegration.stripeSecretKey })
    });
    const data = await res.json();
    
    if (!data.success || !data.payments) return { autoCount: 0, createdCount: 0 };

    let autoCount = 0;
    let createdCount = 0;

    for (const payment of data.payments) {
      // 1. Check if already synced
      const alreadySynced = invoices.some(i => 
        i.stripeMapping?.includes(payment.stripeSessionId) || 
        i.stripeMapping?.includes(payment.stripePaymentIntentId) ||
        i.stripeMapping?.includes(payment.stripeInvoiceId)
      );
      if (alreadySynced) continue;

      // 2. Try to match by Invoice ID (Metadata)
      const targetInvoice = invoices.find(i => i.id === payment.invoiceId && i.status !== 'Pagada' && i.status !== 'Rechazada');
      
      if (payment.invoiceId && targetInvoice) {
        const currentPaid = targetInvoice.amountPaid || 0;
        const newTotalPaid = currentPaid + payment.amountPaid;
        const isTotal = newTotalPaid >= targetInvoice.total;
        
        onUpdateStatus(targetInvoice.id, isTotal ? 'Pagada' : 'Abonada', {
          amountPaid: newTotalPaid,
          stripeMapping: [...(targetInvoice.stripeMapping || []), payment.stripeSessionId || payment.stripePaymentIntentId, payment.stripeInvoiceId].filter(Boolean),
          notes: `Pago detectado en Stripe: ${payment.currency} ${payment.amountPaid.toFixed(2)}`
        });
        autoCount++;
        continue;
      }

      // 3. Try to match by Stripe Customer ID (Mapping)
      if (payment.stripeCustomerId) {
        const client = dbClients.find(c => c.stripeCustomerId === payment.stripeCustomerId);
        if (client) {
          // Auto-create invoice
          const sequences = currentUser.documentSequences || { invoicePrefix: 'FAC', invoiceNextNumber: 1 };
          let nextNum = sequences.invoiceNextNumber;
          let newId = `${sequences.invoicePrefix}-${String(nextNum + createdCount).padStart(4, '0')}`;
          
          // Basic collision check against local invoices
          while (invoices.some(i => i.id === newId)) {
            nextNum++;
            newId = `${sequences.invoicePrefix}-${String(nextNum + createdCount).padStart(4, '0')}`;
          }

          const newInvoice: Invoice = {
            id: newId,
            userId: currentUser.id,
            clientName: client.name,
            clientEmail: client.email,
            clientTaxId: client.taxId,
            date: payment.date || new Date().toISOString(),
            status: 'Pagada',
            total: payment.amountPaid,
            amountPaid: payment.amountPaid,
            currency: payment.currency,
            type: 'Invoice',
            items: [{
              id: `item-${Date.now()}`,
              description: payment.description || 'Cobro Automático Stripe',
              quantity: 1,
              price: payment.amountPaid,
              tax: 0
            }],
            stripeMapping: [payment.stripeSessionId, payment.stripePaymentIntentId, payment.stripeInvoiceId].filter(Boolean) as string[],
            timeline: [{
              id: Date.now().toString(),
              type: 'CREATED',
              title: 'Factura auto-generada (Match Stripe Customer)',
              description: `ID Stripe: ${payment.stripeCustomerId}`,
              timestamp: new Date().toISOString()
            }]
          };

          await onUpdateInvoice(newInvoice);
          createdCount++;
        }
      }
    }

    return { autoCount, createdCount };
  } catch (err) {
    console.error("Automated Stripe Sync Failed:", err);
    return { autoCount: 0, createdCount: 0 };
  }
};
