
/**
 * Stateless Yappy JWT Proxy to bypass CORS
 * Implements the official key derivation logic.
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
    // DERIVE MERCHANT SECRET: Base64 decode and take the second part (index 1)
    let derivedSecret = secretKey;
    try {
      const decoded = Buffer.from(secretKey, 'base64').toString('utf8');
      const parts = decoded.split('.');
      if (parts.length >= 2) {
        derivedSecret = parts[1];
      }
    } catch (e) {
      console.warn('Secret derivation failed, using raw key:', e);
    }

    const jwtRes = await fetch('https://pagosbg.bgeneral.com/validateapikeymerchand', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': derivedSecret,
        'version': 'P1.0.0'
      },
      body: JSON.stringify({
        merchantId: apiKey,
        urlDomain: domain
      })
    });

    const jwtData = await jwtRes.json();
    if (!jwtRes.ok) {
        return res.status(jwtRes.status).json({ 
            error: 'BGeneral Handshake Failed', 
            details: jwtData,
            usedApiKey: apiKey,
            usedDomain: domain
        });
    }

    return res.status(200).json(jwtData);
  } catch (error) {
    console.error('Yappy Proxy Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}
