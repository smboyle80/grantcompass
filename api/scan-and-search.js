module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const key = process.env.TINYFISH_API_KEY;
  if (!key) return res.status(500).json({ error: 'TINYFISH_API_KEY not configured' });
  try {
    const { url, phase, orgProfile, state } = req.body || {};
    if (phase === 'scan') {
      if (!url) return res.status(400).json({ error: 'url is required' });
      const response = await fetch('https://agent.tinyfish.ai/v1/automation/run-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
        body: JSON.stringify({
          url,
          goal: 'Visit this nonprofit website homepage and About page. Extract as JSON: organization name, mission statement, main programs, populations served, geographic area.',
          browser_profile: 'lite',
        }),
      });
      const data = await response.json();
      if (!response.ok) return res.status(500).json({ error: 'Tinyfish ' + response.status + ': ' + JSON.stringify(data).slice(0, 200) });
      return res.status(200).json({ runId: data.run_id });
    }
    if (phase === 'search') {
      if (!orgProfile) return res.status(400).json({ error: 'orgProfile is required' });
      const stateMap = {
        'arizona':'arizona','az':'arizona','california':'california','ca':'california',
        'texas':'texas','tx':'texas','florida':'florida','fl':'florida',
        'new york':'new-york','ny':'new-york','colorado':'colorado','co':'colorado',
        'washington':'washington','wa':'washington','oregon':'oregon','or':'oregon',
      };
      const stateKey = (state || '').toLowerCase().trim();
      const gwSubdomain = stateMap[stateKey] || 'grants';
      const response = await fetch('https://agent.tinyfish.ai/v1/automation/run-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
        body: JSON.stringify({
          url: 'https://' + gwSubdomain + '.grantwatch.com/grant-search.php',
          goal: 'Search GrantWatch for currently open grants matching this nonprofit:\n\n' + orgProfile + '\n\nUse the search box with relevant keywords. Extract 8 relevant open grants. For each: grant_name, funder, amount, deadline (exact date), description, eligibility, url (full GrantWatch URL). Return ONLY a JSON array.',
          browser_profile: 'lite',
        }),
      });
      const data = await response.json();
      if (!response.ok) return res.status(500).json({ error: 'Tinyfish ' + response.status + ': ' + JSON.stringify(data).slice(0, 200) });
      return res.status(200).json({ runId: data.run_id });
    }
    return res.status(400).json({ error: 'phase must be scan or search' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
