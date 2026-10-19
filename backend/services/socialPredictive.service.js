/**
 * Social Predictive Trending — "know before it blows up"
 *
 * Polls free public trend sources (no paid API keys required to boot):
 *   - Reddit JSON endpoints (hot posts by subreddit) — free, no auth
 *   - Telegram public channel preview pages (optional TELEGRAM_TREND_CHANNELS)
 *
 * Each poll extracts keywords, measures mention-velocity between polls,
 * and writes a predicted_trend_score = f(velocity, frequency, recency).
 * Articles whose title matches a spiking keyword get a predicted_trend_score
 * boost so they surface in the feed BEFORE internal view velocity catches up.
 *
 * All sources are optional + fail-soft. If nothing is configured the service
 * idles and the API returns the last known snapshot.
 */

const { pgRun } = require('./pg');

// Lightweight namespaced logger (project logger.js is a static metrics class)
const LOG = {
  info: (m) => console.log(`[SocialPredictive] ${m}`),
  warn: (m) => console.warn(`[SocialPredictive] ${m}`),
  error: (m) => console.error(`[SocialPredictive] ${m}`),
};

const POLL_MS = 10 * 60 * 1000; // 10 minutes

// In-memory mention history: { [keyword]: [{ ts, count }] }
let mentionHistory = new Map();
let lastSnapshot = { trends: [], computedAt: null, sourcesScanned: 0 };

const STOP_WORDS = new Set((
  'a an and are as at be by for from has have how in is it its of on or that the this to was what when where which who will with you your not no new just also more most after before'
).split(' '));

/**
 * Extract meaningful keywords from a list of strings (titles/labels).
 */
function extractKeywords(texts, maxPer = 40) {
  const freq = new Map();
  for (const text of texts) {
    const words = String(text || '').toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
    for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
  }
  return [...freq.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxPer)
    .map(([word, count]) => ({ keyword: word, weight: count }));
}

/**
 * Source: Reddit hot posts (free JSON, no auth).
 */
async function pollReddit(subreddits = ['news', 'worldnews', 'technology', 'business', 'CryptoCurrency']) {
  const items = [];
  for (const sub of subreddits.slice(0, 5)) {
    try {
      const res = await fetch(
        `https://www.reddit.com/r/${sub}/hot.json?limit=15&raw_json=1`,
        {
          headers: { 'User-Agent': 'RealSSA-TrendScanner/1.0' },
          signal: AbortSignal.timeout(8000),
        }
      );
      if (!res.ok) continue;
      const data = await res.json();
      for (const child of data?.data?.children || []) {
        const d = child.data || {};
        if (!d.title) continue;
        items.push({
          title: d.title,
          score: d.ups || 0,
          createdTs: (d.created_utc || 0) * 1000,
          source: `reddit:${sub}`,
        });
      }
    } catch (e) {
      LOG.warn(`Reddit poll failed for r/${sub}: ${e.message}`);
    }
  }
  return items;
}

/**
 * Source: Telegram public channel preview pages (optional).
 */
async function pollTelegram(channels) {
  const items = [];
  for (const ch of channels) {
    try {
      const res = await fetch(`https://t.me/s/${ch}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const html = await res.text();
      const re = /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
      let m;
      while ((m = re.exec(html)) && items.length < 30) {
        const title = m[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim();
        if (title.length > 20) items.push({ title, source: `telegram:${ch}` });
      }
    } catch (e) {
      LOG.warn(`Telegram poll failed for ${ch}: ${e.message}`);
    }
  }
  return items;
}

/**
 * Score keywords by mention velocity: how much faster they appear now
 * than in the previous window.
 */
function scoreMentions(items) {
  const now = Date.now();
  const windowMs = POLL_MS;
  const keywords = extractKeywords(items.map((i) => i.title), 40);
  const scored = [];

  for (const kw of keywords) {
    const key = `global:${kw.keyword}`;
    const inWindow = items.filter((i) => {
      const ts = i.createdTs || now;
      return ts > now - windowMs && String(i.title).toLowerCase().includes(kw.keyword);
    }).length;

    let history = mentionHistory.get(key) || [];
    const prevWindow = history.filter((h) => h.ts > now - windowMs * 2 && h.ts <= now - windowMs);
    const prevCount = prevWindow.reduce((s, h) => s + h.count, 0);

    history.push({ ts: now, count: inWindow });
    mentionHistory.set(key, history.filter((h) => h.ts > now - 3600 * 1000));

    // Velocity = current vs previous window (log-scale damps outliers)
    const velocity = Math.log1p(inWindow) - Math.log1p(prevCount);
    const predicted = Math.max(0, Math.round((velocity * 100 + kw.weight * 20) * 100) / 100);
    scored.push({
      keyword: kw.keyword,
      mentions_current: inWindow,
      mentions_previous: prevCount,
      velocity: Math.round(velocity * 1000) / 1000,
      predicted_trend_score: predicted,
      accelerating: inWindow > prevCount && inWindow >= 2,
    });
  }

  return scored.sort((a, b) => b.predicted_trend_score - a.predicted_trend_score).slice(0, 25);
}

/**
 * Persist a snapshot (fail-soft) and boost matching recent articles.
 */
async function persistAndMatch(trends) {
  try {
    for (const t of trends.slice(0, 10)) {
      await pgRun(
        `INSERT INTO social_trend_spikes (source, keyword, mention_count, velocity, predicted_trend_score)
         VALUES ('aggregated', $1, $2, $3, $4)`,
        [t.keyword, t.mentions_current, t.velocity, t.predicted_trend_score]
      );
    }
  } catch (e) {
    LOG.warn(`social_trend_spikes write skipped: ${e.message}`);
  }

  // Boost articles whose titles contain accelerating keywords
  const hotKeywords = trends.filter((t) => t.accelerating).map((t) => t.keyword);
  if (hotKeywords.length) {
    try {
      const params = hotKeywords.map((k) => `%${k}%`);
      const where = hotKeywords.map((_, i) => `title ILIKE $${i + 1}`).join(' OR ');
      await pgRun(
        `UPDATE rss_articles SET predicted_trend_score = COALESCE(predicted_trend_score, 0) + 1
         WHERE published_at > NOW() - INTERVAL '6 hours' AND (${where})`,
        params
      );
    } catch (e) {
      LOG.warn(`article boost skipped: ${e.message}`);
    }
  }
}

/**
 * One poll cycle.
 */
async function pollCycle() {
  try {
    const items = [];
    items.push(...(await pollReddit()));

    const tgChannels = (process.env.TELEGRAM_TREND_CHANNELS || '')
      .split(',').map((s) => s.trim()).filter(Boolean);
    if (tgChannels.length) items.push(...(await pollTelegram(tgChannels)));

    const trends = scoreMentions(items.length ? items : [{ title: '' }]);
    await persistAndMatch(trends);

    lastSnapshot = { trends, computedAt: new Date().toISOString(), sourcesScanned: items.length };
    LOG.info(`Poll cycle done: ${items.length} social items, top keyword="${trends[0]?.keyword || '-'}"`);
    return lastSnapshot;
  } catch (err) {
    LOG.error(`Poll cycle error: ${err.message}`);
    return lastSnapshot;
  }
}

let timer = null;
function start() {
  if (timer) return;
  pollCycle(); // first run immediately
  timer = setInterval(pollCycle, POLL_MS);
  if (timer.unref) timer.unref();
  LOG.info(`Social predictive trending started (poll every ${POLL_MS / 60000} min)`);
}

function stop() {
  if (timer) { clearInterval(timer); timer = null; }
}

module.exports = {
  start,
  stop,
  pollCycle,
  getSnapshot: () => lastSnapshot,
};