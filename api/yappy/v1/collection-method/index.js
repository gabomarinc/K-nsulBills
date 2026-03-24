
/**
 * Yappy Conector: Collection Method Endpoint
 * Returns enabled payment methods for this merchant.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Standard Yappy Conector response for collection methods
  return res.status(200).json({
    success: true,
    data: [
      {
        id: 'YAPPY',
        name: 'Yappy',
        status: 'ACTIVE'
      }
    ]
  });
}
