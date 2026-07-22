import { Client } from '@neondatabase/serverless';
import { validateApiKey } from '../_auth.js';

export default async function handler(req, res) {
  const auth = await validateApiKey(req, res);
  if (!auth) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST for webhooks/integrations.' });
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return res.status(500).json({ error: 'Database connection string (DATABASE_URL) missing' });
  }

  const client = new Client(dbUrl);

  try {
    await client.connect();

    const body = req.body || {};
    const event = body.event || body.type || 'lead.created';
    const data = body.data || body.payload || body;
    const userId = body.userId || auth.userId;

    // --- CASE 1: Sync Lead / Customer from LeadsHUB ---
    if (event.includes('lead') || event.includes('contact') || event.includes('customer')) {
      const clientName = data.name || data.clientName || data.contactName || 'Lead sin nombre';
      const email = data.email || data.contactEmail || null;
      const phone = data.phone || data.contactPhone || data.whatsapp || null;
      const notes = data.notes || data.conversationSummary || `Importado desde LeadsHUB (Agente: ${data.agentName || 'IA'})`;
      const status = data.isClosedDeal || data.isCustomer ? 'CLIENT' : 'PROSPECT';

      const safeName = clientName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const id = data.id ? `leadshub_${data.id}` : `cli_${userId.substring(0, 8)}_${safeName}`;

      const targetTable = status === 'CLIENT' ? 'clients' : 'prospects';

      await client.query(`
        CREATE TABLE IF NOT EXISTS clients (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS prospects (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL);
      `);

      const upsertQuery = `
        INSERT INTO ${targetTable} (id, user_id, name, email, phone, notes, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (id) DO UPDATE SET 
          name = EXCLUDED.name,
          email = COALESCE(EXCLUDED.email, ${targetTable}.email),
          phone = COALESCE(EXCLUDED.phone, ${targetTable}.phone),
          notes = COALESCE(EXCLUDED.notes, ${targetTable}.notes),
          updated_at = NOW();
      `;

      await client.query(upsertQuery, [id, userId, clientName, email, phone, notes]);
      await client.end();

      return res.status(200).json({
        success: true,
        action: 'LEAD_SYNCED',
        message: `Lead ${clientName} sincronizado correctamente en K-nsulBills`,
        clientId: id
      });
    }

    // --- CASE 2: Create Bill/Quote via AI Agent Tool Call ---
    if (event.includes('invoice') || event.includes('bill') || event.includes('quote')) {
      const clientName = data.clientName || data.name || 'Cliente sin nombre';
      const total = parseFloat(data.total || data.amount || 0);
      const docType = (data.type || 'Invoice').toLowerCase().includes('quote') || (data.type || '').toLowerCase().includes('cotiz') ? 'Quote' : 'Invoice';
      const concept = data.concept || data.description || 'Servicio prestado';

      const numRes = await client.query(
        `SELECT COUNT(*) as cnt FROM invoices WHERE type = $1 AND (user_id = $2 OR data->>'userId' = $2)`,
        [docType, userId]
      );
      const count = parseInt(numRes.rows[0].cnt || '0', 10) + 1;
      const prefix = docType === 'Invoice' ? 'FAC' : 'COT';
      const id = `${prefix}-${String(count).padStart(4, '0')}`;

      const invoiceData = {
        id,
        userId,
        clientName,
        clientEmail: data.email || '',
        date: new Date().toISOString(),
        items: [{ id: '1', description: concept, quantity: 1, price: total, tax: 0 }],
        total,
        currency: data.currency || 'USD',
        status: data.status || 'Creada',
        type: docType,
        notes: `Generado automáticamente por LeadsHUB (Agente de IA)`,
        timeline: [{
          id: Date.now().toString(),
          type: 'CREATED',
          title: 'Creado por Agente LeadsHUB',
          timestamp: new Date().toISOString()
        }]
      };

      await client.query(
        `INSERT INTO invoices (id, user_id, client_name, total, status, date, type, data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, userId, clientName, total, invoiceData.status, invoiceData.date, docType, JSON.stringify(invoiceData)]
      );

      await client.end();

      return res.status(201).json({
        success: true,
        action: 'DOCUMENT_CREATED',
        message: `${docType === 'Invoice' ? 'Factura' : 'Cotización'} ${id} creada con éxito`,
        document: invoiceData
      });
    }

    await client.end();
    return res.status(200).json({ success: true, message: 'Webhook event received', event });
  } catch (error) {
    console.error("API LeadsHUB Webhook Error:", error);
    try { await client.end(); } catch (e) {}
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
