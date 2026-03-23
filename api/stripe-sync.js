import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { stripeSecretKey } = req.body;

    if (!stripeSecretKey) {
      return res.status(400).json({ error: 'Stripe Secret Key no enviada.' });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    // 1. Fetch the last 100 checkout sessions
    const sessions = await stripe.checkout.sessions.list({ 
        limit: 100
    });

    // 2. Also fetch the last 100 PaymentIntents (for cases where checkout wasn't used)
    const paymentIntents = await stripe.paymentIntents.list({
        limit: 100
    });

    // 3. Fetch the last 100 Stripe Invoices (Subscriptions & Recurring)
    const stripeInvoices = await stripe.invoices.list({
        limit: 100
    });

    const syncedPayments = new Map();

    // Process Sessions first (better metadata)
    for (const session of sessions.data) {
      if (session.payment_status === 'paid' && session.payment_intent) {
        const piId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id;
        syncedPayments.set(piId, {
          invoiceId: session.metadata?.invoiceId || null,
          amountPaid: session.amount_total / 100,
          currency: session.currency?.toUpperCase() || 'USD',
          stripeSessionId: session.id,
          stripePaymentIntentId: piId,
          date: new Date(session.created * 1000).toISOString(),
          customerName: session.customer_details?.name || 'Cliente Desconocido',
          customerEmail: session.customer_details?.email || '',
          description: session.metadata?.invoiceDesc || 'Pago Stripe (Checkout)'
        });
      }
    }

    // Process Invoices (Subscriptions)
    for (const inv of stripeInvoices.data) {
        if (inv.status === 'paid' && inv.payment_intent) {
            const piId = typeof inv.payment_intent === 'string' ? inv.payment_intent : inv.payment_intent.id;
            if (!syncedPayments.has(piId)) {
                syncedPayments.set(piId, {
                    invoiceId: inv.metadata?.invoiceId || null,
                    amountPaid: inv.amount_paid / 100,
                    currency: inv.currency?.toUpperCase() || 'USD',
                    stripeSessionId: null,
                    stripeInvoiceId: inv.id,
                    stripePaymentIntentId: piId,
                    isSubscription: !!inv.subscription,
                    date: new Date(inv.created * 1000).toISOString(),
                    customerName: inv.customer_name || inv.customer_email || 'Suscriptor Stripe',
                    customerEmail: inv.customer_email || '',
                    description: inv.description || (inv.subscription ? 'Cobro de Suscripción' : 'Factura Stripe')
                });
            }
        }
    }

    // Process PIs (for direct ones or historical ones)
    for (const pi of paymentIntents.data) {
      if (pi.status === 'succeeded' && !syncedPayments.has(pi.id)) {
        syncedPayments.set(pi.id, {
          invoiceId: pi.metadata?.invoiceId || null,
          amountPaid: pi.amount_received / 100,
          currency: pi.currency?.toUpperCase() || 'USD',
          stripeSessionId: null, // No session associated
          stripePaymentIntentId: pi.id,
          date: new Date(pi.created * 1000).toISOString(),
          customerName: pi.receipt_email || 'Comprador Directo',
          customerEmail: pi.receipt_email || '',
          description: pi.metadata?.invoiceDesc || pi.description || 'Transacción Stripe'
        });
      }
    }

    return res.status(200).json({ success: true, payments: Array.from(syncedPayments.values()) });
  } catch (error) {
    console.error('Stripe Sync Error:', error);
    return res.status(500).json({ error: 'Error al consultar transacciones', details: error.message });
  }
}
