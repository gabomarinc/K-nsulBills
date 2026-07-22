import { Client } from '@neondatabase/serverless';
import { validateApiKey } from '../_auth.js';

export default async function handler(req, res) {
  const auth = await validateApiKey(req, res);
  if (!auth) return;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return res.status(500).json({ error: 'Database connection string (DATABASE_URL) missing' });
  }

  const client = new Client(dbUrl);

  try {
    await client.connect();

    const userId = req.query.userId || auth.userId;

    const invoicesRes = await client.query(
      `SELECT * FROM invoices WHERE user_id = $1 OR data->>'userId' = $1`,
      [userId]
    );
    const clientsRes = await client.query(
      `SELECT COUNT(*) as cnt FROM clients WHERE user_id = $1`,
      [userId]
    );
    const prospectsRes = await client.query(
      `SELECT COUNT(*) as cnt FROM prospects WHERE user_id = $1`,
      [userId]
    );

    await client.end();

    const docs = invoicesRes.rows.map(r => r.data || r);

    const invoices = docs.filter(d => d.type === 'Invoice');
    const quotes = docs.filter(d => d.type === 'Quote');
    const expenses = docs.filter(d => d.type === 'Expense');

    const totalInvoiced = invoices
      .filter(i => i.status !== 'Borrador' && i.status !== 'Rechazada')
      .reduce((acc, i) => acc + (parseFloat(i.total) || 0), 0);

    const totalPaid = invoices
      .filter(i => i.status === 'Pagada' || i.status === 'Aceptada')
      .reduce((acc, i) => acc + (parseFloat(i.total) || 0), 0);

    const totalPending = invoices
      .filter(i => ['Creada', 'Enviada', 'Seguimiento', 'Abonada'].includes(i.status))
      .reduce((acc, i) => acc + (parseFloat(i.total) || 0), 0);

    const totalQuoted = quotes
      .filter(q => q.status !== 'Rechazada')
      .reduce((acc, q) => acc + (parseFloat(q.total) || 0), 0);

    const totalExpenses = expenses
      .reduce((acc, e) => acc + (parseFloat(e.total) || 0), 0);

    return res.status(200).json({
      success: true,
      summary: {
        totalInvoiced,
        totalPaid,
        totalPending,
        totalQuoted,
        totalExpenses,
        netBalance: totalPaid - totalExpenses,
        counts: {
          invoicesCount: invoices.length,
          quotesCount: quotes.length,
          expensesCount: expenses.length,
          clientsCount: parseInt(clientsRes.rows[0]?.cnt || '0', 10),
          prospectsCount: parseInt(prospectsRes.rows[0]?.cnt || '0', 10)
        }
      }
    });
  } catch (error) {
    console.error("API Summary Error:", error);
    try { await client.end(); } catch (e) {}
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
