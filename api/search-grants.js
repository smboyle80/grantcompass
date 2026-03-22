module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const key = process.env.TINYFISH_API_KEY;
  if (!key) return res.status(500).json({ error: 'TINYFISH_API_KEY not configured' });
  try {
    const { category, state, orgProfile } = req.body || {};
    if (!category && !orgProfile) return res.status(400).json({ error: 'category or orgProfile required' });
    const stateMap = {
      'arizona':'arizona','az':'arizona','california':'california','ca':'california',
      'texas':'texas','tx':'texas','florida':'florida','fl':'florida',
      'new york':'new-york','ny':'new-york','colorado':'colorado','co':'colorado',
      'washington':'washington','wa':'washington','oregon':'oregon','or':'oregon',
      'illinois':'illinois','il':'illinois','georgia':'georgia','ga':'georgia',
      'ohio':'ohio','oh':'ohio','pennsylvania':'pennsylvania','pa':'pennsylvania',
      'michigan':'michigan','mi':'michigan','north carolina':'north-carolina','nc':'north-carolina',
    };
    const stateKey = (state || '').toLowerCase().trim();
    const gwSubdomain = stateMap[stateKey] || 'grants';
    const searchUrl = 'https://' + gwSubdomain + '.grantwatch.com/grant-search.php';
    const orgDesc = orgProfile || ('Category: ' + category + ', State: ' + (state || 'any'));
    const response = await fetch('https://agent.tinyfish.ai/v1/automation/run-async', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
      body: JSON.stringify({
        url: searchUrl,
        goal: 'Search GrantWatch for currently open grants matching this nonprofit:\n\n' + orgDesc + '\n\nUse the search box with relevant keywords. Extract the 8 most relevant open grants. For each return: grant_name, funder, amount, deadline (exact date shown), description, eligibility, url (full GrantWatch URL). Return ONLY a JSON array.',
        browser_profile: 'lite',
      }),
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch(e) { return res.status(500).json({ error: 'Non-JSON from Tinyfish: ' + text.slice(0, 200) }); }
    if (!response.ok) return res.status(500).json({ error: 'Tinyfish ' + response.status + ': ' + JSON.stringify(data).slice(0, 200) });
    if (!data.run_id) return res.status(500).json({ error: 'No run_id returned', raw: data });
    return res.status(200).json({ runId: data.run_id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
