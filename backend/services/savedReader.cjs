// Recover published source material without another AI call or publisher fetch.
const { cleanArticleText } = require('./articleContent.cjs');
const { cleanSocialText } = require('./socialCaption.cjs');
let pool;
const recent = new Map();
const CACHE_MS = 60 * 60 * 1000;
async function findSavedArticle(url) {
  const cached = recent.get(url);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.row;
  recent.delete(url);
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
    const row = result.rows[0] || null;
    if (row) {
      recent.set(url, { at: Date.now(), row });
      if (recent.size > 64) recent.delete(recent.keys().next().value);
    }
    return row;
  } catch (error) {
    console.warn('[SavedReader] Lookup unavailable:', error.code || 'database error');
    return null;
  }
}
function savedArticleResponse(row, url) {
  if (!row) return null;
  const text = cleanArticleText(row.ai_summary || row.full_content || row.original_excerpt || '');
  if (!text) return null;
  const escape = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return { articleId: row.id ? `rss-${row.id}` : undefined, title: row.title, content: text.split(/\n\s*\n/).map(p => `<p>${escape(p)}</p>`).join(''),
    textContent: text, length: text.length, excerpt: row.original_excerpt || text.slice(0, 240),
    image: row.image || null, siteName: row.source_name || '', byline: row.source_name || '',
    publishedTime: row.published_at || '', sourceUrl: url, partial: !row.ai_summary && !row.full_content,
    dir: 'ltr', lang: 'en' };
}
async function saveEnrichment(url, { source, summary, image, title }) {
  const previous = recent.get(url)?.row || {};
  recent.set(url, { at: Date.now(), row: { ...previous, title: title || previous.title,
    full_content: source || previous.full_content, ai_summary: summary || previous.ai_summary,
    image: image || previous.image } });
  if (recent.size > 64) recent.delete(recent.keys().next().value);
  if (!pool) return;
  try {
    await pool.query(`UPDATE rss_articles SET full_content = COALESCE($1, full_content),
      ai_summary = COALESCE($2, ai_summary), image = COALESCE($3, image) WHERE external_link = $4`,
      [source, summary, image, url]);
  } catch (error) { console.warn('[SavedReader] Save unavailable:', error.code || 'database error'); }
}
module.exports = { findSavedArticle, savedArticleResponse, saveEnrichment };
