
import { getYappyConfigByApiKey } from '../../../services/neon';

/**
 * Minimal Yappy JWT Proxy to bypass CORS
 * This function only fetches the access token from BGeneral.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { apiKey, domain } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: 'Missing apiKey' });
  }

  try {
    const config = await getYappyConfigByApiKey(apiKey);
    if (!config || !config.yappySecretKey) {
      return res.status(404).json({ error: 'Config not found' });
    }

    const jwtRes = await fetch('https://pagosbg.bgeneral.com/validateapikeymerchand', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.yappySecretKey,
        'version': 'P1.0.0'
      },
      body: JSON.stringify({
        merchantId: apiKey,
        urlDomain: domain
      })
    });

    const jwtData = await jwtRes.json();
    return res.status(jwtRes.status).json(jwtData);
  } catch (error) {
    console.error('Yappy Proxy Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}
