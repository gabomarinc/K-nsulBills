import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { invoiceId, amount, currency, invoiceDesc, clientEmail, stripeSecretKey, successUrl, cancelUrl } = req.body;

    if (!stripeSecretKey) {
      return res.status(400).json({ error: 'Stripe Secret Key no enviada.' });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: clientEmail || undefined,
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: invoiceDesc || `Factura #${invoiceId}`,
            },
            unit_amount: Math.round(amount * 100), // Stripe uses cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      metadata: {
        invoiceId: invoiceId,
        konsulSystem: 'true'
      },
      success_url: successUrl || req.headers.referer || 'https://konsul.app/success',
      cancel_url: cancelUrl || req.headers.referer || 'https://konsul.app/cancel',
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Stripe Checkout Error:', error);
    return res.status(500).json({ error: 'Error al generar enlace de Stripe', details: error.message });
  }
}
