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

    await client.query(`
      CREATE TABLE IF NOT EXISTS catalog_items (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        price NUMERIC NOT NULL,
        cost NUMERIC,
        description TEXT,
        is_recurring BOOLEAN DEFAULT FALSE,
        sku TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    const userId = req.body?.userId || req.query.userId || auth.userId;

    // --- GET /api/v1/catalog ---
    if (req.method === 'GET') {
      const { search } = req.query;
      let queryStr = `SELECT * FROM catalog_items WHERE user_id = $1`;
      const params = [userId];

      if (search) {
        params.push(`%${search}%`);
        queryStr += ` AND (name ILIKE $${params.length} OR description ILIKE $${params.length})`;
      }

      queryStr += ` ORDER BY created_at DESC`;

      const { rows } = await client.query(queryStr, params);
      await client.end();

      const items = rows.map(r => ({
        id: r.id,
        name: r.name,
        price: parseFloat(r.price),
        cost: r.cost ? parseFloat(r.cost) : undefined,
        description: r.description,
        isRecurring: r.is_recurring,
        sku: r.sku
      }));

      return res.status(200).json({ success: true, count: items.length, data: items });
    }

    // --- POST /api/v1/catalog ---
    if (req.method === 'POST') {
      const body = req.body || {};
      if (!body.name || body.price === undefined) {
        await client.end();
        return res.status(400).json({ error: 'Name and price are required' });
      }

      const id = body.id || `item_${Date.now()}`;
      const name = body.name;
      const price = parseFloat(body.price);
      const cost = body.cost !== undefined ? parseFloat(body.cost) : null;
      const description = body.description || null;
      const isRecurring = body.isRecurring || false;
      const sku = body.sku || null;

      const upsert = `
        INSERT INTO catalog_items (id, user_id, name, price, cost, description, is_recurring, sku, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          price = EXCLUDED.price,
          cost = EXCLUDED.cost,
          description = EXCLUDED.description,
          is_recurring = EXCLUDED.is_recurring,
          sku = EXCLUDED.sku,
          updated_at = NOW();
      `;

      await client.query(upsert, [id, userId, name, price, cost, description, isRecurring, sku]);
      await client.end();

      return res.status(201).json({
        success: true,
        message: 'Item de catálogo guardado',
        data: { id, name, price, cost, description, isRecurring, sku }
      });
    }

    // --- DELETE /api/v1/catalog ---
    if (req.method === 'DELETE') {
      const id = req.query.id || req.body?.id;
      if (!id) {
        await client.end();
        return res.status(400).json({ error: 'Item ID is required' });
      }

      await client.query(`DELETE FROM catalog_items WHERE id = $1 AND user_id = $2`, [id, userId]);
      await client.end();
      return res.status(200).json({ success: true, message: `Item ${id} eliminado` });
    }

    await client.end();
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error("API Catalog Error:", error);
    try { await client.end(); } catch (e) {}
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
