const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const dns = require('dns').promises;

// SSRF protection helper
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

// User-Agent Rotation Pool
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
];

/**
 * Spoofs headers using a rotating User-Agent.
 */
function getStealthHeaders() {
  const randomUserAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  return {
    'User-Agent': randomUserAgent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'max-age=0',
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1'
  };
}

/**
 * Extracts full article content from a given URL using Mozilla Readability.
 * @param {string} url - The URL to scrape.
 * @returns {Promise<{textContent: string, htmlContent: string, title: string, excerpt: string, byline: string, siteName: string, image: string} | null>}
 */
async function extractArticle(url) {
  try {
    if (!(await isSafeUrl(url))) {
      console.warn(`[Extractor] Blocked SSRF attempt to unsafe URL: ${url}`);
      return null;
    }

    // 1. Politeness Delay: Sleep 3 to 5 seconds before loading the page
    const politenessDelay = Math.floor(Math.random() * 2000) + 3000;
    console.log(`[Extractor] Enforcing ${politenessDelay}ms politeness delay for: ${url}`);
    await new Promise(resolve => setTimeout(resolve, politenessDelay));

    // Get randomized stealth headers
    const headers = getStealthHeaders();

    const response = await fetch(url, {
      method: 'GET',
      headers: headers,
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      console.warn(`[Extractor] Failed to fetch ${url} - Status: ${response.status}`);
      return null;
    }

    const html = await response.text();
    
    // Parse the HTML using JSDOM
    const dom = new JSDOM(html, { url });
    
    // Readability heavily modifies the DOM, so clone it or use it once.
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article || !article.textContent) {
      console.warn(`[Extractor] Readability failed to parse content from ${url}`);
      return null;
    }

    // Try to extract an Open Graph image if Readability didn't capture a good one
    let heroImage = null;
    const ogImageMeta = dom.window.document.querySelector('meta[property="og:image"]');
    if (ogImageMeta) {
      heroImage = ogImageMeta.getAttribute('content');
    }

    // AI Fallback if Readability fails or extracts less than 200 characters
    if (!article || !article.textContent || article.textContent.length < 200) {
      console.warn(`[Extractor] Readability yielded poor results for ${url}, trying AI Fallback...`);
      const aiResult = await aiFallbackExtractor(html, url);
      if (aiResult) {
        return {
          title: aiResult.title || dom.window.document.title,
          textContent: aiResult.textContent,
          htmlContent: `<p>${aiResult.textContent.replace(/\n/g, '<br>')}</p>`,
          excerpt: aiResult.textContent.substring(0, 200) + '...',
          byline: 'AI Extracted',
          siteName: new URL(url).hostname,
          image: heroImage,
          length: aiResult.textContent.length
        };
      }
      return null;
    }

    return {
      title: article.title,
      textContent: article.textContent.trim(), // Raw text (good for AI/Reader Mode)
      htmlContent: article.content, // HTML formatted (good for rich display)
      excerpt: article.excerpt,
      byline: article.byline,
      siteName: article.siteName,
      image: heroImage,
      length: article.length
    };
  } catch (error) {
    console.error(`[Extractor] Error fetching/parsing ${url}:`, error.message);
    return null;
  }
}

/**
 * Gemini AI Fallback Extractor
 */
async function aiFallbackExtractor(rawHtml, url) {
  const keys = (process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
  const GEMINI_API_KEY = keys.length > 0 ? keys[Math.floor(Math.random() * keys.length)] : null;
  if (!GEMINI_API_KEY) return null;

  const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';
  
  // Strip out heavy junk to save tokens
  const cleanHtml = rawHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                           .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                           .replace(/<[^>]+>/g, ' ')
                           .replace(/\s+/g, ' ')
                           .slice(0, 15000);

  const prompt = `You are an expert web scraper. Extract the main article text from this messy HTML content from ${url}. Return ONLY the pure article text, nothing else. No introductions or formatting.\n\n${cleanHtml}`;

  try {
    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 2000, temperature: 0.1 }
      }),
      signal: AbortSignal.timeout(15000)
    });
    
    if (!response.ok) return null;
    const data = await response.json();
    const textContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (textContent && textContent.length > 100) {
      return { textContent };
    }
  } catch (err) {
    console.warn(`[Extractor] AI Fallback error: ${err.message}`);
  }
  return null;
}

module.exports = { extractArticle };
