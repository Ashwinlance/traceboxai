const ENDPOINTS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter'
];

function parseNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const lat = parseNumber(req.query?.lat, 13.0417);
  const lng = parseNumber(req.query?.lng, 80.2367);
  const radius = Math.min(1000, Math.max(50, Math.round(parseNumber(req.query?.radius, 320))));

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'Invalid map coordinates' });
  }

  const query = `[out:json][timeout:18];way["building"](around:${radius},${lat},${lng});out geom;`;
  let lastError = 'No Overpass endpoint responded';

  for (const endpoint of ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!response.ok) {
        lastError = `${endpoint} returned ${response.status}`;
        continue;
      }

      const payload = await response.json();
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
      res.setHeader('X-TraceBox-Overpass-Source', endpoint);
      return res.status(200).json(payload);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  return res.status(502).json({
    error: 'Live building reference service is temporarily unavailable',
    detail: lastError
  });
}
