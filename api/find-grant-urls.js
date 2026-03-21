export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const key = process.env.TINYFISH_API_KEY;
  if (!key) return res.status(500).json({ error: 'TINYFISH_API_KEY not configured' });

  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);

    const { grants } = body;
    if (!grants || !grants.length) return res.status(400).json({ error: 'grants array required' });

    // Launch one Tinyfish run per grant (up to 6) in parallel via run-async
    const startPromises = grants.slice(0, 6).map(async (g) => {
      const searchQuery = `${g.funder} ${g.name} grant application 2025 2026`;
      const resp = await fetch('https://agent.tinyfish.ai/v1/automation/run-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
        body: JSON.stringify({
          url: `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`,
          goal: `Search for the grant application page for "${g.name}" by "${g.funder}". Click the most relevant result that goes to the funder's official website (not aggregator sites like Grants.gov, GrantWatch, Instrumentl, or Candid). Return ONLY a JSON object with one field: { "url": "https://..." } containing the direct URL to the grant program page on the funder's own website. If you cannot find it, return { "url": null }.`,
          browser_profile: 'lite',
        }),
      });
      const data = await resp.json();
      return { grantName: g.name, runId: data.run_id };
    });

    const runIds = await Promise.all(startPromises);
    return res.status(200).json({ runIds });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
