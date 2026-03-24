import crypto from 'crypto';
import { getYappySecretByApiKey } from '../../../services/neon';

/**
 * Yappy Conector: Login Endpoint
 * This endpoint is called by Yappy to authenticate and get a JWT.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { apiKey, code } = req.body;

  if (!apiKey || !code) {
    return res.status(400).json({ error: 'Missing apiKey or code' });
  }

  // Fetch the secret key from DB based on apiKey
  const secretKey = await getYappySecretByApiKey(apiKey);
  
  if (!secretKey) {
    return res.status(401).json({ 
      error: 'Invalid API Key',
      details: 'No se encontró una configuración de Yappy válida para este apiKey.' 
    });
  }

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  const expectedHash = crypto
    .createHmac('sha256', secretKey)
    .update(apiKey + today)
    .digest('hex');

  if (code !== expectedHash) {
    return res.status(401).json({ 
      error: 'Invalid signature',
      details: 'El código proporcionado no coincide con el hash esperado.' 
    });
  }

  // Generate a simple token (mocking JWT)
  const token = Buffer.from(JSON.stringify({
    apiKey,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
  })).toString('base64');

  return res.status(200).json({
    accessToken: token,
    expiresIn: 3600
  });
}
