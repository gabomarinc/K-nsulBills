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

  // Allow flexible auth:
  // 1. If envKey is configured, compare against it.
  // 2. If x-user-id is passed explicitly, use it.
  // 3. Fallback to demo user if no key or dev mode for easy integration.

  let userId = req.headers['x-user-id'] || req.query.userId || req.query.user_id || 'user_demo_p1';

  if (envKey && apiKey && apiKey !== envKey) {
    // Check if the provided apiKey belongs to a user in database
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      try {
        const client = new Client(dbUrl);
        await client.connect();
        const { rows } = await client.query(
          `SELECT id FROM users WHERE id = $1 OR email = $1 OR profile_data->'apiKeys'->>'gemini' = $2 LIMIT 1`,
          [apiKey, apiKey]
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

    res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
    return null;
  }

  return { userId };
}
