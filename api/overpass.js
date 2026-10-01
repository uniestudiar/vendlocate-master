const OVERPASS_ENDPOINTS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

async function fetchEndpoint(endpoint, query) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'Vendlocate/1.0',
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      return { error: `${endpoint} returned HTTP ${response.status}` };
    }
    const data = await response.json();
    if (data && data.elements) return data;
    return { error: `${endpoint} returned an invalid response` };
  } catch {
    return { error: `${endpoint} could not be reached` };
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter' });
  }

  // Race all endpoints in parallel
  const results = await Promise.allSettled(
    OVERPASS_ENDPOINTS.map(ep => fetchEndpoint(ep, query))
  );

  const errors = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value && !r.value.error) {
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
      return res.status(200).json(r.value);
    }
    if (r.status === 'fulfilled' && r.value?.error) errors.push(r.value.error);
    if (r.status === 'rejected') errors.push(r.reason?.message || 'Unknown Overpass error');
  }

  return res.status(502).json({
    error: `All Overpass endpoints failed${errors.length ? `: ${errors.join('; ')}` : ''}`,
  });
}
