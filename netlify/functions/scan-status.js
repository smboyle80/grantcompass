exports.handler = async function (event) {
  if (event.httpMethod !== "GET") return { statusCode: 405, body: "Method Not Allowed" };

  const tinyfishKey = process.env.TINYFISH_API_KEY;
  if (!tinyfishKey) return { statusCode: 500, body: JSON.stringify({ error: "TINYFISH_API_KEY not configured" }) };

  const runId = event.queryStringParameters?.runId;
  if (!runId) return { statusCode: 400, body: JSON.stringify({ error: "runId is required" }) };

  try {
    const response = await fetch(`https://api.tinyfish.io/api/v1/run/${runId}`, {
      headers: { "Authorization": `Bearer ${tinyfishKey}` },
    });

    const data = await response.json();

    const status = (data.status || "").toUpperCase();
    const isComplete = status === "COMPLETED" || status === "COMPLETE" || status === "SUCCESS";
    const isFailed = status === "FAILED" || status === "ERROR" || status === "CANCELLED";

    let result = null;
    if (isComplete) {
      result = data.result || data.output || data.content || data.data || null;
      if (typeof result === "object") result = JSON.stringify(result);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: isComplete ? "complete" : isFailed ? "failed" : "running",
        result,
        raw: data,
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
