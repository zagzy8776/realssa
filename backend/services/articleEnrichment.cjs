const { cleanSocialText } = require('./socialCaption.cjs');
const pending = new Map();
async function enrichArticle(row, { extract, analyze, save } = {}) {
  const key = row.external_link;
  if (pending.has(key)) return pending.get(key);
  const task = (async () => {
    let source = cleanSocialText(row.full_content || '');
    let extracted = null;
    if (source.split(/\s+/).length < 160 && key) {
      extracted = await extract(key, { fallbackTitle: row.title, fallbackImage: row.image });
      if (extracted && !extracted.partial) {
        const body = cleanSocialText(extracted.textContent);
        if (body.length > source.length) source = body;
      }
    }
    source = source || cleanSocialText(row.original_excerpt || '');
    const analysis = await analyze(row.title, source);
    const summary = analysis?.generated ? analysis.summary : null;
    // Never mark an RSS/provider fallback as a completed AI report.
    if (save) await save({ source: source.length > cleanSocialText(row.original_excerpt || '').length ? source.slice(0, 24000) : null, summary, image: extracted?.image || row.image });
    return { ...row, full_content: source, ai_summary: summary || row.ai_summary || null, generated: Boolean(summary), partial: source.split(/\s+/).length < 80 };
  })();
  pending.set(key, task);
  try { return await task; } finally { pending.delete(key); }
}
async function runEnrichmentCycle(pool, { limit = 2, budgetMs = 70000 } = {}) {
  const { ensureRssSchema } = require('./ensureRssSchema');
  await ensureRssSchema(pool);
  const client = await pool.connect();
  let locked = false;
  try {
    locked = (await client.query('SELECT pg_try_advisory_lock(728392) AS locked')).rows[0]?.locked;
    if (!locked) return { skipped: true, reason: 'already_running' };
    const rows = (await client.query(`SELECT id, title, external_link, full_content, original_excerpt, ai_summary, image
      FROM rss_articles WHERE content_type = 'article'
      AND (ai_summary IS NULL OR length(ai_summary) < 800)
      AND COALESCE(enrichment_attempts, 0) < 4
      AND (enrichment_retry_at IS NULL OR enrichment_retry_at <= NOW())
      ORDER BY enrichment_retry_at ASC NULLS FIRST, published_at DESC LIMIT $1`, [limit])).rows;
    let generated = 0, processed = 0;
    const started = Date.now();
    for (const row of rows) {
      if (Date.now() - started > budgetMs) break;
      await client.query(`UPDATE rss_articles SET enrichment_attempts = COALESCE(enrichment_attempts, 0) + 1,
        enrichment_retry_at = NOW() + INTERVAL '1 hour' WHERE id = $1`, [row.id]);
      try {
        const result = await enrichArticle(row, {
          extract: require('./extractor').extractArticle,
          analyze: require('./summariser').generateAIAnalysis,
          save: async ({source, summary, image}) => client.query(`UPDATE rss_articles SET
            full_content = COALESCE($1, full_content), ai_summary = COALESCE($2, ai_summary),
            image = COALESCE($3, image) WHERE id = $4`, [source, summary, image, row.id])
        });
        if (result.generated) generated++;
        processed++;
      } catch (error) { console.warn('[Enrichment] Article failed:', row.id, error.code || error.name); }
    }
    return { processed, generated, selected: rows.length };
  } finally {
    if (locked) await client.query('SELECT pg_advisory_unlock(728392)').catch(() => {});
    client.release();
  }
}
module.exports = { enrichArticle, runEnrichmentCycle };
