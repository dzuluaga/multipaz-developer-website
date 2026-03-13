/**
 * Feedback proxy – forwards thumbs-up/down ratings to a Google Sheets
 * webhook (Apps Script web app) so the webhook URL stays private.
 *
 * Expects POST JSON: { rating: 'up'|'down', question: string, answer: string }
 * Requires env var: FEEDBACK_WEBHOOK_URL
 */

module.exports = async (req, res) => {
  // CORS
  const origin = req.headers.origin || '';
  const allowed = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const corsOrigin = allowed.includes(origin) ? origin : (allowed[0] || '*');
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const webhookUrl = process.env.FEEDBACK_WEBHOOK_URL;
  if (!webhookUrl) {
    res.status(503).json({ error: 'Feedback service not configured' });
    return;
  }

  try {
    const { rating, question, answer } = req.body;

    if (!rating || (rating !== 'up' && rating !== 'down')) {
      res.status(400).json({ error: 'rating must be "up" or "down"' });
      return;
    }
    if (!question || typeof question !== 'string') {
      res.status(400).json({ error: 'question is required' });
      return;
    }
    if (!answer || typeof answer !== 'string') {
      res.status(400).json({ error: 'answer is required' });
      return;
    }

    const payload = {
      timestamp: new Date().toISOString(),
      rating,
      question: question.slice(0, 2000),
      answer: answer.slice(0, 5000),
    };

    const webhookRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!webhookRes.ok) {
      const errBody = await webhookRes.text().catch(() => '');
      console.error('Feedback webhook error:', webhookRes.status, errBody);
      res.status(502).json({ error: 'Feedback service error' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Feedback request error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
