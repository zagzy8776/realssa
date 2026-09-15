const RETENTION_DAYS = Math.max(1, Number(process.env.NEWS_RETENTION_DAYS || 7));
const MAX_NEWS_ROWS = Math.max(5000, Number(process.env.NEWS_MAX_ROWS || 20000));
const LOCK_KEY = 728391;

let lastCleanupAt = 0;

/**
 * Keeps the live news table bounded while allowing the RSS network to grow.
 * The frontend can still read older stories directly from upstream RSS feeds;
 * PostgreSQL only stores a rolling working set.
 */
async function enforceNewsRetention(pool, { force = false } = {}) {
  const now = Date.now();
  // Do not make every category ingestion run a cleanup. One cleanup per 30 min
  // is enough because the retention rules are based on time and row count.
  if (!force && now - lastCleanupAt < 30 * 60 * 1000) return { skipped: true };

  const client = await pool.connect();
  let locked = false;
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [LOCK_KEY]);
    locked = Boolean(lock.rows[0]?.locked);
    if (!locked) return { skipped: true, locked: false };

    const oldRows = await client.query(
      `DELETE FROM rss_articles
       WHERE published_at < NOW() - ($1::text || ' days')::interval`,
      [String(RETENTION_DAYS)]
    );

    const overflow = await client.query(
      `WITH keep AS (
         SELECT id
         FROM rss_articles
         ORDER BY published_at DESC NULLS LAST, id DESC
         LIMIT $1
       )
       DELETE FROM rss_articles r
       WHERE r.id NOT IN (SELECT id FROM keep)
       RETURNING r.id`,
      [MAX_NEWS_ROWS]
    );

    // Clear very large enrichment payloads on the oldest retained stories.
    // This keeps the live working set useful without allowing TOAST-heavy
    // columns to dominate storage.
    const trimmed = await client.query(
      `UPDATE rss_articles
       SET full_content = NULL,
           title_translations = NULL,
           summary_translations = NULL,
           embedding = NULL
       WHERE id IN (
         SELECT id FROM rss_articles
         WHERE published_at < NOW() - INTERVAL '2 days'
           AND (full_content IS NOT NULL OR title_translations IS NOT NULL
             OR summary_translations IS NOT NULL OR embedding IS NOT NULL)
         ORDER BY published_at ASC
         LIMIT 500
       )`
    );

    await client.query('ANALYZE rss_articles');
    lastCleanupAt = now;

    return {
      skipped: false,
      retentionDays: RETENTION_DAYS,
      maxRows: MAX_NEWS_ROWS,
      deletedByAge: oldRows.rowCount || 0,
      deletedByCap: overflow.rowCount || 0,
      trimmedPayloads: trimmed.rowCount || 0
    };
  } finally {
    if (locked) {
      await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {});
    }
    client.release();
  }
}

module.exports = {
  enforceNewsRetention,
  RETENTION_DAYS,
  MAX_NEWS_ROWS
};
