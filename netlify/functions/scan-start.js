exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const tinyfishKey = process.env.TINYFISH_API_KEY;
  if (!tinyfishKey) return { statusCode: 500, body: JSON.stringify({ error: "TINYFISH_API_KEY not configured" }) };

  try {
    const { url } = JSON.parse(event.body);
    if (!url) return { statusCode: 400, body: JSON.stringify({ error: "url is required" }) };

    const response = await fetch("https://api.tinyfish.io/api/v1/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${tinyfishKey}`,
      },
      body: JSON.stringify({
        url,
        goal: `You are researching a nonprofit organization. Visit this website and extract as much of the following as you can find:
1. Organization name
2. Mission statement or purpose
3. Programs and services offered (list each one)
4. Populations or communities served (demographics, geography)
5. Geographic area of service (city, state, national, international)
6. Any impact statistics or outcomes mentioned (numbers served, results achieved)
7. Organization size or annual budget if mentioned
8. Year founded or years of operation
9. Any current initiatives, campaigns, or focus areas
10. Partner organizations or funders already mentioned on the site

Navigate to the About, Programs, Impact, and Mission pages if they exist. Return everything you find as plain structured text.`,
        browser_profile: "lite",
      }),
    });

    const data = await response.json();
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId: data.id || data.run_id || data.runId }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
