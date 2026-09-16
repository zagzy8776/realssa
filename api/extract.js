const { extractArticle } = require('../backend/services/extractor');

function sendJson(res, status, payload) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(payload));
}

function normalizeBody(body) {
  if (!body) return {};
  if (typeof body === 'object') return body;
  try { return JSON.parse(body); } catch { return {}; }
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const body = normalizeBody(req.body);
  const rawUrl = String(body.url || '').trim();

  if (!rawUrl) {
    return sendJson(res, 400, { error: 'url is required' });
  }

  let target;
  try {
    target = new URL(rawUrl);
    if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Unsupported protocol');
  } catch {
    return sendJson(res, 400, { error: 'Invalid article URL' });
  }

  try {
    const article = await extractArticle(target.toString());

    if (!article || !article.textContent || article.textContent.trim().length < 100) {
      return sendJson(res, 422, {
        error: 'Article content could not be extracted',
        url: target.toString(),
        retryable: true
      });
    }

    return sendJson(res, 200, {
      title: article.title || target.hostname,
      content: article.htmlContent || `<p>${escapeHtml(article.textContent)}</p>`,
      textContent: article.textContent,
      length: Number(article.length || article.textContent.length),
      excerpt: article.excerpt || article.textContent.slice(0, 240),
      byline: article.byline || '',
      dir: 'ltr',
      siteName: article.siteName || target.hostname.replace(/^www\./, ''),
      lang: 'en',
      publishedTime: article.publishedTime || '',
      image: article.image || null,
      sourceUrl: target.toString()
    });
  } catch (error) {
    console.error('[Vercel Extract] Extraction failed:', error.message);
    return sendJson(res, 502, {
      error: 'Publisher could not be read right now',
      url: target.toString(),
      retryable: true
    });
  }
};

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
