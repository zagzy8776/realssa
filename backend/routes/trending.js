const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined
});

// GET /api/trending
// Retrieves the top trending entities mentioned in articles over the past 48 hours.
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;
    const hours = parseInt(req.query.hours, 10) || 48;

    // We join article_entities with rss_articles to compute mention frequency within the time window.
    const query = `
      SELECT 
        ae.entity_name as name,
        ae.entity_type as type,
        COUNT(ae.article_id) as mentions
      FROM article_entities ae
      JOIN rss_articles a ON ae.article_id = a.id
      WHERE a.published_at >= NOW() - INTERVAL '${hours} hours'
      GROUP BY ae.entity_name, ae.entity_type
      ORDER BY mentions DESC
      LIMIT $1
    `;

    const result = await pool.query(query, [limit]);
    
    res.json({
      ok: true,
      data: result.rows,
      timeWindow: `${hours} hours`
    });
  } catch (error) {
    console.error('Trending API Error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to retrieve trending topics',
      message: error.message
    });
  }
});

module.exports = router;
