
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Missing Resend API Key in server environment' });
  }

  try {
    const body = req.body;

    // Call Resend API from the server side
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: data.message || 'Error sending email',
        details: data 
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Resend Proxy Error:', error);
    return res.status(500).json({ error: 'Internal Server Error sending email' });
  }
}
