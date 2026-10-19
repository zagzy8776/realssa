/**
 * OG Image Rescue — GET /api/og-image?url=<article-page-url>
 * On-demand golden-image extraction: pulls og:image / twitter:image /
 * JSON-LD / first real content <img> straight off the publisher page.
 * This is the rescue tier for the Golden Image engine — when an RSS feed
 * only offers a logo (looking at you, Punch), we go scrape the real story
 * photo from the article page itself.
 * Cached 10 days in Upstash Redis (REST — edge safe) + in-memory fallback.
 */

const crypto = require('crypto');

const mem = new Map(); // key -> { image, at }
const MEM_TTL = 6 * 60 * 60 * 1000;
const MEM_NEG_TTL = 5 * 60 * 1000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 RealSSA-Harvester/2.0';

function getUpstash() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: String(url).replace(/\/+$/, ''), token };
}

async function cacheGet(key) {
  const u = getUpstash();
  if (u) {
    try {
      const r = await fetch(`${u.url}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${u.token}` },
        signal: AbortSignal.timeout(2500),
      });
      if (r.ok) {
        const d = await r.json();
        if (d && typeof d.result === 'string' && d.result) return d.result;
      }
    } catch {}
  }
  const m = mem.get(key);
  if (m && Date.now() - m.at < (m.image ? MEM_TTL : MEM_NEG_TTL)) return m.image || null;
  return null;
}

async function cacheSet(key, value, ttlSeconds) {
  const u = getUpstash();
  if (u && value) {
    try {
      await fetch(
        `${u.url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}/ex/${ttlSeconds}`,
        { method: 'POST', headers: { Authorization: `Bearer ${u.token}` }, signal: AbortSignal.timeout(2500) }
      );
    } catch {}
  }
  mem.set(key, { image: value || null, at: Date.now() });
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/gi, '&')
    .replace(/&#0?38;/g, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim();
}

function extractImage(html) {
  const meta = (re) => {
    const m = html.match(re);
    return m ? decodeEntities(m[1]) : '';
  };
  return (
    meta(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) ||
    meta(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
    meta(/<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i) ||
    meta(/<meta[^>]+name=["']thumbnail["'][^>]+content=["']([^"']+)["']/i) ||
    meta(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i) ||
    (() => {
      const m = html.match(/"@type"\s*:\s*"(?:News)?Article"[\s\S]{0,900}?"image"\s*:\s*(?:\[)?\s*"(https?:\/\/[^"]+)"/i);
      return m ? decodeEntities(m[1]) : '';
    })() ||
    (() => {
      const cand = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)]
        .map(x => decodeEntities(x[1]))
        .find(u =>
          /\/(?:wp-content\/uploads|images?\/|media\/|photos?\/|storage\/)/i.test(u) &&
          !/logo|sprite|favicon|avatar|icon|placeholder|banner-ad/i.test(u)
        );
      return cand || '';
    })()
  );
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1800');

  const rawUrl = String(req.query.url || '').trim();
  if (!/^https?:\/\//i.test(rawUrl) || rawUrl.length > 800) {
    return res.status(200).json({ url: rawUrl, image: null, reason: 'invalid-url' });
  }

  const key = `ogimg:${crypto.createHash('sha1').update(rawUrl).digest('hex')}`;
  const cached = await cacheGet(key);
  if (cached) {
    return res.status(200).json({ url: rawUrl, image: cached, cached: true });
  }

  try {
    const res2 = await fetch(rawUrl, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    });
    if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
    // Cap the read: og:image lives in <head>, no need for the whole body
    const reader = res2.body?.getReader();
    let html = '';
    if (reader) {
      const decoder = new TextDecoder();
      let total = 0;
      while (total < 400000) {
        const { done, value } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
        total += value.byteLength;
        if (/<\/head>/i.test(html)) break;
      }
      reader.cancel().catch(() => {});
    } else {
      html = (await res2.text()).slice(0, 400000);
    }

    let image = extractImage(html);
    if (image && !/^https?:\/\//i.test(image)) {
      try { image = new URL(image, rawUrl).href; } catch { image = ''; }
    }
    if (image && !/\.(svg|gif)(\?|$)/i.test(image)) {
      await cacheSet(key, image, 864000); // 10 days
      return res.status(200).json({ url: rawUrl, image, cached: false });
    }
    await cacheSet(key, '', 600); // negative cache 10 min
    return res.status(200).json({ url: rawUrl, image: null, reason: 'no-image-found' });
  } catch (err) {
    return res.status(200).json({ url: rawUrl, image: null, reason: err.message });
  }
};
