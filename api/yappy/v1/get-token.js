
/**
 * Stateless Yappy JWT Proxy to bypass CORS (V1 Endpoint)
 * Correctly splits the secretKey into HMAC and API parts.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { apiKey, secretKey, domain } = req.body;

  if (!apiKey || !secretKey) {
    return res.status(400).json({ error: 'Missing apiKey or secretKey' });
  }

  try {
    // DERIVE API KEY: Base64 decode and take the SECOND part (index 1)
    let derivedApiKey = secretKey;
    try {
      const decoded = Buffer.from(secretKey, 'base64').toString('utf8');
      const parts = decoded.split('.');
      if (parts.length >= 2) {
        derivedApiKey = parts[1]; // Index 1 is the API Key for the header
      }
    } catch (e) {
      console.warn('Secret decoding failed, using raw key for header:', e);
    }

    const jwtRes = await fetch('https://pagosbg.bgeneral.com/validateapikeymerchand', {
      method: 'POST',
      headers: {
        'x-api-key': derivedApiKey,
        'version': 'P1.0.0'
      }
    });

    const jwtData = await jwtRes.json();
    if (!jwtRes.ok) {
        return res.status(jwtRes.status).json({ 
            error: 'BGeneral Handshake Failed', 
            details: jwtData,
            usedApiKey: derivedApiKey
        });
    }

    return res.status(200).json(jwtData);
  } catch (error) {
    console.error('Yappy Proxy Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}
