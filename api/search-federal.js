// Searches Grants.gov public API (no key required) + starts a Tinyfish run for state portal
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  var body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e) { body = {}; } }
  if (!body || typeof body !== 'object') body = {};

  var keyword = body.keyword || 'nonprofit';
  var state = body.state || '';
  var sources = body.sources || ['federal'];

  var results = {};

  try {
    // ── Grants.gov API (free, no key) ──────────────────────────────────
    if (sources.indexOf('federal') !== -1) {
      try {
        var params = new URLSearchParams({
          keyword: keyword,
          oppStatuses: 'forecasted|posted',
          rows: '10',
          sortBy: 'openDate|desc',
        });
        var r = await fetch('https://api.grants.gov/v1/api/search?' + params.toString(), {
          headers: { 'Content-Type': 'application/json' }
        });
        var d = await r.json();
        var opps = (d.data && d.data.oppHits) ? d.data.oppHits : [];
        results.federal = opps.map(function(o) {
          return {
            grant_name: o.title || '',
            funder: o.agencyName || o.agencyCode || 'Federal Agency',
            amount: o.awardCeiling ? '$' + Number(o.awardCeiling).toLocaleString() : 'See listing',
            deadline: o.closeDate || o.archiveDate || '',
            description: o.synopsis || o.description || '',
            url: o.id ? 'https://www.grants.gov/search-results-detail/' + o.id : 'https://grants.gov',
            source: 'Grants.gov',
            eligibility: o.eligibilities || ''
          };
        });
      } catch(e) {
        results.federal = [];
        results.federalError = e.message;
      }
    }

    // ── State portal via Tinyfish ──────────────────────────────────────
    if (sources.indexOf('state') !== -1 && process.env.TINYFISH_API_KEY) {
      var key = process.env.TINYFISH_API_KEY;
      var statePortals = {
        'arizona': { url: 'https://az.gov/grants', name: 'Arizona' },
        'california': { url: 'https://www.grants.ca.gov/grants/', name: 'California' },
        'texas': { url: 'https://www.txsmartbuy.gov/sp', name: 'Texas' },
        'florida': { url: 'https://www.floridajobs.org/grants', name: 'Florida' },
        'new york': { url: 'https://grantsgateway.ny.gov', name: 'New York' },
        'colorado': { url: 'https://www.colorado.gov/grants', name: 'Colorado' },
        'washington': { url: 'https://www.commerce.wa.gov/grants/', name: 'Washington' },
        'oregon': { url: 'https://www.oregon.gov/Pages/search.aspx?term=grants', name: 'Oregon' },
        'illinois': { url: 'https://www2.illinois.gov/sites/grants', name: 'Illinois' },
        'georgia': { url: 'https://georgia.gov/grants', name: 'Georgia' },
      };
      var stateKey = (state || '').toLowerCase().trim();
      var portal = statePortals[stateKey];
      var portalUrl = portal ? portal.url : 'https://www.grants.gov';

      try {
        var sr = await fetch('https://agent.tinyfish.ai/v1/automation/run-async', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
          body: JSON.stringify({
            url: portalUrl,
            goal: 'Find grant opportunities on this page related to "' + keyword + '". Extract up to 5 grants. For each return: grant_name, funder, amount, deadline, description, url. Return ONLY a JSON array.',
            browser_profile: 'lite',
          }),
        });
        var sd = await sr.json();
        results.stateRunId = sd.run_id || null;
        results.statePortalName = portal ? portal.name : 'State';
      } catch(e) {
        results.stateRunId = null;
        results.stateError = e.message;
      }
    }

    return res.status(200).json(results);
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}
