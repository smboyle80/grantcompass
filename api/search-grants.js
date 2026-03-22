// v20260322-044517
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const key = process.env.TINYFISH_API_KEY;
  if (!key) return res.status(500).json({ error: 'TINYFISH_API_KEY not configured' });
  try {
    var body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e) { body = {}; } }
    if (!body || typeof body !== 'object') body = {};
    const { category, state, orgProfile } = body;
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

    // Extract short keyword(s) for the search box — faster than long descriptions
    const src = (category || orgProfile || '').toLowerCase();
    const keywordMap = [
      ['disability','disability'],['intellectual','disability'],['developmental','disability'],
      ['food','food'],['hunger','food'],['nutrition','nutrition'],
      ['housing','housing'],['homeless','housing'],
      ['youth','youth'],['children','youth'],['education','education'],
      ['health','health'],['mental health','mental health'],
      ['environment','environment'],['conservation','conservation'],
      ['arts','arts'],['culture','arts'],
      ['workforce','workforce'],['employment','workforce'],
      ['veteran','veterans'],['refugee','refugee'],['immigrant','immigrant'],
      ['animal','animal welfare'],['lgbtq','lgbtq'],['racial equity','racial equity'],
    ];
    let keyword = 'nonprofit';
    for (var i = 0; i < keywordMap.length; i++) {
      if (src.indexOf(keywordMap[i][0]) !== -1) { keyword = keywordMap[i][1]; break; }
    }

    const response = await fetch('https://agent.tinyfish.ai/v1/automation/run-async', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
      body: JSON.stringify({
        url: searchUrl,
        goal: 'Go to GrantWatch. In the search box type "' + keyword + '" and press search. Wait for results. Extract the first 6 grants shown. For each grant return ONLY these fields: grant_name, funder, amount, deadline, description, url (the full URL of the grant detail page on GrantWatch). Do NOT click into individual grants. Just extract from the search results list. Return a JSON array.',
        browser_profile: 'lite',
      }),
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch(e) { return res.status(500).json({ error: 'Non-JSON: ' + text.slice(0,200) }); }
    if (!response.ok) return res.status(500).json({ error: 'Tinyfish ' + response.status + ': ' + JSON.stringify(data).slice(0,200) });
    if (!data.run_id) return res.status(500).json({ error: 'No run_id', raw: data });
    return res.status(200).json({ runId: data.run_id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
