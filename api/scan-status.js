export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  const key = process.env.TINYFISH_API_KEY;
  if (!key) return res.status(500).json({ error: 'TINYFISH_API_KEY not configured' });

  const { runId } = req.query;
  if (!runId) return res.status(400).json({ error: 'runId is required' });

  try {
    const response = await fetch('https://agent.tinyfish.ai/v1/automation/run/' + runId, {
      headers: { 'X-API-Key': key },
    });

    const data = await response.json();
    const status = (data.status || '').toUpperCase();
    const isComplete = status === 'COMPLETED';
    const isFailed = status === 'FAILED' || status === 'ERROR' || status === 'CANCELLED';

    let result = null;
    if (isComplete && data.result) {
      result = typeof data.result === 'string' ? data.result : JSON.stringify(data.result);
    }

    return res.status(200).json({
      status: isComplete ? 'complete' : isFailed ? 'failed' : 'running',
      result,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
