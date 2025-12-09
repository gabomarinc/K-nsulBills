
export default async function handler(req, res) {
  const { id } = req.query;
  const apiKey = process.env.RESEND_API_KEY;

  if (!id || !apiKey) {
    return res.status(400).json({ error: 'Missing ID or API Key' });
  }

  try {
    const response = await fetch(`https://api.resend.com/emails/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
        return res.status(response.status).json({ error: 'Failed to fetch status' });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}