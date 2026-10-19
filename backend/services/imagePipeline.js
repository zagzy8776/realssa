/**
 * Image Pipeline — "Visual Dominance" engine
 *
 * 1. Extracts candidate images from an article URL (og:image, twitter:image,
 *    largest <img>, first <img>) using cheerio.
 * 2. Downloads the image and re-hosts it on Cloudflare R2 (fast CDN,
 *    no hotlink-blocking, no layout shift on the frontend).
 * 3. Re-sizes/compresses via sharp for aggressive loading speed.
 * 4. Generates a power-word "AI headline" variant for the card.
 *
 * All DB writes are fail-soft: if the image_cache table doesn't exist yet
 * (schema extension not applied), the pipeline still returns an R2 URL.
 */

const cheerio = require('cheerio');
const crypto = require('crypto');
const { pgRun } = require('./pg');
const r2 = require('./r2Service');

// Lightweight namespaced logger (project logger.js is a static metrics class)
const LOG = {
  info: (m) => console.log(`[ImagePipeline] ${m}`),
  warn: (m) => console.warn(`[ImagePipeline] ${m}`),
  error: (m) => console.error(`[ImagePipeline] ${m}`),
};

let sharp = null;
try { sharp = require('sharp'); } catch (e) { sharp = null; }

const MAX_WIDTH = 1280;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB download cap
const USER_AGENT = 'Mozilla/5.0 (compatible; RealSSA-VisualEngine/1.0)';

/**
 * Extract candidate image URLs from a page.
 * Priority: og:image > twitter:image > largest img > first img.
 */
async function extractImagesFromPage(pageUrl, { timeout = 12000 } = {}) {
  try {
    const res = await fetch(pageUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(timeout),
      redirect: 'follow',
    });
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);

    const candidates = [];
    const og = $('meta[property="og:image"]').attr('content')
      || $('meta[name="og:image"]').attr('content');
    if (og) candidates.push({ url: og, source: 'og', weight: 100 });

    const tw = $('meta[name="twitter:image"]').attr('content');
    if (tw) candidates.push({ url: tw, source: 'twitter', weight: 95 });

    // Largest <img> in article body
    $('img').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
      if (!src) return;
      const w = parseInt($(el).attr('width') || '0', 10);
      const h = parseInt($(el).attr('height') || '0', 10);
      const area = w * h;
      candidates.push({
        url: src,
        source: area > 200000 ? 'body-large' : 'body',
        weight: Math.min(80, 10 + Math.floor(area / 50000)),
      });
    });

    // Resolve relative URLs
    const resolved = candidates
      .map((c) => ({ ...c, url: new URL(c.url, pageUrl).toString() }))
      .filter((c) => /^https?:\/\//.test(c.url))
      .sort((a, b) => b.weight - a.weight);

    // Dedupe by URL
    const seen = new Set();
    return resolved.filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true)));
  } catch (err) {
    LOG.warn(`extractImagesFromPage failed for ${pageUrl}: ${err.message}`);
    return [];
  }
}

/**
 * Pick the best image from a candidate list, preferring og/meta images.
 */
function pickBestImage(candidates) {
  if (!candidates || !candidates.length) return null;
  return candidates[0];
}

/**
 * Download + re-host a single image on R2.
 * Returns { r2Url, width, height, contentType } or null.
 */
async function rehostImage(imageUrl, { category = 'general', headline = '' } = {}) {
  try {
    // Hash key for cache-ability
    const hash = crypto.createHash('md5').update(imageUrl).digest('hex').slice(0, 16);
    const catSlug = String(category || 'general').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
    const key = `empire-images/${catSlug}/${Date.now()}-${hash}.jpg`;

    const res = await fetch(imageUrl, {
      headers: { 'User-Agent': USER_AGENT, 'Referer': new URL(imageUrl).origin + '/' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      LOG.warn(`Image download failed (${res.status}) for ${imageUrl}`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_FILE_SIZE) {
      LOG.warn(`Image too large (${buf.length}B): ${imageUrl}`);
      return null;
    }

    // Re-size/compress for aggressive front-loading
    let outBuf = buf;
    let contentType = res.headers.get('content-type') || 'image/jpeg';
    let width = null;
    let height = null;
    if (sharp) {
      try {
        const meta = await sharp(buf).rotate().metadata();
        width = meta.width || null;
        height = meta.height || null;
        outBuf = await sharp(buf).rotate()
          .resize({ width: MAX_WIDTH, withoutEnlargement: true })
          .jpeg({ quality: 82 }).toBuffer();
        contentType = 'image/jpeg';
      } catch (e) {
        // Keep original buffer if sharp fails (e.g. unusual format)
      }
    }

    const r2Url = await r2.uploadBuffer(outBuf, key, contentType);

    // Persist to image_cache (fail-soft)
    try {
      await pgRun(
        `INSERT INTO image_cache (source_url, r2_url, r2_key, headline, category, width, height, content_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (source_url) DO UPDATE SET r2_url = EXCLUDED.r2_url,
          r2_key = EXCLUDED.r2_key, headline = EXCLUDED.headline`,
        [imageUrl, r2Url, key, headline || null, catSlug, width, height, contentType]
      );
    } catch (e) {
      LOG.warn(`image_cache write skipped (table may not exist): ${e.message}`);
    }

    LOG.info(`Re-hosted ${imageUrl} -> ${r2Url}`);
    return { r2Url, width, height, contentType, r2Key: key };
  } catch (err) {
    LOG.warn(`rehostImage failed for ${imageUrl}: ${err.message}`);
    return null;
  }
}

/**
 * End-to-end: scrape a page, pick the best image, re-host it on R2.
 * Returns { r2Url, originalUrl, width, height, candidates } (r2Url may be null).
 */
async function scrapeAndRehost(pageUrl, { category, headline } = {}) {
  if (!pageUrl) return { r2Url: null, candidates: [] };
  const candidates = await extractImagesFromPage(pageUrl);
  const best = pickBestImage(candidates);
  if (!best) return { r2Url: null, candidates };
  const result = await rehostImage(best.url, { category, headline });
  return {
    r2Url: result ? result.r2Url : best.url, // fall back to original on rehost failure
    originalUrl: best.url,
    width: result ? result.width : null,
    height: result ? result.height : null,
    candidates: candidates.map((c) => c.url).slice(0, 5),
  };
}

/**
 * Power-word headline generator (local, no AI dependency).
 * Transforms a flat headline into a high-CTR variant.
 */
function powerHeadline(title, { sentiment = 'neutral' } = {}) {
  if (!title) return null;
  const t = title.trim();
  const powerSets = {
    fear: ['WARNING: ', 'SHOCKING: ', 'ALERT: '],
    greed: ['SURGES: ', 'RALLIES: ', 'BREAKTHROUGH: '],
    urgency: ['BREAKING: ', 'JUST IN: '],
    curiosity: ['INSIDE: ', "DON'T MISS: "],
  };
  const s = String(sentiment).toLowerCase();
  let prefix = '';
  if (s === 'fear' || s === 'negative') prefix = powerSets.fear[Math.floor(Math.random() * powerSets.fear.length)];
  else if (s === 'greed' || s === 'positive') prefix = powerSets.greed[Math.floor(Math.random() * powerSets.greed.length)];
  else if (s === 'breaking' || s === 'urgent') prefix = powerSets.urgency[Math.floor(Math.random() * powerSets.urgency.length)];
  else prefix = Math.random() < 0.4 ? powerSets.curiosity[Math.floor(Math.random() * powerSets.curiosity.length)] : '';

  let out = prefix + t;
  // Add an ellipsis cliffhanger if long and not already ending punctuation
  if (out.length > 72 && !/[.!?…]$/.test(out)) {
    out = out.slice(0, 72).replace(/\s+\S*$/, '') + '…';
  }
  return out;
}

module.exports = {
  extractImagesFromPage,
  pickBestImage,
  rehostImage,
  scrapeAndRehost,
  powerHeadline,
  isSharpAvailable: () => !!sharp,
};