const UPSTREAMS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter'
];

async function upstreamFetch(endpoint, query) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        Accept: 'application/json',
        'User-Agent': 'TraceBoxAI-SIH26012/1.0'
      },
      body: new URLSearchParams({ data: query }),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST required' });
  }

  const query = typeof req.body === 'string' ? req.body : req.body?.data;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Missing Overpass query' });
  }

  const failures = [];
  for (const endpoint of UPSTREAMS) {
    try {
      const response = await upstreamFetch(endpoint, query);
      if (!response.ok) {
        failures.push(`${new URL(endpoint).host}:${response.status}`);
        continue;
      }
      const payload = await response.json();
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
      return res.status(200).json(payload);
    } catch (error) {
      failures.push(`${new URL(endpoint).host}:${error instanceof Error ? error.message : 'failed'}`);
    }
  }

  return res.status(502).json({
    error: 'All live building-reference sources failed',
    attempts: failures
  });
}
