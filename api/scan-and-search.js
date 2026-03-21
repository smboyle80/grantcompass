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

    const { url, phase, orgProfile, state } = body;

    // Phase 1: Scan the nonprofit's website
    if (phase === 'scan') {
      if (!url) return res.status(400).json({ error: 'url is required' });
      const response = await fetch('https://agent.tinyfish.ai/v1/automation/run-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
        body: JSON.stringify({
          url,
          goal: 'Visit this nonprofit website homepage and About page. Extract and return as JSON: organization name, mission statement, main programs and services (list each), populations served, geographic area, and any focus areas or causes mentioned.',
          browser_profile: 'lite',
        }),
      });
      const text = await response.text();
      const data = JSON.parse(text);
      if (!response.ok) return res.status(500).json({ error: 'Tinyfish ' + response.status + ': ' + JSON.stringify(data).slice(0, 200) });
      return res.status(200).json({ runId: data.run_id });
    }

    // Phase 2: Search GrantWatch using the org's profile
    if (phase === 'search') {
      if (!orgProfile) return res.status(400).json({ error: 'orgProfile is required' });

      // Build a targeted GrantWatch search based on what we learned
      const stateMap = {
        'arizona': 'arizona', 'az': 'arizona', 'california': 'california', 'ca': 'california',
        'texas': 'texas', 'tx': 'texas', 'florida': 'florida', 'fl': 'florida',
        'new york': 'new-york', 'ny': 'new-york', 'colorado': 'colorado', 'co': 'colorado',
        'washington': 'washington', 'wa': 'washington', 'oregon': 'oregon', 'or': 'oregon',
      };
      const stateKey = (state || '').toLowerCase().trim();
      const gwSubdomain = stateMap[stateKey] || 'grants';
      const searchUrl = `https://${gwSubdomain}.grantwatch.com/grant-search.php`;

      const response = await fetch('https://agent.tinyfish.ai/v1/automation/run-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
        body: JSON.stringify({
          url: searchUrl,
          goal: `Search GrantWatch for currently open grants that match this specific nonprofit organization:

${orgProfile}

Use the search box and filters on the page to find the most relevant grants for this organization's mission and populations served. Extract the first 8 results. For each grant return:
- grant_name
- funder
- amount
- deadline (exact date shown on the page)
- description
- eligibility
- url (full GrantWatch URL to the grant detail page)

Return ONLY a JSON array. No markdown.`,
          browser_profile: 'lite',
        }),
      });
      const text = await response.text();
      const data = JSON.parse(text);
      if (!response.ok) return res.status(500).json({ error: 'Tinyfish ' + response.status + ': ' + JSON.stringify(data).slice(0, 200) });
      return res.status(200).json({ runId: data.run_id });
    }

    return res.status(400).json({ error: 'phase must be "scan" or "search"' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
