const https = require("https");

exports.handler = async function (event) {
  if (event.httpMethod !== "GET") return { statusCode: 405, body: "Method Not Allowed" };

  const tinyfishKey = process.env.TINYFISH_API_KEY;
  if (!tinyfishKey) return { statusCode: 500, body: JSON.stringify({ error: "TINYFISH_API_KEY not configured" }) };

  const runId = event.queryStringParameters && event.queryStringParameters.runId;
  if (!runId) return { statusCode: 400, body: JSON.stringify({ error: "runId is required" }) };

  try {
    const rawText = await new Promise((resolve, reject) => {
      const options = {
        hostname: "agent.tinyfish.ai",
        path: "/v1/automation/run/" + runId,
        method: "GET",
        headers: { "X-API-Key": tinyfishKey },
      };
      const req = https.request(options, (res) => {
        let body = "";
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => resolve(body));
        res.on("error", reject);
      });
      req.on("error", reject);
      req.end();
    });

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      return { statusCode: 500, body: JSON.stringify({ error: "Non-JSON from Tinyfish: " + rawText.slice(0, 200) }) };
    }

    const status = (data.status || "").toUpperCase();
    const isComplete = status === "COMPLETED";
    const isFailed = status === "FAILED" || status === "ERROR" || status === "CANCELLED";

    let result = null;
    if (isComplete && data.result) {
      result = typeof data.result === "string" ? data.result : JSON.stringify(data.result);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: isComplete ? "complete" : isFailed ? "failed" : "running",
        result,
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
