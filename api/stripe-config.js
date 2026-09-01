export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || '';

  if (!publishableKey) {
    return res.status(200).json({
      publishableKey: '',
      configured: false,
      message: 'Stripe is not configured. Contact evanbaker127@gmail.com for custom pricing.',
    });
  }

  return res.status(200).json({ publishableKey, configured: true });
}
