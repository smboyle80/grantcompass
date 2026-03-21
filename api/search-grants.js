export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const tinyfishKey = process.env.TINYFISH_API_KEY;
  if (!tinyfishKey) return res.status(500).json({ error: 'TINYFISH_API_KEY not configured' });

  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);

    const { category, state, budget } = body;
    if (!category) return res.status(400).json({ error: 'category required' });

    // Map focus area to GrantWatch search category
    const stateSlug = (state || 'usa').toLowerCase().replace(/[^a-z]/g, '').slice(0, 20);
    const gwState = stateSlug || 'usa';

    // Build GrantWatch search URL
    const searchUrl = `https://${gwState}.grantwatch.com/grant-search.php`;

    const response = await fetch('https://agent.tinyfish.ai/v1/automation/run-async', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': tinyfishKey },
      body: JSON.stringify({
        url: searchUrl,
        goal: `Search GrantWatch for grants matching this nonprofit:
- Category/focus: ${category}
- State: ${state || 'any US state'}
- Budget size: ${budget || 'any'}

Use the search filters on the page to find relevant grants. Extract the first 8 results shown. For each grant return:
- grant_name: full name of the grant
- funder: the organization offering the grant  
- amount: award amount or range
- deadline: exact deadline date as shown
- description: the description shown
- eligibility: eligibility requirements
- url: the full URL to the grant detail page on GrantWatch

Return ONLY a JSON array of grant objects. No markdown.`,
        browser_profile: 'lite',
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.message || 'Tinyfish error' });

    return res.status(200).json({ runId: data.run_id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
