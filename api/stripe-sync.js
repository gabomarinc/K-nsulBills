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

    // Fetch the last 100 checkout sessions that were successful
    const sessions = await stripe.checkout.sessions.list({ limit: 100 });

    const syncedPayments = [];

    for (const session of sessions.data) {
      // Only process completed payments
      if (session.payment_status === 'paid') {
        syncedPayments.push({
          invoiceId: session.metadata?.invoiceId || null,
          amountPaid: session.amount_total / 100, // Convert from cents
          currency: session.currency?.toUpperCase() || 'USD',
          stripeSessionId: session.id,
          date: new Date(session.created * 1000).toISOString(),
          customerName: session.customer_details?.name || 'Cliente Desconocido',
          customerEmail: session.customer_details?.email || '',
          description: session.metadata?.invoiceDesc || 'Pago Directo Stripe'
        });
      }
    }

    // You could also fetch PaymentIntents if you use direct elements, 
    // but for Checkout Sessions, the list above is perfect.

    return res.status(200).json({ success: true, payments: syncedPayments });
  } catch (error) {
    console.error('Stripe Sync Error:', error);
    return res.status(500).json({ error: 'Error al consultar transacciones', details: error.message });
  }
}
