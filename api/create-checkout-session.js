
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { plan, email, userId } = req.body;
  const origin = req.headers.origin || 'http://localhost:5173';

  // We only support one plan for this test flow, linked to a specific Product ID
  // The product ID provided is: prod_Tb5hEomvGYQEhh
  // We use price_data to define the cost on the fly while linking to the existing product.
  
  const priceData = {
    currency: 'usd',
    product: 'prod_Tb5hEomvGYQEhh', // Explicitly linking to the existing Stripe Product
    unit_amount: 1500, // $15.00 - Standard Pro Rate
    recurring: { interval: 'month' },
  };

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
        plan: 'Emprendedor Pro' // Keeping metadata consistent
      }
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Stripe Error:', error);
    return res.status(500).json({ error: 'Error creating checkout session' });
  }
}
