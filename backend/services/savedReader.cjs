// Recover published source material without another AI call or publisher fetch.
const { cleanSocialText } = require('./socialCaption.cjs');
let pool;
async function findSavedArticle(url) {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    const { Pool } = require('pg');
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1,
      connectionTimeoutMillis: 2000, statement_timeout: 2500 });
  }
  try {
    const result = await pool.query(`SELECT title, full_content, original_excerpt, ai_summary,
      image, source_name, published_at FROM rss_articles
      WHERE external_link = $1 ORDER BY published_at DESC LIMIT 1`, [url]);
    return result.rows[0] || null;
  } catch (error) {
    console.warn('[SavedReader] Lookup unavailable:', error.code || 'database error');
    return null;
  }
}
function savedArticleResponse(row, url) {
  if (!row) return null;
  const text = cleanSocialText(row.full_content || row.original_excerpt || row.ai_summary || '');
  if (!text) return null;
  const escape = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return { title: row.title, content: text.split(/\n\s*\n/).map(p => `<p>${escape(p)}</p>`).join(''),
    textContent: text, length: text.length, excerpt: row.original_excerpt || text.slice(0, 240),
    image: row.image || null, siteName: row.source_name || '', byline: row.source_name || '',
    publishedTime: row.published_at || '', sourceUrl: url, partial: !row.full_content,
    dir: 'ltr', lang: 'en' };
}
module.exports = { findSavedArticle, savedArticleResponse };
