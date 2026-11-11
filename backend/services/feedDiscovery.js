const { request } = require('./growthNetwork');
const { imageUrl } = require('./feedImages');
const { text } = require('./growthLogic');

// Discover new feeds from publisher homepages
async function discoverFeedsFromHomepages(pool, country, seedUrls) {
  const discovered = [];
  for (const seedUrl of seedUrls) {
    try {
      const home = await request(seedUrl);
      if (home.status !== 200) continue;

      const $ = require('cheerio').load(home.body.toString());
      const rssLinks = [];

      // Find all RSS links
      $('link[rel="alternate"]').each((_, el) => {
        if (!/application\/(?:rss|atom)\+xml/i.test($(el).attr('type') || '')) return;
        try {
          const url = new URL($(el).attr('href'), seedUrl);
          if (['http:', 'https:'].includes(url.protocol)) {
            rssLinks.push(url.href);
          }
        } catch {}
      });

      // Add discovered feeds to database
      for (const url of [...new Set(rssLinks)].slice(0, 4)) {
        const inserted = await pool.query(
          `INSERT INTO feed_discoveries (url, country, source_url)
           VALUES ($1, $2, $3)
           ON CONFLICT (url) DO UPDATE
           SET source_url = EXCLUDED.source_url,
               discovered_at = NOW()
           RETURNING *`,
          [url, country, seedUrl]
        );
        discovered.push(inserted.rows[0]);
      }
    } catch (err) {
      console.error(`Error discovering feeds from ${seedUrl}:`, err.message);
    }
  }
  return discovered;
}

// Validate discovered feeds
async function validateDiscoveredFeeds(pool) {
  const toValidate = await pool.query(
    `SELECT * FROM feed_discoveries
     WHERE validated IS false
     AND (attempts < 3 OR next_attempt_at <= NOW())
     ORDER BY attempts ASC, next_attempt_at ASC
     LIMIT 10`
  );

  const Parser = require('rss-parser');
  const parser = new Parser();
  const results = [];

  for (const feed of toValidate.rows) {
    try {
      const response = await request(feed.url);
      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}`);
      }

      const feedData = await parser.parseString(response.body.toString());
      if (!feedData.items || feedData.items.length === 0) {
        throw new Error('No items in feed');
      }

      // Mark as validated
      await pool.query(
        `UPDATE feed_discoveries
         SET validated = true,
             validated_at = NOW(),
             attempts = 0
         WHERE url = $1`,
        [feed.url]
      );

      // Add to feed_schedule if not already present
      await pool.query(
        `INSERT INTO feed_schedule (category, tier, weight, discovered_via)
         VALUES ($1, 2, 1.0, $2)
         ON CONFLICT (category) DO UPDATE
         SET weight = feed_schedule.weight + 1.0,
             discovered_via = COALESCE(feed_schedule.discovered_via, $2)
         WHERE feed_schedule.weight < 2.0`,
        [feed.country, feed.url]
      );

      results.push({
        url: feed.url,
        status: 'validated',
        items: feedData.items.length
      });

    } catch (err) {
      const delay = Math.min(1440, 15 * Math.pow(2, feed.attempts));
      await pool.query(
        `UPDATE feed_discoveries
         SET rejection_reason = $1,
             attempts = attempts + 1,
             next_attempt_at = NOW() + ($2 * INTERVAL '1 minute')
         WHERE url = $3`,
        [err.message, delay, feed.url]
      );

      results.push({
        url: feed.url,
        status: 'failed',
        error: err.message,
        next_attempt: delay
      });
    }
  }
  return results;
}

// Update feed health metrics
async function updateFeedHealthMetrics(pool) {
  // Update article counts
  await pool.query(
    `UPDATE feed_health fh
     SET articles_last_24h = (
       SELECT COUNT(*)
       FROM rss_articles a
       WHERE a.external_link = fh.feed_url
         AND a.published_at >= NOW() - INTERVAL '24 hours'
     ), last_articles_at = (
       SELECT MAX(published_at)
       FROM rss_articles a
       WHERE a.external_link = fh.feed_url
     )
     WHERE EXISTS (
       SELECT 1 FROM rss_articles a
       WHERE a.external_link = fh.feed_url
     )
  `);

  // Update success rates and latency
  await pool.query(
    `UPDATE feed_health fh
     SET success_rate = (
       SELECT 1.0 * COUNT(*) FILTER (WHERE last_success IS NOT NULL) / COUNT(*)
       FROM rss_feed_health_log h
       WHERE h.feed_url = fh.feed_url
         AND h.checked_at >= NOW() - INTERVAL '7 days'
     ), avg_latency_ms = (
       SELECT AVG(avg_response_ms)
       FROM rss_feed_health_log h
       WHERE h.feed_url = fh.feed_url
         AND h.checked_at >= NOW() - INTERVAL '7 days'
     )
     WHERE EXISTS (
       SELECT 1 FROM rss_feed_health_log h
       WHERE h.feed_url = fh.feed_url
     )
  `);

  // Update quality scores
  await pool.query(
    `UPDATE feed_health fh
     SET quality_score = (
       SELECT AVG(a.quality_score)::NUMERIC(5,2)
       FROM rss_articles a
       WHERE a.external_link = fh.feed_url
         AND a.published_at >= NOW() - INTERVAL '7 days'
     )
     WHERE EXISTS (
       SELECT 1 FROM rss_articles a
       WHERE a.external_link = fh.feed_url
     )
  `);
}

module.exports = {
  discoverFeedsFromHomepages,
  validateDiscoveredFeeds,
  updateFeedHealthMetrics
};