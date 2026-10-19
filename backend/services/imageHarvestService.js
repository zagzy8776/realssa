/**
 * Golden Image Harvest Service
 * ============================
 * The visual dominance engine. Every article gets ONE high-quality "golden"
 * image, resolved in tiers and then re-hosted on OUR Cloudflare R2 bucket so
 * it never breaks, never lags, and we own the delivery traffic:
 *
 *   Tier 1 — RSS media image (if it's a real story image, not a logo)
 *   Tier 2 — Article-page scrape (og:image / twitter:image / JSON-LD / hero <img>)
 *   Tier 3 — Keep whatever we had (better than nothing)
 *   Final  — Mirror the winner into R2 under news/{yyyy}/{mm}/{hash}.jpg
 *
 * Also powers `healDeadImages()` — a batched backfill that upgrades legacy
 * rows (logo URLs, dead links, fallbacks) to golden R2-hosted images.
 */

const crypto = require('crypto');
const axios = require('axios');
const r2Service = require('./r2Service');

const LOGOISH = /logo|sprite|favicon|avatar|placeholder|default[-_]?image|banner|badge|icon|watermark/i;
const GOOD_HINTS = /\/(?:wp-content\/uploads|images?\/|media\/|photos?\/|storage\/|sites\/\d+\/files)\//i;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 RealSSA-Harvester/2.0';

// De-dupe guard so ingestion never harvests the same article twice concurrently
const inFlight = new Set();

/**
 * Detects the junk images that plague RSS feeds: publisher logos (the classic
 * Punch problem), sprites, 50px thumbnails, SVG icons, our own fallback logo.
 */
function isLowQualityImage(url) {
  if (!url) return true;
  const u = String(url);
  if (u.includes('realssanews.com.ng/logo.png')) return true;
  if (LOGOISH.test(u) && !GOOD_HINTS.test(u)) return true;
  const w = u.match(/[?&](?:w|width)=(\d{1,4})/);
  if (w && Number(w[1]) < 300) return true;
  if (/\.svg(\?|$)/i.test(u)) return true;
  if (/\.gif(\?|$)/i.test(u)) return true; // banners/trackers mostly
  return false;
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/gi, '&')
    .replace(/&#0?38;/g, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .trim();
}

function extractFromHtml(html, baseUrl) {
  const meta = (re) => {
    const m = html.match(re);
    return m ? decodeEntities(m[1]) : '';
  };
  let image =
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
    })();

  if (image && !/^https?:\/\//i.test(image) && baseUrl) {
    try { image = new URL(image, baseUrl).href; } catch { image = ''; }
  }
  return image;
}

// __HARVEST_PART2__
