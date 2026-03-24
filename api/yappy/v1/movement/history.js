
import { Client } from '@neondatabase/serverless';

/**
 * Yappy Conector: Movement History Endpoint
 * This endpoint is called by Yappy to check the status of a payment.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', details: 'Missing or invalid token' });
  }

  const { orderId } = req.body;
  if (!orderId) {
    return res.status(400).json({ error: 'Missing orderId' });
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return res.status(500).json({ error: 'Database configuration missing' });
  }

  const client = new Client(dbUrl);
  
  try {
    await client.connect();
    
    // Look up the invoice by ID (which we use as orderId in Yappy)
    const query = `SELECT id, total, status, date, data FROM invoices WHERE id = $1`;
    const { rows } = await client.query(query, [orderId]);
    await client.end();

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const invoice = rows[0];
    const isPaid = invoice.status === 'Pagada';

    // Format response according to Yappy specs
    // (Assuming these fields based on standard conector protocols)
    return res.status(200).json({
      success: true,
      data: {
        orderId: invoice.id,
        status: isPaid ? 'COMPLETED' : 'PENDING',
        amount: parseFloat(invoice.total),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("Yappy Movement Error:", error);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
