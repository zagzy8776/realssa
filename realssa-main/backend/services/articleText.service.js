'use strict';

/**
 * Minimal, dependency-free article text extractor.
 *
 * This is not a replacement for the Readability pipeline used by /api/extract.
 * It exists so the newsroom can turn a trend URL into enough source text for
 * the grounded angle factory. If a publisher blocks the request, callers fall
 * back to the trend snippet and the angle factory returns a reporting brief.
 */

const MAX_CHARS = 14_000;
const TIMEOUT_MS = 9000;

async function fetchArticleText(url) {
  if (!url || !/^https?:\/\//i.test(url)) return '';

  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; RealSSA-EditorBot/1.0; +https://www.realssanews.com.ng)',
      Accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const html = await response.text();

  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#8217;/gi, "'")
    .replace(/&#8216;/gi, "'")
    .replace(/&#8220;|&#8221;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CHARS);
}

module.exports = { fetchArticleText, MAX_CHARS };
