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

    // Ensure clients and prospects tables exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS clients (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS prospects (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL);
      
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS tax_id TEXT;
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS email TEXT;
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone TEXT;
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS tags TEXT;
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS tax_id TEXT;
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS email TEXT;
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS phone TEXT;
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS tags TEXT;
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE prospects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
    `);

    const userId = req.body?.userId || req.query.userId || auth.userId;

    // --- GET /api/v1/clients ---
    if (req.method === 'GET') {
      const { status, search, email } = req.query;

      let clientsRows = [];
      let prospectsRows = [];

      if (!status || status === 'CLIENT') {
        let q = `SELECT id, name, tax_id, email, address, phone, tags, notes, 'CLIENT' as status FROM clients WHERE user_id = $1`;
        const params = [userId];
        if (search) {
          params.push(`%${search}%`);
          q += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length})`;
        }
        if (email) {
          params.push(email);
          q += ` AND email = $${params.length}`;
        }
        const resC = await client.query(q, params);
        clientsRows = resC.rows;
      }

      if (!status || status === 'PROSPECT') {
        let q = `SELECT id, name, tax_id, email, address, phone, tags, notes, 'PROSPECT' as status FROM prospects WHERE user_id = $1`;
        const params = [userId];
        if (search) {
          params.push(`%${search}%`);
          q += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length})`;
        }
        if (email) {
          params.push(email);
          q += ` AND email = $${params.length}`;
        }
        const resP = await client.query(q, params);
        prospectsRows = resP.rows;
      }

      await client.end();

      const all = [...clientsRows, ...prospectsRows].map(r => ({
        id: r.id,
        name: r.name,
        taxId: r.tax_id,
        email: r.email,
        address: r.address,
        phone: r.phone,
        tags: r.tags,
        notes: r.notes,
        status: r.status
      }));

      return res.status(200).json({ success: true, count: all.length, data: all });
    }

    // --- POST /api/v1/clients (Create/Update Client or Prospect) ---
    if (req.method === 'POST') {
      const body = req.body || {};

      if (!body.name) {
        await client.end();
        return res.status(400).json({ error: 'Client name is required' });
      }

      const name = body.name;
      const status = (body.status || 'PROSPECT').toUpperCase(); // 'CLIENT' or 'PROSPECT'
      const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const id = body.id || `cli_${userId.substring(0, 8)}_${safeName}`;

      const targetTable = status === 'CLIENT' ? 'clients' : 'prospects';

      const upsertQuery = `
        INSERT INTO ${targetTable} (id, user_id, name, tax_id, email, address, phone, tags, notes, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (id) DO UPDATE SET 
          name = EXCLUDED.name,
          tax_id = COALESCE(EXCLUDED.tax_id, ${targetTable}.tax_id),
          email = COALESCE(EXCLUDED.email, ${targetTable}.email),
          address = COALESCE(EXCLUDED.address, ${targetTable}.address),
          phone = COALESCE(EXCLUDED.phone, ${targetTable}.phone),
          tags = COALESCE(EXCLUDED.tags, ${targetTable}.tags),
          notes = COALESCE(EXCLUDED.notes, ${targetTable}.notes),
          updated_at = NOW();
      `;

      await client.query(upsertQuery, [
        id,
        userId,
        name,
        body.taxId || body.tax_id || null,
        body.email || null,
        body.address || null,
        body.phone || null,
        body.tags || null,
        body.notes || null
      ]);

      if (status === 'CLIENT') {
        // Remove from prospects if promoted
        await client.query(`DELETE FROM prospects WHERE id = $1`, [id]);
      }

      await client.end();

      return res.status(201).json({
        success: true,
        message: `${status === 'CLIENT' ? 'Cliente' : 'Prospecto'} guardado exitosamente`,
        data: {
          id,
          name,
          email: body.email,
          phone: body.phone,
          status
        }
      });
    }

    // --- DELETE /api/v1/clients ---
    if (req.method === 'DELETE') {
      const id = req.query.id || req.body?.id;
      if (!id) {
        await client.end();
        return res.status(400).json({ error: 'Client ID is required' });
      }

      await client.query(`DELETE FROM clients WHERE id = $1 AND user_id = $2`, [id, userId]);
      await client.query(`DELETE FROM prospects WHERE id = $1 AND user_id = $2`, [id, userId]);
      await client.end();

      return res.status(200).json({ success: true, message: `Cliente ${id} eliminado` });
    }

    await client.end();
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error("API Clients Error:", error);
    try { await client.end(); } catch (e) {}
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
