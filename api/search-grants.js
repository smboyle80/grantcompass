module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const key = process.env.TINYFISH_API_KEY;
  if (!key) return res.status(500).json({ error: 'TINYFISH_API_KEY not configured' });
  try {
    var body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e) { body = {}; } }
    if (!body || typeof body !== 'object') body = {};
    var keyword = body.keyword || 'nonprofit';
    var subdomain = body.subdomain || 'grants';
    var r = await fetch('https://agent.tinyfish.ai/v1/automation/run-async', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
      body: JSON.stringify({
        url: 'https://' + subdomain + '.grantwatch.com/grant-search.php',
        goal: 'Go to GrantWatch. Type "' + keyword + '" in the search box and press search. Wait for results. Extract the first 6 grants shown. For each return: grant_name, funder, amount, deadline, description, url (full GrantWatch page URL). Return ONLY a JSON array.',
        browser_profile: 'lite',
      }),
    });
    var d = await r.json();
    if (!d.run_id) return res.status(500).json({ error: 'No run_id: ' + JSON.stringify(d).slice(0,200) });
    return res.status(200).json({ runId: d.run_id });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}
