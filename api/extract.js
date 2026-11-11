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

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
  const fallbackText = String(body.fallbackText || body.excerpt || '').trim();
  const fallbackImage = body.fallbackImage || body.image || null;
  const fallbackTitle = body.fallbackTitle || body.title || null;

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
    const article = await extractArticle(target.toString(), {
      fallbackText,
      fallbackImage,
      fallbackTitle,
    });

    if (!article || !article.textContent || article.textContent.trim().length < 20) {
      // Absolute last resort: still return something readable if client sent excerpt/title
      const rescue = fallbackText.length >= 15 ? fallbackText : (fallbackTitle || '');
      if (rescue.length >= 15) {
        return sendJson(res, 200, {
          title: fallbackTitle || target.hostname,
          content: `<p>${escapeHtml(rescue)}</p>`,
          textContent: rescue,
          length: rescue.length,
          excerpt: rescue.slice(0, 240),
          byline: '',
          dir: 'ltr',
          siteName: target.hostname.replace(/^www\./, ''),
          lang: 'en',
          publishedTime: '',
          image: fallbackImage || null,
          sourceUrl: target.toString(),
          partial: true,
        });
      }

      return sendJson(res, 422, {
        error: 'Article content could not be extracted',
        url: target.toString(),
        retryable: true,
      });
    }

    const text = article.textContent.trim();
    return sendJson(res, 200, {
      title: article.title || fallbackTitle || target.hostname,
      content: article.htmlContent || `<p>${escapeHtml(text)}</p>`,
      textContent: text,
      length: Number(article.length || text.length),
      excerpt: article.excerpt || text.slice(0, 240),
      byline: article.byline || '',
      dir: 'ltr',
      siteName: article.siteName || target.hostname.replace(/^www\./, ''),
      lang: 'en',
      publishedTime: article.publishedTime || '',
      image: article.image || fallbackImage || null,
      sourceUrl: article.sourceUrl || target.toString(),
      partial: Boolean(article.partial),
    });
  } catch (error) {
    console.error('[Vercel Extract] Extraction failed:', error.message);
    const rescue = fallbackText.length >= 15 ? fallbackText : (fallbackTitle || '');
    if (rescue.length >= 15) {
      return sendJson(res, 200, {
        title: fallbackTitle || target.hostname,
        content: `<p>${escapeHtml(rescue)}</p>`,
        textContent: rescue,
        length: rescue.length,
        excerpt: rescue.slice(0, 240),
        byline: '',
        dir: 'ltr',
        siteName: target.hostname.replace(/^www\./, ''),
        lang: 'en',
        publishedTime: '',
        image: fallbackImage || null,
        sourceUrl: target.toString(),
        partial: true,
      });
    }
    return sendJson(res, 502, {
      error: 'Publisher could not be read right now',
      url: target.toString(),
      retryable: true,
    });
  }
};
