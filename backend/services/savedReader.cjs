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
    const result = await pool.query(`SELECT id, title, full_content, original_excerpt, ai_summary,
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
  const text = cleanSocialText(row.ai_summary || row.full_content || row.original_excerpt || '');
  if (!text) return null;
  const escape = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return { articleId: row.id ? `rss-${row.id}` : undefined, title: row.title, content: text.split(/\n\s*\n/).map(p => `<p>${escape(p)}</p>`).join(''),
    textContent: text, length: text.length, excerpt: row.original_excerpt || text.slice(0, 240),
    image: row.image || null, siteName: row.source_name || '', byline: row.source_name || '',
    publishedTime: row.published_at || '', sourceUrl: url, partial: !row.ai_summary && !row.full_content,
    dir: 'ltr', lang: 'en' };
}
async function saveEnrichment(url, { source, summary, image }) {
  if (!pool) return;
  try {
    await pool.query(`UPDATE rss_articles SET full_content = COALESCE($1, full_content),
      ai_summary = COALESCE($2, ai_summary), image = COALESCE($3, image) WHERE external_link = $4`,
      [source, summary, image, url]);
  } catch (error) { console.warn('[SavedReader] Save unavailable:', error.code || 'database error'); }
}
module.exports = { findSavedArticle, savedArticleResponse, saveEnrichment };
