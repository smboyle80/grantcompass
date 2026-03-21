export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  const key = process.env.TINYFISH_API_KEY;
  if (!key) {
    return new Response(JSON.stringify({ error: 'TINYFISH_API_KEY not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { url } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ error: 'url is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Start the Tinyfish SSE stream server-side (no CORS issues, no timeout on Edge)
    const sseResp = await fetch('https://agent.tinyfish.ai/v1/automation/run-sse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': key,
      },
      body: JSON.stringify({
        url,
        goal: 'Visit this nonprofit website. Extract: organization name, mission statement, programs and services, populations served, geographic area, impact statistics, budget if mentioned, year founded, current initiatives, existing funders or partners. Check About/Programs/Impact/Mission pages. Return structured JSON.',
        browser_profile: 'lite',
      }),
    });

    if (!sseResp.ok) {
      const errText = await sseResp.text();
      return new Response(JSON.stringify({ error: 'Tinyfish error ' + sseResp.status + ': ' + errText.slice(0, 200) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // Read SSE stream line by line until we get run_id
    const reader = sseResp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let runId = null;

    while (!runId) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const d = JSON.parse(line.slice(6));
            if (d.run_id) { runId = d.run_id; break; }
          } catch (e) {}
        }
      }
    }

    reader.cancel();

    if (!runId) {
      return new Response(JSON.stringify({ error: 'No run_id received from Tinyfish' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ runId }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
