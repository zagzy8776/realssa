// Public entertainment trend feed for the web client.
// The detector uses only publisher RSS, Google News/Trends RSS, Reddit's public
// Atom feed, and optional official YouTube/X APIs. No platform scraping.

const trigger = require('../backend/services/entertainmentTrigger.service');

function readQuery(req) {
  try {
    return new URL(req.url, `https://${req.headers.host || 'www.realssanews.com.ng'}`).searchParams;
  } catch {
    return new URLSearchParams();
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const snapshot = await trigger.ensureFresh({ maxAgeMs: 5 * 60 * 1000 });
    const params = readQuery(req);

    const limit = Number(params.get('limit')) || 12;
    const region = String(params.get('region') || '').toLowerCase();
    const minHeat = Number(params.get('minHeat')) || 0;

    const result = trigger.getTrends({ limit, region, minHeat, includeCoverage: false });

    res.setHeader('Cache-Control', 'public, s-maxage=90, stale-while-revalidate=300');
    return res.status(200).json({
      ok: true,
      ...result,
      sourcePolicy: trigger.sourcePolicy,
    });
  } catch (error) {
    console.error('[Vercel Entertainment Trends] failed:', error.message);
    return res.status(200).json({
      ok: false,
      trends: [],
      scannedAt: null,
      error: 'Entertainment trends temporarily unavailable',
      sourcePolicy: trigger.sourcePolicy,
    });
  }
};
