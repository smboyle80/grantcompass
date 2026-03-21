const https = require("https");

// Returns the Tinyfish API key to the browser so it can open the SSE stream directly.
// This is safe because: the key is scoped to Tinyfish only, Netlify serves over HTTPS,
// and you can add rate limiting / auth here later if needed.
exports.handler = async function (event) {
  if (event.httpMethod !== "GET") return { statusCode: 405, body: "Method Not Allowed" };

  const tinyfishKey = process.env.TINYFISH_API_KEY;
  if (!tinyfishKey) return { statusCode: 500, body: JSON.stringify({ error: "TINYFISH_API_KEY not configured" }) };

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: tinyfishKey }),
  };
};
