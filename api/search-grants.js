export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const key = process.env.TINYFISH_API_KEY;
  if (!key) return res.status(500).json({ error: 'TINYFISH_API_KEY not configured' });

  try {
    let body = req.body;
    if (!body || typeof body !== 'object') {
      try { body = JSON.parse(body || '{}'); } catch(e) { body = {}; }
    }

    const { category, state, budget } = body;
    if (!category) return res.status(400).json({ error: 'category required' });

    // Derive GrantWatch subdomain from state
    const stateMap = {
      'arizona': 'arizona', 'az': 'arizona',
      'california': 'california', 'ca': 'california',
      'texas': 'texas', 'tx': 'texas',
      'florida': 'florida', 'fl': 'florida',
      'new york': 'new-york', 'ny': 'new-york',
    };
    const stateKey = (state || '').toLowerCase().trim();
    const gwSubdomain = stateMap[stateKey] || 'grants';
    const searchUrl = `https://${gwSubdomain}.grantwatch.com/grant-search.php`;

    const response = await fetch('https://agent.tinyfish.ai/v1/automation/run-async', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
      body: JSON.stringify({
        url: searchUrl,
        goal: `Search GrantWatch for currently open grants matching this nonprofit profile:
- Category/focus: ${category}
- State: ${state || 'any US state'}
- Budget: ${budget || 'any size'}

Use the search filters to find relevant results. Extract the first 8 grants shown. For each return:
- grant_name
- funder
- amount (award amount)
- deadline (exact date shown)
- description
- eligibility
- url (full GrantWatch URL to the grant detail page)

Return ONLY a JSON array. No markdown.`,
        browser_profile: 'lite',
      }),
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch(e) { return res.status(500).json({ error: 'Tinyfish non-JSON: ' + text.slice(0, 200) }); }
    if (!response.ok) return res.status(500).json({ error: 'Tinyfish ' + response.status + ': ' + JSON.stringify(data).slice(0, 200) });
    if (!data.run_id) return res.status(500).json({ error: 'No run_id returned', raw: data });
    return res.status(200).json({ runId: data.run_id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
