/**
 * enrichFeedImages — force real publisher photos onto cards.
 *
 * RSS often ships empty images or publisher logos. For share-ready cards
 * (WhatsApp / Telegram / TikTok / X) we scrape the article page and pick the
 * best non-logo image (og:image, twitter:image, lazy src, body img).
 *
 * Brand logo (realssanews.com.ng/logo.png) is ONLY the last resort when every
 * scrape path fails — never the default for a healthy card.
 */

const LOGO_RE =
  /(?:^|[\/_.-])(?:logo|icon|brand|favicon|placeholder|avatar|sprite|watermark)(?:[\/_.-]|$)|punchng.*logo|cropped-punch|PUNCH-Logo|realssanews\.com\.ng\/logo|\/logo\.(?:png|jpg|jpeg|svg|webp)/i;

const BRAND_FALLBACK = 'https://realssanews.com.ng/logo.png';

function isBadImage(url) {
  if (!url || typeof url !== 'string') return true;
  if (!/^https?:\/\//i.test(url)) return true;
  if (LOGO_RE.test(url)) return true;
  // 1x1 trackers / data uris
  if (url.startsWith('data:')) return true;
  return false;
}

function pickGood(url) {
  return isBadImage(url) ? null : url;
}

async function resolveGoogleNewsUrl(url) {
  try {
    if (!/news\.google\.com/i.test(url)) return url;
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; RealSSABot/1.0; +https://realssanews.com.ng)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (res.url && !/news\.google\.com/i.test(res.url)) return res.url;
    const html = await res.text();
    const m =
      html.match(
        /<a[^>]+href=["'](https?:\/\/(?!news\.google\.com)[^"']+)["'][^>]*>\s*<span/i
      ) ||
      html.match(/url=(https?:\/\/[^&"']+)/i);
    if (m?.[1]) return decodeURIComponent(m[1]);
    return url;
  } catch {
    return url;
  }
}

async function scrapeBestImage(articleUrl, title = '') {
  try {
    const { findBestArticleImage } = require('./aggressiveImageScraper');
    const resolved = await resolveGoogleNewsUrl(articleUrl);
    const img = await findBestArticleImage(resolved, null, title);
    return pickGood(img);
  } catch (e) {
    console.warn('[enrichFeedImages] scrape failed:', e.message);
    return null;
  }
}

async function mapPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let i = 0;
  async function run() {
    while (i < items.length) {
      const idx = i++;
      try {
        results[idx] = await worker(items[idx], idx);
      } catch {
        results[idx] = null;
      }
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: n }, run));
  return results;
}

/**
 * Mutates articles in place: fills `.image` with a real photo when missing/logo.
 * @param {Array<{image?: string, externalLink?: string, external_link?: string, title?: string}>} articles
 * @param {{ limit?: number, concurrency?: number }} opts
 */
async function enrichArticleImages(articles, opts = {}) {
  const limit = opts.limit ?? 30;
  const concurrency = opts.concurrency ?? 6;
  if (!Array.isArray(articles) || !articles.length) return articles;

  const need = articles
    .map((a, index) => ({ a, index }))
    .filter(({ a }) => isBadImage(a.image))
    .slice(0, limit);

  if (!need.length) return articles;

  await mapPool(need, concurrency, async ({ a }) => {
    const link = a.externalLink || a.external_link || a.link || '';
    if (!link) return;
    const img = await scrapeBestImage(link, a.title || '');
    if (img) a.image = img;
  });

  // Final safety: never leave undefined image on a card payload
  for (const a of articles) {
    if (!a.image) a.image = BRAND_FALLBACK;
  }
  return articles;
}

module.exports = {
  isBadImage,
  pickGood,
  scrapeBestImage,
  enrichArticleImages,
  BRAND_FALLBACK,
  LOGO_RE,
};
