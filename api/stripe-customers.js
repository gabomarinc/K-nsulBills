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

    // Fetch last 100 customers
    const customers = await stripe.customers.list({
      limit: 100,
      expand: ['data.subscriptions'] // Optional: in case we want to show subscription info later
    });

    const formattedCustomers = customers.data.map(c => ({
      id: c.id,
      name: c.name || c.description || 'Sin Nombre',
      email: c.email || '',
      description: c.description || '',
      created: c.created
    }));

    return res.status(200).json({ success: true, customers: formattedCustomers });
  } catch (error) {
    console.error('Stripe Customers Fetch Error:', error);
    return res.status(500).json({ error: 'Error al obtener clientes de Stripe', details: error.message });
  }
}
