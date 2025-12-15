
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  const { sessionId } = req.query;

  if (!sessionId) {
    return res.status(400).json({ error: 'Missing session_id' });
  }

  try {
    // 1. Retrieve the Checkout Session to get the Customer ID and Subscription ID
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    let renewalDate = null;
    let planName = 'Emprendedor Pro';

    // 2. Retrieve Subscription details to get the exact renewal date (current_period_end)
    if (session.subscription) {
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      // Stripe timestamps are in seconds, convert to JS Date
      renewalDate = new Date(subscription.current_period_end * 1000).toISOString();
    } else {
        // Fallback for one-time payments or trials (1 month from now)
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        renewalDate = d.toISOString();
    }

    return res.status(200).json({
      customerId: session.customer,
      renewalDate: renewalDate,
      plan: planName
    });
  } catch (error) {
    console.error('Stripe Session Retrieval Error:', error);
    return res.status(500).json({ error: 'Failed to retrieve session details from Stripe' });
  }
}
