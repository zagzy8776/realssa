'use strict';
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const cheerio = require('cheerio');

// ─── Backend base URL for the image compression proxy ────────────────────────
// In production this is the Fly.io backend. In dev it's localhost:5000.
const BACKEND = process.env.BACKEND_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://realssa-backend.fly.dev'   // adjust if your Fly.io URL differs
    : 'http://localhost:5000');

// Rewrite an image src to route through /api/img (Opera Mini-style compression)
function imgProxyUrl(src, maxW = 900) {
  if (!src || src.startsWith('data:')) return src; // data URIs pass through directly
  return `${BACKEND}/api/img?url=${encodeURIComponent(src)}&w=${maxW}`;
}

// ─── Known ad/tracker domains — nodes from these are silently dropped ────────
const AD_DOMAINS = [
  'doubleclick.net', 'googleadservices.com', 'googlesyndication.com',
  'amazon-adsystem.com', 'outbrain.com', 'taboola.com', 'disqus.com',
  'facebook.net', 'connect.facebook.net', 'google-analytics.com',
  'hotjar.com', 'clarity.ms', 'ads.twitter.com', 'static.ads-twitter.com',
  'adform.net', 'adsymptotic.com', 'adsafeprotected.com', 'moatads.com',
  'scorecardresearch.com', 'quantserve.com', 'chartbeat.com',
];

function isAdUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try { return AD_DOMAINS.some(d => url.includes(d)); } catch { return false; }
}

function resolveUrl(src, baseOrigin) {
  if (!src || typeof src !== 'string') return '';
  if (src.startsWith('http')) return src;
  if (src.startsWith('//')) return 'https:' + src;
  if (src.startsWith('/')) return baseOrigin + src;
  if (src.startsWith('data:')) return src; // data URIs pass through
  return baseOrigin + '/' + src;
}

function getYouTubeId(url) {
  const m = url.match(/(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

// ─── Recursive DOM Walker ─────────────────────────────────────────────────────
function walkDom($el, $, nodes, baseOrigin) {
  $el.children().each((_, el) => {
    const tag = (el.tagName || '').toLowerCase();
    if (!tag) return;

    // Skip non-visual/non-content elements entirely
    if (['script', 'style', 'noscript', 'head', 'meta', 'link',
         'svg', 'path', 'nav', 'aside', 'footer', 'header',
         'form', 'button', 'input', 'select', 'textarea'].includes(tag)) return;

    const $node = $(el);
    const cls = ($node.attr('class') || '').toLowerCase();
    const id = ($node.attr('id') || '').toLowerCase();

    // Skip known ad/social/cookie containers by class/id heuristics
    const adPatterns = ['ad', 'advertisement', 'cookie', 'popup', 'banner', 'promo',
      'subscribe', 'newsletter', 'social-share', 'sidebar', 'related-posts', 'widget'];
    if (adPatterns.some(p => cls.includes(p) || id.includes(p))) return;

    // ── Headings ──────────────────────────────────────────────────────────────
    if (/^h[1-6]$/.test(tag)) {
      const text = $node.text().trim();
      if (text && text.length > 1) {
        nodes.push({ type: 'heading', level: parseInt(tag[1]), text });
      }

    // ── Paragraphs ────────────────────────────────────────────────────────────
    } else if (tag === 'p') {
      const text = $node.text().trim();
      if (text && text.length > 20) {
        nodes.push({ type: 'paragraph', text });
      }

    // ── Images ────────────────────────────────────────────────────────────────
    } else if (tag === 'img') {
      const rawSrc = $node.attr('src') || $node.attr('data-src') ||
                     $node.attr('data-lazy-src') || $node.attr('data-original') || '';
      const src = resolveUrl(rawSrc, baseOrigin);
      if (src && !isAdUrl(src) && !src.startsWith('data:image/gif')) {
        const alt = $node.attr('alt') || '';
        const caption = $node.closest('figure').find('figcaption').text().trim();
        const width = parseInt($node.attr('width') || '0');
        const height = parseInt($node.attr('height') || '0');
        // Skip tiny tracking pixels (width/height set and both < 10px)
        if (width > 0 && height > 0 && (width < 10 || height < 10)) return;
        // Route through compression proxy — frontend gets WebP, not 3MB original
        nodes.push({ type: 'image', src: imgProxyUrl(src, 900), alt, caption });
      }

    // ── Figures (wraps img + caption) ─────────────────────────────────────────
    } else if (tag === 'figure') {
      walkDom($node, $, nodes, baseOrigin);

    // ── Lists ─────────────────────────────────────────────────────────────────
    } else if (tag === 'ul' || tag === 'ol') {
      const items = [];
      $node.children('li').each((_, li) => {
        const t = $(li).text().trim();
        if (t && t.length > 3) items.push(t);
      });
      if (items.length) {
        nodes.push({ type: 'list', ordered: tag === 'ol', items });
      }

    // ── Blockquotes ───────────────────────────────────────────────────────────
    } else if (tag === 'blockquote') {
      const text = $node.text().trim();
      if (text && text.length > 10) {
        nodes.push({ type: 'blockquote', text });
      }

    // ── Code blocks ───────────────────────────────────────────────────────────
    } else if (tag === 'pre') {
      const codeEl = $node.find('code');
      const content = (codeEl.length ? codeEl.text() : $node.text()).trim();
      const lang = (codeEl.attr('class') || '').match(/language-(\w+)/)?.[1] || '';
      if (content && content.length > 5) {
        nodes.push({ type: 'code', language: lang, content });
      }

    // ── Tables ────────────────────────────────────────────────────────────────
    } else if (tag === 'table') {
      const headers = [];
      $node.find('thead th, thead td').each((_, th) => {
        headers.push($(th).text().trim());
      });
      const rows = [];
      $node.find('tbody tr').each((_, tr) => {
        const row = [];
        $(tr).find('td, th').each((_, td) => row.push($(td).text().trim()));
        if (row.some(c => c)) rows.push(row);
      });
      if (rows.length) {
        nodes.push({ type: 'table', headers, rows });
      }

    // ── Iframes (video embeds) ─────────────────────────────────────────────────
    } else if (tag === 'iframe') {
      const src = $node.attr('src') || '';
      if (src.includes('youtube') || src.includes('youtu.be')) {
        const videoId = getYouTubeId(src);
        if (videoId) nodes.push({ type: 'video', platform: 'youtube', videoId });
      } else if (src.includes('vimeo')) {
        nodes.push({ type: 'video', platform: 'vimeo', src });
      }

    // ── Horizontal rule ───────────────────────────────────────────────────────
    } else if (tag === 'hr') {
      nodes.push({ type: 'divider' });

    // ── Recurse into container elements ───────────────────────────────────────
    } else {
      walkDom($node, $, nodes, baseOrigin);
    }
  });
}

// ─── Main exported function ───────────────────────────────────────────────────
async function parsePage(html, url) {
  let baseOrigin = '';
  try {
    const u = new URL(url);
    baseOrigin = `${u.protocol}//${u.host}`;
  } catch(_) {}

  // ── Metadata via cheerio ────────────────────────────────────────────────────
  const $full = cheerio.load(html);

  const getFavicon = () => {
    const candidates = [
      $full('link[rel="icon"][sizes="32x32"]').attr('href'),
      $full('link[rel="icon"][sizes="16x16"]').attr('href'),
      $full('link[rel="shortcut icon"]').attr('href'),
      $full('link[rel="icon"]').attr('href'),
      $full('link[rel="apple-touch-icon"]').attr('href'),
    ];
    const found = candidates.find(Boolean) || '/favicon.ico';
    return resolveUrl(found, baseOrigin);
  };

  const meta = {
    title: ($full('meta[property="og:title"]').attr('content') || $full('title').text() || '').trim(),
    description: ($full('meta[property="og:description"]').attr('content') ||
      $full('meta[name="description"]').attr('content') || '').trim(),
    image: $full('meta[property="og:image"]').attr('content') ||
      $full('meta[name="twitter:image"]').attr('content') || '',
    siteName: ($full('meta[property="og:site_name"]').attr('content') || '').trim() ||
      (baseOrigin ? new URL(url).hostname.replace(/^www\./, '') : ''),
    favicon: getFavicon(),
    lang: $full('html').attr('lang') || 'en',
    author: ($full('meta[name="author"]').attr('content') ||
      $full('meta[property="article:author"]').attr('content') || '').trim(),
    publishedTime: $full('meta[property="article:published_time"]').attr('content') || '',
    readingTime: 1,
    url,
  };

  // ── SPA detection — React/Vue/Angular apps render nothing without JS ─────────
  const bodyText = $full('body').text().replace(/\s+/g, ' ').trim();
  const hasSpaRoot = $full('#root, #app, #__next, [data-reactroot]').length > 0;
  const isLikelyEmpty = bodyText.length < 350;

  if (hasSpaRoot && isLikelyEmpty) {
    return { success: true, requiresProxy: true, reason: 'spa', meta, nodes: [] };
  }

  // ── Readability extraction ──────────────────────────────────────────────────
  let nodes = [];
  let readabilityFailed = false;

  try {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (article && article.content) {
      if (!meta.title && article.title) meta.title = article.title.trim();
      if (!meta.description && article.excerpt) meta.description = article.excerpt.trim();
      if (!meta.author && article.byline) meta.author = article.byline.trim();
      if (!meta.siteName && article.siteName) meta.siteName = article.siteName.trim();

      const $content = cheerio.load(article.content);
      walkDom($content('body'), $content, nodes, baseOrigin);
    } else {
      readabilityFailed = true;
    }
  } catch(e) {
    console.error('[pageParser] Readability error:', e.message);
    readabilityFailed = true;
  }

  // ── Not enough text content → proxy fallback ─────────────────────────────────
  const paragraphs = nodes.filter(n => n.type === 'paragraph');
  if (readabilityFailed || paragraphs.length < 2) {
    return { success: true, requiresProxy: true, reason: 'insufficient_content', meta, nodes: [] };
  }

  // ── Calculate reading time ────────────────────────────────────────────────
  const wordCount = nodes
    .filter(n => n.type === 'paragraph' || n.type === 'heading')
    .map(n => n.text || '')
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length;
  meta.readingTime = Math.max(1, Math.ceil(wordCount / 200));

  // ── Deduplicate consecutive dividers, strip leading/trailing ones ────────────
  nodes = nodes.filter((n, i, arr) => {
    if (n.type === 'divider' && (i === 0 || i === arr.length - 1)) return false;
    if (n.type === 'divider' && arr[i - 1]?.type === 'divider') return false;
    return true;
  });

  return { success: true, requiresProxy: false, meta, nodes, url };
}

module.exports = { parsePage };
