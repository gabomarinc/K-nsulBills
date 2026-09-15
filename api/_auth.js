import { Client } from '@neondatabase/serverless';

export function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-user-id');
}

export async function validateApiKey(req, res) {
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return null;
  }

  const apiKey = req.headers['x-api-key'] || 
                 (req.headers['authorization'] ? req.headers['authorization'].replace('Bearer ', '').trim() : null) || 
                 req.query.api_key ||
                 req.query.apiKey;

  const envKey = process.env.KONSUL_API_KEY || process.env.BILL_API_KEY || process.env.API_KEY;

  let userId = req.headers['x-user-id'] || req.query.userId || req.query.user_id || null;
  const userEmail = req.headers['x-user-email'] || req.query.user_email || null;

  const internalKey = process.env.INTERNAL_API_KEY || process.env.KONSUL_ECOSYSTEM_SECRET_KEY || 'konsul_ecosystem_secret_key';
  const isSsoKey = apiKey && (apiKey === internalKey || apiKey.startsWith('konsul_sso_') || apiKey.startsWith('kb_live_sso_'));

  const dbUrl = process.env.DATABASE_URL;

  if (isSsoKey) {
    if (dbUrl && (userEmail || userId)) {
      try {
        const client = new Client(dbUrl);
        await client.connect();
        const { rows } = await client.query(
          `SELECT id FROM users WHERE id = $1 OR email = $2 LIMIT 1`,
          [userId || '', userEmail || '']
        );
        await client.end();
        if (rows.length > 0) {
          userId = rows[0].id;
          return { userId };
        }
      } catch (e) {
        console.error("SSO DB Lookup Error:", e);
      }
    }
    return { userId: userId || 'user_demo_p1' };
  }

  // Check if the provided apiKey or userEmail belongs to a user in database
  if (dbUrl) {
    try {
      const client = new Client(dbUrl);
      await client.connect();
      const { rows } = await client.query(
        `SELECT id FROM users WHERE id = $1 OR email = $1 OR email = $3 OR profile_data->'apiKeys'->>'konsul' = $2 OR profile_data->'apiKeys'->>'gemini' = $2 LIMIT 1`,
        [apiKey || '', apiKey || '', userEmail || '']
      );
      await client.end();
      if (rows.length > 0) {
        userId = rows[0].id;
        return { userId };
      }
    } catch (e) {
      console.error("API Auth DB Lookup Error:", e);
    }
  }

  if (envKey && apiKey && apiKey !== envKey) {
    res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
    return null;
  }

  return { userId: userId || 'user_demo_p1' };
}
