
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { plan, email, userId } = req.body;
  const origin = req.headers.origin || 'http://localhost:5173';

  // Define plans
  // NOTE: In production, use Price IDs from your Stripe Dashboard instead of inline price_data
  let priceData = null;

  if (plan === 'Emprendedor Pro') {
    priceData = {
      currency: 'usd',
      product_data: {
        name: 'Kônsul - Plan Emprendedor Pro',
        description: 'Facturación ilimitada, IA básica y soporte estándar.',
      },
      unit_amount: 1500, // $15.00
      recurring: { interval: 'month' },
    };
  } else if (plan === 'Empresa Scale') {
    priceData = {
      currency: 'usd',
      product_data: {
        name: 'Kônsul - Plan Empresa Scale',
        description: 'IA Avanzada, multi-usuario y soporte prioritario.',
      },
      unit_amount: 3500, // $35.00
      recurring: { interval: 'month' },
    };
  } else {
    return res.status(400).json({ error: 'Invalid plan selected' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: priceData,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${origin}/?session_id={CHECKOUT_SESSION_ID}&payment_success=true`,
      cancel_url: `${origin}/?payment_canceled=true`,
      customer_email: email,
      client_reference_id: userId,
      metadata: {
        userId: userId,
        plan: plan
      }
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Stripe Error:', error);
    return res.status(500).json({ error: 'Error creating checkout session' });
  }
}
