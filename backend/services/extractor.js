const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const dns = require('dns').promises;

const PRIVATE_IP_RE = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|::1$|fc00:|fd)/;

async function isSafeUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    const { address } = await dns.lookup(u.hostname);
    return !PRIVATE_IP_RE.test(address);
  } catch {
    return false;
  }
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
];

function getStealthHeaders(url, uaIndex = 0) {
  let host = 'www.google.com';
  try { host = new URL(url).hostname; } catch { /* ignore */ }
  const ua = USER_AGENTS[uaIndex % USER_AGENTS.length];
  return {
    'User-Agent': ua,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    'Upgrade-Insecure-Requests': '1',
    Referer: `https://${host}/`,
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
  };
}

function absoluteUrl(base, maybeRelative) {
  if (!maybeRelative || typeof maybeRelative !== 'string') return null;
  const cleaned = maybeRelative.trim().replace(/^\/\//, 'https://');
  try {
    return new URL(cleaned, base).toString();
  } catch {
    return null;
  }
}

function extractMetaImage(document, pageUrl) {
  const selectors = [
    'meta[property="og:image"]',
    'meta[property="og:image:secure_url"]',
    'meta[name="twitter:image"]',
    'meta[name="twitter:image:src"]',
    'meta[itemprop="image"]',
    'link[rel="image_src"]',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const raw = el?.getAttribute('content') || el?.getAttribute('href');
    const abs = absoluteUrl(pageUrl, raw);
    if (abs && /^https?:\/\//i.test(abs)) return abs;
  }

  const imgs = Array.from(document.querySelectorAll('article img, .post-content img, .entry-content img, main img, img'));
  let best = null;
  let bestScore = 0;
  for (const img of imgs) {
    const src = absoluteUrl(pageUrl, img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy-src'));
    if (!src || /logo|icon|sprite|avatar|pixel|1x1|spacer/i.test(src)) continue;
    const w = Number(img.getAttribute('width') || 0);
    const h = Number(img.getAttribute('height') || 0);
    const score = w * h || (src.length > 40 ? 100 : 1);
    if (score > bestScore) {
      bestScore = score;
      best = src;
    }
  }
  return best;
}

function extractBySelectors(document) {
  const selectors = [
    'article [itemprop="articleBody"]',
    'article .article-body',
    'article .story-body',
    'article .post-content',
    'article .entry-content',
    'article .content__article-body',
    '[data-component="text-block"]',
    '.article__body',
    '.story-content',
    '.post__content',
    'main article',
    'article',
    'main',
  ];
  for (const sel of selectors) {
    const node = document.querySelector(sel);
    if (!node) continue;
    const clone = node.cloneNode(true);
    clone.querySelectorAll('script, style, noscript, iframe, aside, nav, .ad, .ads, .share, .social').forEach((n) => n.remove());
    const text = (clone.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.length >= 200) {
      return {
        textContent: text,
        htmlContent: clone.innerHTML,
        title: document.querySelector('h1')?.textContent?.trim() || document.title,
      };
    }
  }
  return null;
}

async function unwrapGoogleNewsUrl(url) {
  try {
    const u = new URL(url);
    if (!/news\.google\.com/i.test(u.hostname)) return url;

    const headers = getStealthHeaders(url, 0);
    const res = await fetch(url, {
      method: 'GET',
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    if (res.url && !/news\.google\.com/i.test(new URL(res.url).hostname)) {
      return res.url;
    }

    const html = await res.text();
    const m =
      html.match(/data-n-au="(https?:\/\/[^"]+)"/i) ||
      html.match(/<a[^>]+href="(https?:\/\/(?!news\.google)[^"]+)"[^>]*>\s*<h/i) ||
      html.match(/url=(https?:\/\/(?!news\.google)[^&\s"']+)/i);
    if (m?.[1]) {
      try {
        return decodeURIComponent(m[1]);
      } catch {
        return m[1];
      }
    }
  } catch (err) {
    console.warn('[Extractor] Google News unwrap failed:', err.message);
  }
  return url;
}

async function fetchHtml(url, attempt = 0) {
  const headers = getStealthHeaders(url, attempt);
  const response = await fetch(url, {
    method: 'GET',
    headers,
    redirect: 'follow',
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const html = await response.text();
  if (!html || html.length < 200) throw new Error('empty html');
  return { html, finalUrl: response.url || url };
}

async function aiFallbackExtractor(html, url) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!GEMINI_API_KEY) return null;
  const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent';

  const cleanHtml = String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12000);

  if (cleanHtml.length < 200) return null;

  const prompt = `Extract the main news article body text from this page content for ${url}. Return ONLY the article text, no intro. If you cannot find an article, return EMPTY.\n\n${cleanHtml}`;

  try {
    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 2500, temperature: 0.1 },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const textContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (textContent && textContent.length > 120 && !/^EMPTY/i.test(textContent.trim())) {
      return { textContent: textContent.trim() };
    }
  } catch (err) {
    console.warn(`[Extractor] AI Fallback error: ${err.message}`);
  }
  return null;
}

async function scrapeWithFirecrawl(url) {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'html'],
        onlyMainContent: true,
      }),
      signal: AbortSignal.timeout(18000),
    });

    if (!response.ok) return null;
    const data = await response.json();
    if (data?.success && data.data) {
      const markdown = (data.data.markdown || '').trim();
      if (markdown.length < 100) return null;
      return {
        title: data.data.metadata?.title || new URL(url).hostname,
        textContent: markdown,
        htmlContent: data.data.html || `<p>${markdown.replace(/\n/g, '<br>')}</p>`,
        excerpt: data.data.metadata?.description || markdown.slice(0, 200),
        byline: data.data.metadata?.author || '',
        siteName: data.data.metadata?.siteName || new URL(url).hostname,
        image: data.data.metadata?.ogImage || data.data.metadata?.image || null,
        length: markdown.length,
      };
    }
  } catch (err) {
    console.warn(`[Firecrawl] Scraping failed for ${url}:`, err.message);
  }
  return null;
}

async function extractArticle(rawUrl, options = {}) {
  const fallbackText = String(options.fallbackText || options.excerpt || '').trim();
  const fallbackImage = options.fallbackImage || options.image || null;
  const fallbackTitle = options.fallbackTitle || options.title || null;

  let url = String(rawUrl || '').trim();
  if (!url) return null;

  if (!(await isSafeUrl(url))) {
    console.warn(`[Extractor] Blocked SSRF attempt: ${url}`);
    return null;
  }

  url = await unwrapGoogleNewsUrl(url);
  if (!(await isSafeUrl(url))) return null;

  let html = null;
  let finalUrl = url;
  let lastError = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const fetched = await fetchHtml(url, attempt);
      html = fetched.html;
      finalUrl = fetched.finalUrl || url;
      if (/captcha|access denied|just a moment|cf-browser-verification/i.test(html) && html.length < 5000) {
        lastError = new Error('challenge page');
        continue;
      }
      break;
    } catch (err) {
      lastError = err;
      console.warn(`[Extractor] Fetch attempt ${attempt + 1} failed for ${url}: ${err.message}`);
    }
  }

  if (!html) {
    const firecrawlEarly = await scrapeWithFirecrawl(url);
    if (firecrawlEarly) {
      if (!firecrawlEarly.image && fallbackImage) firecrawlEarly.image = fallbackImage;
      return firecrawlEarly;
    }
  }

  let result = null;
  let heroImage = fallbackImage;

  if (html) {
    try {
      const dom = new JSDOM(html, { url: finalUrl });
      const document = dom.window.document;
      heroImage = extractMetaImage(document, finalUrl) || fallbackImage;

      try {
        const reader = new Readability(document.cloneNode(true));
        const article = reader.parse();
        if (article?.textContent && article.textContent.trim().length >= 150) {
          result = {
            title: article.title || fallbackTitle || document.title,
            textContent: article.textContent.trim(),
            htmlContent: article.content,
            excerpt: article.excerpt || article.textContent.trim().slice(0, 240),
            byline: article.byline || '',
            siteName: article.siteName || new URL(finalUrl).hostname.replace(/^www\./, ''),
            image: heroImage,
            length: article.textContent.trim().length,
            publishedTime: '',
          };
        }
      } catch (err) {
        console.warn('[Extractor] Readability error:', err.message);
      }

      if (!result || result.textContent.length < 200) {
        const sel = extractBySelectors(document);
        if (sel && sel.textContent.length >= 200) {
          result = {
            title: sel.title || fallbackTitle || document.title,
            textContent: sel.textContent,
            htmlContent: sel.htmlContent || `<p>${sel.textContent}</p>`,
            excerpt: sel.textContent.slice(0, 240),
            byline: '',
            siteName: new URL(finalUrl).hostname.replace(/^www\./, ''),
            image: heroImage,
            length: sel.textContent.length,
            publishedTime: '',
          };
        }
      }

      if (!result || result.textContent.length < 200) {
        const aiResult = await aiFallbackExtractor(html, finalUrl);
        if (aiResult?.textContent) {
          result = {
            title: fallbackTitle || document.title || new URL(finalUrl).hostname,
            textContent: aiResult.textContent,
            htmlContent: `<p>${aiResult.textContent.replace(/\n+/g, '</p><p>')}</p>`,
            excerpt: aiResult.textContent.slice(0, 240),
            byline: 'AI Extracted',
            siteName: new URL(finalUrl).hostname.replace(/^www\./, ''),
            image: heroImage,
            length: aiResult.textContent.length,
            publishedTime: '',
          };
        }
      }
    } catch (err) {
      console.warn('[Extractor] DOM parse failed:', err.message);
      lastError = err;
    }
  }

  if (!result || result.textContent.length < 200) {
    const firecrawlResult = await scrapeWithFirecrawl(url);
    if (firecrawlResult) {
      if (!firecrawlResult.image) firecrawlResult.image = heroImage || fallbackImage;
      result = firecrawlResult;
    }
  }

  if ((!result || result.textContent.length < 100) && fallbackText.length >= 40) {
    const paragraphs = fallbackText
      .split(/\n+|(?<=\.)\s+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 20);
    result = {
      title: fallbackTitle || (result?.title) || new URL(url).hostname,
      textContent: fallbackText,
      htmlContent: paragraphs.length
        ? paragraphs.map((p) => `<p>${p}</p>`).join('')
        : `<p>${fallbackText}</p>`,
      excerpt: fallbackText.slice(0, 240),
      byline: '',
      siteName: new URL(url).hostname.replace(/^www\./, ''),
      image: heroImage || fallbackImage,
      length: fallbackText.length,
      publishedTime: '',
      partial: true,
    };
  }

  if (!result || !result.textContent || result.textContent.trim().length < 40) {
    console.warn(`[Extractor] All strategies failed for ${url}`, lastError?.message || '');
    return null;
  }

  if (!result.image) result.image = heroImage || fallbackImage || null;
  result.sourceUrl = finalUrl;
  return result;
}

async function fetchArticleImage(url) {
  try {
    if (!(await isSafeUrl(url))) return null;
    const resolved = await unwrapGoogleNewsUrl(url);
    const { html, finalUrl } = await fetchHtml(resolved, 0);
    const dom = new JSDOM(html, { url: finalUrl });
    return extractMetaImage(dom.window.document, finalUrl);
  } catch {
    return null;
  }
}

module.exports = { extractArticle, fetchArticleImage, unwrapGoogleNewsUrl };
