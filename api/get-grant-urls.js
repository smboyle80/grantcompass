export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const key = process.env.TINYFISH_API_KEY;
  if (!key) return res.status(500).json({ error: 'TINYFISH_API_KEY not configured' });

  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);

    const { runIds } = body; // [{ grantName, runId }]
    if (!runIds || !runIds.length) return res.status(400).json({ error: 'runIds required' });

    // Poll all runs and collect results
    const results = await Promise.all(runIds.map(async ({ grantName, runId }) => {
      const resp = await fetch(`https://agent.tinyfish.ai/v1/runs/${runId}`, {
        headers: { 'X-API-Key': key },
      });
      const data = await resp.json();
      const status = (data.status || '').toUpperCase();
      const isDone = status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED';

      let url = null;
      if (status === 'COMPLETED' && data.result) {
        const r = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
        url = r.url || null;
        // Reject aggregator/generic sites
        if (url) {
          const blocked = ['grants.gov','grantwatch','instrumentl','candid.org','guidestar','foundationsource','philanthropy.com','GrantStation'];
          if (blocked.some(b => url.toLowerCase().includes(b.toLowerCase()))) url = null;
        }
      }

      return { grantName, runId, done: isDone, url };
    }));

    const allDone = results.every(r => r.done);
    return res.status(200).json({ allDone, results });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
