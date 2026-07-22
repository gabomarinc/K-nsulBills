import { Client } from '@neondatabase/serverless';
import { validateApiKey } from '../_auth.js';

export default async function handler(req, res) {
  const auth = await validateApiKey(req, res);
  if (!auth) return; // Response sent by validateApiKey

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return res.status(500).json({ error: 'Database connection string (DATABASE_URL) missing' });
  }

  const client = new Client(dbUrl);

  try {
    await client.connect();

    // Ensure table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        client_name TEXT,
        client_tax_id TEXT,
        total NUMERIC,
        status TEXT,
        date TEXT,
        type TEXT,
        data JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    const userId = req.body?.userId || req.query.userId || auth.userId;

    // --- GET /api/v1/invoices ---
    if (req.method === 'GET') {
      const { status, type, clientName, search, id } = req.query;

      if (id) {
        const { rows } = await client.query(
          `SELECT * FROM invoices WHERE id = $1 AND (user_id = $2 OR data->>'userId' = $2)`,
          [id, userId]
        );
        await client.end();
        if (rows.length === 0) {
          return res.status(404).json({ error: 'Invoice not found' });
        }
        return res.status(200).json({ success: true, data: rows[0].data || rows[0] });
      }

      let queryStr = `SELECT * FROM invoices WHERE (user_id = $1 OR data->>'userId' = $1)`;
      const params = [userId];

      if (status) {
        params.push(status);
        queryStr += ` AND status = $${params.length}`;
      }

      if (type) {
        params.push(type);
        queryStr += ` AND type = $${params.length}`;
      }

      if (clientName || search) {
        params.push(`%${clientName || search}%`);
        queryStr += ` AND client_name ILIKE $${params.length}`;
      }

      queryStr += ` ORDER BY created_at DESC LIMIT 100`;

      const { rows } = await client.query(queryStr, params);
      await client.end();

      const items = rows.map(r => r.data || {
        id: r.id,
        clientName: r.client_name,
        clientTaxId: r.client_tax_id,
        total: parseFloat(r.total),
        status: r.status,
        date: r.date,
        type: r.type
      });

      return res.status(200).json({
        success: true,
        count: items.length,
        data: items
      });
    }

    // --- POST /api/v1/invoices (Create Invoice/Quote) ---
    if (req.method === 'POST') {
      const body = req.body || {};

      if (!body.clientName && !body.client_name) {
        await client.end();
        return res.status(400).json({ error: 'clientName is required' });
      }

      const clientName = body.clientName || body.client_name;
      const type = body.type || 'Invoice';
      const docStatus = body.status || 'Creada';
      const currency = body.currency || 'USD';
      const docDate = body.date || new Date().toISOString();
      const dueDate = body.dueDate || body.validityDate || docDate;

      // Handle items (can pass raw items array or total directly for simplified AI calls)
      let items = body.items || [];
      if (items.length === 0 && (body.total || body.amount)) {
        items = [{
          id: '1',
          description: body.concept || body.description || 'Servicio Profesional',
          quantity: 1,
          price: parseFloat(body.total || body.amount),
          tax: body.tax || 0
        }];
      }

      const totalAmount = body.total !== undefined ? parseFloat(body.total) : 
        items.reduce((acc, i) => acc + ((i.price * i.quantity) + (i.tax || 0)), 0);

      // Auto ID Generation if not provided
      let id = body.id;
      if (!id) {
        const prefix = type === 'Invoice' ? 'FAC' : 'COT';
        const numRes = await client.query(
          `SELECT COUNT(*) as cnt FROM invoices WHERE type = $1 AND (user_id = $2 OR data->>'userId' = $2)`,
          [type, userId]
        );
        const count = parseInt(numRes.rows[0].cnt || '0', 10) + 1;
        id = `${prefix}-${String(count).padStart(4, '0')}`;
      }

      const invoiceData = {
        id,
        userId,
        clientName,
        clientTaxId: body.clientTaxId || body.client_tax_id || '',
        clientEmail: body.clientEmail || body.email || '',
        clientAddress: body.clientAddress || body.address || '',
        date: docDate,
        dueDate: dueDate,
        items,
        total: totalAmount,
        currency,
        status: docStatus,
        type,
        notes: body.notes || '',
        timeline: [
          {
            id: Date.now().toString(),
            type: 'CREATED',
            title: `Documento creado vía API (${type})`,
            timestamp: new Date().toISOString()
          }
        ],
        recurrence: body.recurrence || (body.isRecurrent ? {
          isRecurrent: true,
          frequency: body.frequency || 'MONTHLY',
          totalCycles: body.totalCycles || 12
        } : undefined)
      };

      const query = `
        INSERT INTO invoices (id, user_id, client_name, client_tax_id, total, status, date, type, data)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET 
          user_id = EXCLUDED.user_id, client_name = EXCLUDED.client_name, client_tax_id = EXCLUDED.client_tax_id,
          total = EXCLUDED.total, status = EXCLUDED.status, date = EXCLUDED.date, data = EXCLUDED.data;
      `;

      await client.query(query, [
        id, userId, clientName, invoiceData.clientTaxId, totalAmount, docStatus, docDate, type, JSON.stringify(invoiceData)
      ]);

      // Auto-save Client/Prospect in DB so it shows up in client list
      try {
        const clientTable = docStatus === 'Aceptada' || type === 'Invoice' ? 'clients' : 'prospects';
        const safeName = clientName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const clientId = `cli_${userId.substring(0, 8)}_${safeName}`;
        
        await client.query(`
          INSERT INTO ${clientTable} (id, user_id, name, tax_id, email, updated_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (id) DO UPDATE SET 
            tax_id = COALESCE(EXCLUDED.tax_id, ${clientTable}.tax_id),
            email = COALESCE(EXCLUDED.email, ${clientTable}.email),
            updated_at = NOW();
        `, [clientId, userId, clientName, invoiceData.clientTaxId || null, invoiceData.clientEmail || null]);
      } catch (e) {
        console.error("API Auto-client Save Notice:", e.message);
      }

      await client.end();
      return res.status(201).json({
        success: true,
        message: `${type === 'Invoice' ? 'Factura' : 'Cotización'} creada exitosamente`,
        data: invoiceData
      });
    }

    // --- PUT /api/v1/invoices (Update Status / Invoice) ---
    if (req.method === 'PUT') {
      const body = req.body || {};
      const id = body.id || req.query.id;

      if (!id) {
        await client.end();
        return res.status(400).json({ error: 'Invoice ID is required' });
      }

      const { rows } = await client.query(`SELECT * FROM invoices WHERE id = $1`, [id]);
      if (rows.length === 0) {
        await client.end();
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const existingData = rows[0].data || {};
      const newStatus = body.status || existingData.status;

      const updatedData = {
        ...existingData,
        ...body,
        status: newStatus,
        timeline: [
          ...(existingData.timeline || []),
          {
            id: Date.now().toString(),
            type: 'STATUS_CHANGE',
            title: `Estado actualizado a ${newStatus} vía API`,
            timestamp: new Date().toISOString()
          }
        ]
      };

      await client.query(
        `UPDATE invoices SET status = $1, total = $2, data = $3 WHERE id = $4`,
        [newStatus, updatedData.total, JSON.stringify(updatedData), id]
      );

      await client.end();
      return res.status(200).json({
        success: true,
        message: 'Documento actualizado exitosamente',
        data: updatedData
      });
    }

    // --- DELETE /api/v1/invoices ---
    if (req.method === 'DELETE') {
      const id = req.query.id || req.body?.id;
      if (!id) {
        await client.end();
        return res.status(400).json({ error: 'Invoice ID is required' });
      }

      await client.query(`DELETE FROM invoices WHERE id = $1`, [id]);
      await client.end();
      return res.status(200).json({ success: true, message: `Documento ${id} eliminado` });
    }

    await client.end();
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error("API Invoices Error:", error);
    try { await client.end(); } catch (e) {}
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
