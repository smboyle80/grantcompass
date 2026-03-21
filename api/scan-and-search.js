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

    const { url, state } = body;
    if (!url) return res.status(400).json({ error: 'url is required' });

    const stateMap = {
      'arizona': 'arizona', 'az': 'arizona', 'california': 'california', 'ca': 'california',
      'texas': 'texas', 'tx': 'texas', 'florida': 'florida', 'fl': 'florida',
      'new york': 'new-york', 'ny': 'new-york', 'colorado': 'colorado', 'co': 'colorado',
      'washington': 'washington', 'wa': 'washington', 'oregon': 'oregon', 'or': 'oregon',
    };

    // We don't know the state yet — start org scan first, derive state from result
    // But we CAN start both jobs in parallel if we default to 'grants' subdomain
    // and use the org scan result to refine later. For now: start both simultaneously.
    const gwSubdomain = stateMap[(state||'').toLowerCase().trim()] || 'grants';
    const gwUrl = `https://${gwSubdomain}.grantwatch.com/grant-search.php`;

    // Launch BOTH jobs at once using Tinyfish batch endpoint
    const batchResp = await fetch('https://agent.tinyfish.ai/v1/automation/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
      body: JSON.stringify({
        runs: [
          {
            url,
            goal: 'Visit this nonprofit website homepage and About page. Extract and return as JSON: organization_name, mission_statement, main_programs (array), populations_served (array), geographic_area, focus_areas (array).',
            browser_profile: 'lite',
          },
          {
            url: gwUrl,
            goal: 'Search GrantWatch for currently open grants for nonprofits. Browse the listings shown. Extract the first 8 grants. For each return: grant_name, funder, amount, deadline (exact date), description, eligibility, url (full GrantWatch URL). Return ONLY a JSON array.',
            browser_profile: 'lite',
          }
        ]
      }),
    });

    // If batch endpoint doesn't exist, fall back to two separate run-async calls
    if (!batchResp.ok) {
      const [r1, r2] = await Promise.all([
        fetch('https://agent.tinyfish.ai/v1/automation/run-async', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
          body: JSON.stringify({
            url,
            goal: 'Visit this nonprofit website homepage and About page. Extract and return as JSON: organization_name, mission_statement, main_programs (array), populations_served (array), geographic_area, focus_areas (array).',
            browser_profile: 'lite',
          }),
        }),
        fetch('https://agent.tinyfish.ai/v1/automation/run-async', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
          body: JSON.stringify({
            url: gwUrl,
            goal: 'Search GrantWatch for currently open grants for nonprofits. Browse the listings shown. Extract the first 8 grants. For each return: grant_name, funder, amount, deadline (exact date), description, eligibility, url (full GrantWatch URL). Return ONLY a JSON array.',
            browser_profile: 'lite',
          }),
        })
      ]);
      const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
      return res.status(200).json({ scanRunId: d1.run_id, searchRunId: d2.run_id });
    }

    const batchData = await batchResp.json();
    const runs = batchData.runs || batchData;
    return res.status(200).json({
      scanRunId: runs[0]?.run_id || runs[0]?.id,
      searchRunId: runs[1]?.run_id || runs[1]?.id,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
