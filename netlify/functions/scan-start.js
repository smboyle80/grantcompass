const https = require("https");

// Standard function - just starts the Tinyfish run and returns run_id immediately.
// We connect to the SSE stream but only wait for the first event (run_id), 
// which Tinyfish emits within 1-2 seconds of accepting the request.
exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const tinyfishKey = process.env.TINYFISH_API_KEY;
  if (!tinyfishKey) return { statusCode: 500, body: JSON.stringify({ error: "TINYFISH_API_KEY not configured" }) };

  try {
    const { url } = JSON.parse(event.body);
    if (!url) return { statusCode: 400, body: JSON.stringify({ error: "url is required" }) };

    const payload = JSON.stringify({
      url,
      goal: "Visit this nonprofit website. Extract: organization name, mission statement, programs and services, populations served, geographic area, impact statistics, budget if mentioned, year founded, current initiatives, existing funders or partners. Check About/Programs/Impact/Mission pages. Return structured JSON.",
      browser_profile: "lite",
    });

    const runId = await new Promise((resolve, reject) => {
      // 9 second hard timeout — Netlify default is 10s, leave 1s buffer
      const timeout = setTimeout(() => {
        reject(new Error("Connection to Tinyfish timed out. Please try again."));
      }, 9000);

      const req = https.request({
        hostname: "agent.tinyfish.ai",
        path: "/v1/automation/run-sse",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          "X-API-Key": tinyfishKey,
        },
      }, (res) => {
        if (res.statusCode !== 200) {
          let body = "";
          res.on("data", (c) => { body += c; });
          res.on("end", () => { clearTimeout(timeout); reject(new Error("Tinyfish HTTP " + res.statusCode + ": " + body.slice(0, 300))); });
          return;
        }

        let buf = "";
        res.on("data", (chunk) => {
          buf += chunk.toString();
          const lines = buf.split("\n");
          buf = lines.pop();
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const d = JSON.parse(line.slice(6));
              if (d.run_id) {
                clearTimeout(timeout);
                res.destroy();
                resolve(d.run_id);
                return;
              }
            } catch (e) {}
          }
        });

        res.on("end", () => { clearTimeout(timeout); reject(new Error("SSE stream ended before run_id was received")); });
        res.on("error", (e) => { clearTimeout(timeout); reject(e); });
      });

      req.on("error", (e) => { clearTimeout(timeout); reject(e); });
      req.write(payload);
      req.end();
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
