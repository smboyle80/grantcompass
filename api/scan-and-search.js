module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const key = process.env.TINYFISH_API_KEY;
  if (!key) return res.status(500).json({ error: 'TINYFISH_API_KEY not configured' });

  try {
    // Explicitly parse body in case Vercel did not auto-parse
    var body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e) { body = {}; } }
    if (!body || typeof body !== 'object') body = {};

    var url = body.url;
    var phase = body.phase;
    var orgProfile = body.orgProfile;
    var state = body.state;
    var keyword = body.keyword;

    if (phase === 'start') {
      if (!url) return res.status(400).json({ error: 'url is required' });

      const r1 = await fetch('https://agent.tinyfish.ai/v1/automation/run-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
        body: JSON.stringify({
          url: url,
          goal: 'Visit this nonprofit website homepage and About page. Extract as JSON: organization name, mission statement (1-2 sentences), main programs (list), populations served, geographic area (city/state). Be brief.',
          browser_profile: 'lite',
        }),
      });
      const d1 = await r1.json();
      if (!d1.run_id) return res.status(500).json({ error: 'Scan start failed: ' + JSON.stringify(d1).slice(0,200) });

      const r2 = await fetch('https://agent.tinyfish.ai/v1/automation/run-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
        body: JSON.stringify({
          url: 'https://grants.grantwatch.com/grant-search.php',
          goal: 'Go to GrantWatch. In the search box type "nonprofit" and press search. Wait for results to load. Extract the first 6 grants. For each return: grant_name, funder, amount, deadline, description, url (full GrantWatch URL). Do NOT click individual grants. Return ONLY a JSON array.',
          browser_profile: 'lite',
        }),
      });
      const d2 = await r2.json();
      if (!d2.run_id) return res.status(500).json({ error: 'Search start failed: ' + JSON.stringify(d2).slice(0,200) });

      return res.status(200).json({ scanRunId: d1.run_id, searchRunId: d2.run_id });
    }

    if (phase === 'search') {
      if (!keyword) return res.status(400).json({ error: 'keyword required' });
      const stateMap = {
        'arizona':'arizona','az':'arizona','california':'california','ca':'california',
        'texas':'texas','tx':'texas','florida':'florida','fl':'florida',
        'new york':'new-york','ny':'new-york','colorado':'colorado','co':'colorado',
        'washington':'washington','wa':'washington','oregon':'oregon','or':'oregon',
        'illinois':'illinois','il':'illinois','georgia':'georgia','ga':'georgia',
      };
      const stateKey = (state || '').toLowerCase().trim();
      const gwSubdomain = stateMap[stateKey] || 'grants';
      const r = await fetch('https://agent.tinyfish.ai/v1/automation/run-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
        body: JSON.stringify({
          url: 'https://' + gwSubdomain + '.grantwatch.com/grant-search.php',
          goal: 'Go to GrantWatch. In the search box type "' + keyword + '" and press search. Wait for results. Extract the first 6 grants. For each: grant_name, funder, amount, deadline, description, url (full GrantWatch URL). Return ONLY a JSON array.',
          browser_profile: 'lite',
        }),
      });
      const d = await r.json();
      if (!d.run_id) return res.status(500).json({ error: 'Search start failed: ' + JSON.stringify(d).slice(0,200) });
      return res.status(200).json({ runId: d.run_id });
    }

    return res.status(400).json({ error: 'phase must be start or search. Received: ' + JSON.stringify(phase) + ' body keys: ' + Object.keys(body).join(',') });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
