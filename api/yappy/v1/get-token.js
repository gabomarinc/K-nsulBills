
/**
 * Stateless Yappy JWT Proxy to bypass CORS
 * No DB dependencies to avoid 500 errors in Vercel.
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
    const jwtRes = await fetch('https://pagosbg.bgeneral.com/validateapikeymerchand', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': secretKey,
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
