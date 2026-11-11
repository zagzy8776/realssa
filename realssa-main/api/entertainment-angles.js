// Internal newsroom endpoint: turn one story into three grounded angles.
// Protected by CRON_SECRET. Never expose this to the public client.

const trigger = require('../backend/services/entertainmentTrigger.service');
const { generateBrief } = require('../backend/services/angleFactory.service');
const { fetchArticleText } = require('../backend/services/articleText.service');
const { requireCron } = require('../backend/services/cronAuth');

async function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;

  if (Buffer.isBuffer(req.body)) {
    try {
      return JSON.parse(req.body.toString('utf8'));
    } catch {
      return {};
    }
  }

  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!requireCron(req, res)) return;

  try {
    const body = await readBody(req);
    const trendId = String(body.trendId || '').trim();

    let trend = null;
    if (trendId) {
      await trigger.ensureFresh({ maxAgeMs: 5 * 60 * 1000 });
      trend = trigger.getTrend(trendId);
      if (!trend) {
        return res.status(404).json({ ok: false, error: 'Trend not found' });
      }
    }

    let sourceText = String(body.sourceText || body.text || '').trim();
    const sourceUrl = String(body.sourceUrl || trend?.coverage?.[0]?.url || '').trim();

    if (!sourceText && sourceUrl) {
      try {
        sourceText = await fetchArticleText(sourceUrl);
      } catch (error) {
        console.warn('[Vercel Entertainment Angles] source fetch failed:', error.message);
      }
    }

    if (!sourceText && trend) {
      sourceText = `${trend.title}. ${trend.snippet || ''}`.trim();
    }

    const result = await generateBrief({
      title: body.title || trend?.title || '',
      sourceText,
      sourceUrl,
      sourceName: body.sourceName || trend?.coverage?.[0]?.source || '',
      region: body.region || trend?.region || 'global',
    });

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(result);
  } catch (error) {
    console.error('[Vercel Entertainment Angles] failed:', error.message);
    return res.status(500).json({ ok: false, error: 'Angle generation failed' });
  }
};
