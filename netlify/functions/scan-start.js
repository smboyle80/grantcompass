const https = require("https");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const tinyfishKey = process.env.TINYFISH_API_KEY;
  if (!tinyfishKey) return { statusCode: 500, body: JSON.stringify({ error: "TINYFISH_API_KEY not configured" }) };

  try {
    const { url } = JSON.parse(event.body);
    if (!url) return { statusCode: 400, body: JSON.stringify({ error: "url is required" }) };

    const payload = JSON.stringify({
      url,
      goal: "You are researching a nonprofit organization. Visit this website and extract: organization name, mission statement, all programs and services, populations served, geographic area, impact statistics, budget size if mentioned, year founded, current initiatives, and any existing funders or partners mentioned on the site. Navigate to About, Programs, Impact, and Mission pages if they exist. Return everything as structured JSON.",
      browser_profile: "lite",
    });

    // Use Node's https module to make the SSE request and read only the first data event
    const runId = await new Promise((resolve, reject) => {
      const options = {
        hostname: "agent.tinyfish.ai",
        path: "/v1/automation/run-sse",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          "X-API-Key": tinyfishKey,
        },
      };

      const req = https.request(options, (res) => {
        if (res.statusCode !== 200) {
          let body = "";
          res.on("data", (chunk) => { body += chunk; });
          res.on("end", () => reject(new Error("HTTP " + res.statusCode + ": " + body.slice(0, 200))));
          return;
        }

        let buffer = "";
        let found = false;

        res.on("data", (chunk) => {
          if (found) return;
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.run_id) {
                  found = true;
                  res.destroy(); // stop reading
                  resolve(data.run_id);
                  return;
                }
              } catch (e) {}
            }
          }
          buffer = lines[lines.length - 1];
        });

        res.on("end", () => {
          if (!found) reject(new Error("Stream ended without run_id"));
        });

        res.on("error", reject);
      });

      req.on("error", reject);
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
