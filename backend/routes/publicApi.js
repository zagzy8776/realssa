/**
 * Public Syndication API Routes (/api/v1/feed, /api/v1/article/:id)
 * Exposes free, public news syndication endpoints for third-party websites,
 * mobile app widgets, and developers to consume RealSSA news feeds.
 */

const express = require('express');
const router = express.Router();

/**
 * GET /api/v1/feed
 * Returns JSON feed of latest news articles with category filtering & pagination
 */
router.get('/feed', async (req, res) => {
  const pool = req.app.get('pool');
  if (!pool) return res.status(500).json({ error: 'Database connection unavailable' });

  try {
    const { category, limit = 20, offset = 0 } = req.query;
    const itemLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 50);
    const itemOffset = Math.max(parseInt(offset) || 0, 0);

    let queryStr = `
      SELECT 'rss-' || id as id, title, COALESCE(ai_summary, original_excerpt) AS summary,
             category, image, external_link, source_name, published_at
      FROM rss_articles
    `;
    let params = [];

    if (category) {
      queryStr += ` WHERE category = $1`;
      params.push(category.toLowerCase());
    }

    queryStr += ` ORDER BY published_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(itemLimit, itemOffset);

    const result = await pool.query(queryStr, params);

    res.header('Access-Control-Allow-Origin', '*');
    res.json({
      status: 'success',
      total: result.rows.length,
      category: category || 'all',
      articles: result.rows.map(r => ({
        id: r.id,
        title: r.title,
        summary: r.summary,
        category: r.category,
        image: r.image,
        source: r.source_name,
        url: `https://realssanews.com.ng/article/${r.id}`,
        originalUrl: r.external_link,
        publishedAt: r.published_at
      }))
    });
  } catch (err) {
    console.error('[Public API] Feed error:', err.message);
    res.status(500).json({ error: 'Failed to fetch public news feed' });
  }
});

module.exports = router;
