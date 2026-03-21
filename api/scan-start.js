export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const key = process.env.TINYFISH_API_KEY;
  if (!key) return res.status(500).json({ error: 'TINYFISH_API_KEY not configured' });

  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });

    const response = await fetch('https://agent.tinyfish.ai/v1/automation/run-async', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
      body: JSON.stringify({
        url,
        goal: 'Visit this nonprofit website. Extract: organization name, mission statement, programs and services, populations served, geographic area, impact statistics, budget if mentioned, year founded, current initiatives, existing funders or partners. Check About/Programs/Impact/Mission pages. Return structured JSON.',
        browser_profile: 'lite',
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.error || data.message || 'Tinyfish error ' + response.status });
    return res.status(200).json({ runId: data.run_id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
