export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const key = process.env.TINYFISH_API_KEY;
  if (!key) return res.status(500).json({ error: 'TINYFISH_API_KEY not configured' });

  try {
    // Explicitly parse body — Vercel doesn't always auto-parse JSON
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) { return res.status(400).json({ error: 'Invalid JSON body' }); }
    }

    const url = body && body.url;
    if (!url) return res.status(400).json({ error: 'url is required', received: JSON.stringify(body) });

    const response = await fetch('https://agent.tinyfish.ai/v1/automation/run-async', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
      body: JSON.stringify({
        url,
        goal: 'Visit this nonprofit website. Extract: organization name, mission statement, programs and services, populations served, geographic area, impact statistics, budget if mentioned, year founded, current initiatives, existing funders or partners. Check About/Programs/Impact/Mission pages. Return structured JSON.',
        browser_profile: 'lite',
      }),
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch(e) { return res.status(500).json({ error: 'Tinyfish non-JSON response: ' + text.slice(0, 200) }); }

    if (!response.ok) return res.status(500).json({ error: 'Tinyfish ' + response.status + ': ' + (data.message || data.error || text.slice(0, 200)) });
    if (!data.run_id) return res.status(500).json({ error: 'No run_id in response', response: data });

    return res.status(200).json({ runId: data.run_id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
