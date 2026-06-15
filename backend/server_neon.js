/**
 * ======================================================
 * EntertainmentGHC API Server — Neon PostgreSQL Edition
 * ======================================================
 * 
 * This version uses PostgreSQL (Neon) instead of JSON files.
 * 
 * To use:
 *   1. Set DATABASE_URL to your Neon connection string
 *   2. npm install pg (already in package.json)
 *   3. Run: node server_neon.js
 * ======================================================
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const path = require('path');
const Parser = require('rss-parser');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Neon PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Middleware
const cors = require('cors');
app.use(cors({
  origin: ['https://realssa.vercel.app', 'http://localhost:5173', 'http://localhost:8080'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json());

// ======================================================
// AUTO-CREATE TABLES on startup
// ======================================================
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        is_admin BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create articles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        excerpt TEXT,
        content TEXT,
        category VARCHAR(100) DEFAULT 'general',
        image TEXT,
        read_time VARCHAR(50) DEFAULT '5 min read',
        author VARCHAR(200) DEFAULT 'Admin',
        source VARCHAR(50) DEFAULT 'static',
        external_link TEXT,
        featured BOOLEAN DEFAULT false,
        status VARCHAR(20) DEFAULT 'published',
        content_type VARCHAR(50) DEFAULT 'article',
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create comments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        article_id INTEGER NOT NULL,
        author VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        likes INTEGER DEFAULT 0,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
      )
    `);

    // Create indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_articles_date ON articles(date DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_articles_featured ON articles(featured) WHERE featured = true');
    await client.query('CREATE INDEX IF NOT EXISTS idx_comments_article_id ON comments(article_id)');

    // Insert default admin user if not exists
    const adminExists = await client.query('SELECT id FROM users WHERE username = $1', ['admin']);
    if (adminExists.rows.length === 0) {
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      await client.query(
        'INSERT INTO users (username, password, is_admin) VALUES ($1, $2, $3)',
        ['admin', hashedPassword, true]
      );
      console.log('✅ Created default admin user (admin / admin123)');
    }

    // Seed default articles if the articles table is empty
    const articleCount = await client.query('SELECT COUNT(*) FROM articles');
    if (parseInt(articleCount.rows[0].count) === 0) {
      console.log('📝 Seeding default articles...');
      const defaultArticles = [
        {
          title: 'Welcome to EntertainmentGHC',
          excerpt: 'Discover the latest in African entertainment and culture',
          content: '<p>Welcome to our platform where we showcase the best of African entertainment, news, and sports coverage from across Africa and the world.</p>',
          category: 'general',
          image: 'https://placehold.co/400x250?text=EntertainmentGHC',
          author: 'Admin',
          source: 'static'
        },
        {
          title: 'Nigerian Entertainment Industry Grows 40% in 2026',
          excerpt: 'The Nigerian entertainment industry, led by Afrobeats and Nollywood, continues its explosive growth trajectory.',
          content: '<p>The Nigerian entertainment industry has seen remarkable growth this year, with Afrobeats dominating global charts and Nollywood setting new box office records.</p>',
          category: 'entertainment',
          image: 'https://placehold.co/400x250?text=Nigerian+Entertainment',
          author: 'Admin',
          source: 'static'
        },
        {
          title: 'Africa Cup 2026: Full Schedule Announced',
          excerpt: 'The Africa Cup of Nations 2026 schedule has been released with 24 teams competing across 6 venues.',
          content: '<p>The Confederation of African Football has announced the complete schedule for the 2026 Africa Cup of Nations tournament.</p>',
          category: 'sports',
          image: 'https://placehold.co/400x250?text=Africa+Cup+2026',
          author: 'Admin',
          source: 'static'
        },
        {
          title: 'Tech Revolution: African Startups Raise $5 Billion in 2026',
          excerpt: 'African tech startups have raised a record $5 billion in funding this year, with Nigeria and Kenya leading the charge.',
          content: '<p>The African tech ecosystem continues to attract massive investment, with fintech and healthtech leading the funding rounds.</p>',
          category: 'tech',
          image: 'https://placehold.co/400x250?text=African+Tech',
          author: 'Admin',
          source: 'static'
        },
        {
          title: 'Ghana Music Festival Returns for 2026 Edition',
          excerpt: 'The biggest music festival in West Africa returns with international and local artist lineup.',
          content: '<p>Ghana\'s premier music festival returns bigger and better with performances from top African and international artists.</p>',
          category: 'entertainment',
          image: 'https://placehold.co/400x250?text=Ghana+Music+Festival',
          author: 'Admin',
          source: 'static'
        }
      ];

      for (const article of defaultArticles) {
        await client.query(
          `INSERT INTO articles (title, excerpt, content, category, image, author, source)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [article.title, article.excerpt, article.content, article.category, article.image, article.author, article.source]
        );
      }
      console.log('✅ Seeded 5 default articles');
    }

    await client.query('COMMIT');
    console.log('✅ Database tables initialized');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Database initialization error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

// ======================================================
// AUTHENTICATION MIDDLEWARE
// ======================================================
const authenticate = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!result.rows[0].is_admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// ======================================================
// ROUTES
// ======================================================

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'EntertainmentGHC API Server (Neon DB)', status: 'running' });
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isMatch = bcrypt.compareSync(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (!user.is_admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'default_secret', {
      expiresIn: '1h'
    });

    res.json({ token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/articles
app.get('/api/articles', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM articles ORDER BY date DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching articles:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/articles/featured
app.get('/api/articles/featured', async (req, res) => {
  try {
    // 1. Get featured internal articles
    let result = await pool.query(
      "SELECT * FROM articles WHERE featured = true OR status = 'published' ORDER BY date DESC LIMIT 10"
    );
    let featuredArticles = result.rows;

    // 2. Get World News RSS for homepage rotation
    try {
      const parser = new Parser();
      const worldFeed = await parser.parseURL('http://feeds.bbci.co.uk/news/world/rss.xml');
      const worldStories = worldFeed.items.slice(0, 5).map(item => ({
        id: 'world-' + (item.guid || item.link || Math.random().toString(36).substr(2, 9)),
        title: item.title,
        excerpt: item.contentSnippet || item.summary || item.title,
        content: item.content || item.summary || '',
        category: 'World News',
        image: extractImageFromItem(item),
        read_time: '5 min read',
        author: 'BBC News',
        source: 'rss',
        external_link: item.link,
        date: item.pubDate || new Date().toISOString(),
        content_type: 'article',
        status: 'published',
        featured: true
      }));

      featuredArticles = [...featuredArticles, ...worldStories];
    } catch (rssError) {
      console.error('Error fetching World news for featured:', rssError.message);
    }

    res.json(featuredArticles);
  } catch (error) {
    console.error('Error fetching featured articles:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/articles
app.post('/api/articles', async (req, res) => {
  try {
    const result = await pool.query(
      `INSERT INTO articles (title, excerpt, content, category, image, read_time, author, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        req.body.title || '',
        req.body.excerpt || '',
        req.body.content || req.body.excerpt || '',
        req.body.category || 'afrobeats',
        req.body.image || 'https://placehold.co/400x250?text=EntertainmentGHC',
        req.body.readTime || '5 min read',
        req.body.author || 'Admin',
        'user'
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating article:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/articles/:id
app.put('/api/articles/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE articles SET title = $1, excerpt = $2, content = $3, category = $4,
       image = $5, read_time = $6, author = $7
       WHERE id = $8 RETURNING *`,
      [
        req.body.title,
        req.body.excerpt,
        req.body.content,
        req.body.category,
        req.body.image,
        req.body.readTime,
        req.body.author,
        req.params.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Article not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating article:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/articles/:id
app.delete('/api/articles/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM articles WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Article not found' });
    }

    res.json({ message: 'Article deleted' });
  } catch (err) {
    console.error('Error deleting article:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ======================================================
// RSS FEED ENDPOINTS
// ======================================================

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media:content'],
      ['media:thumbnail', 'media:thumbnail'],
      ['enclosure', 'enclosure'],
      ['content:encoded', 'content:encoded'],
      ['description', 'description']
    ]
  }
});

// All RSS feed URLs (same as original server.js)
const nigerianFeeds = [
  'https://www.premiumtimesng.com/rss.xml',
  'https://www.vanguardngr.com/feed/',
  'https://punchng.com/feed/',
  'https://guardian.ng/feed/',
  'https://www.thisdaylive.com/feed/',
  'https://www.thecable.ng/feed/',
  'https://www.channelstv.com/feed/',
  'https://www.dailytrust.com.ng/feed/',
  'https://www.sunnewsonline.com/feed/',
  'https://www.tribuneonlineng.com/feed/'
];

const ghanaFeeds = [
  'https://www.graphic.com.gh/rss.xml',
  'https://www.ghanaweb.com/GhanaHomePage/rss.xml',
  'https://www.myjoyonline.com/feed/',
  'https://www.citi.com.gh/feed/',
  'https://www.ghanatodaynews.com/feed/',
  'https://www.yen.com.gh/feed/',
  'https://www.ghanaweb.com/GhanaHomePage/NewsArchive/rss.xml',
  'https://www.ghanatv.com.gh/feed/',
  'https://www.ghananewsagency.org/feed/',
  'https://www.ghanatoday.com/feed/'
];

const kenyaFeeds = [
  'https://www.nation.co.ke/rss.xml',
  'https://www.standardmedia.co.ke/rss/kenya.php',
  'https://www.the-star.co.ke/rss.xml',
  'https://www.capitalfm.co.ke/feed/',
  'https://www.kenyanews.go.ke/feed/',
  'https://nairobiwire.com/feed/',
  'https://www.kenyans.co.ke/feed/',
  'https://www.tuko.co.ke/feed/',
  'https://www.pulselive.co.ke/feed/',
  'https://www.k24tv.co.ke/feed/'
];

const southAfricaFeeds = [
  'https://www.news24.com/rss.xml',
  'https://www.iol.co.za/rss.xml',
  'https://www.timeslive.co.za/rss.xml',
  'https://www.sowetanlive.co.za/rss.xml',
  'https://www.dispatchlive.co.za/rss.xml',
  'https://www.heraldlive.co.za/rss.xml',
  'https://www.citizen.co.za/rss.xml',
  'https://www.dailymaverick.co.za/rss.xml',
  'https://www.enca.com/rss.xml',
  'https://www.sabcnews.com/sabcnews/feed/'
];

const ukFeeds = [
  'http://feeds.bbci.co.uk/news/uk/rss.xml',
  'https://www.theguardian.com/uk/rss',
  'https://www.telegraph.co.uk/rss.xml',
  'https://www.independent.co.uk/rss.xml',
  'https://www.mirror.co.uk/rss.xml',
  'https://www.dailymail.co.uk/uk/index.rss',
  'https://www.express.co.uk/rss.xml',
  'https://www.standard.co.uk/rss.xml',
  'https://www.ft.com/rss.xml',
  'https://www.thesun.co.uk/rss.xml'
];

const sportsFeeds = [
  'https://www.espn.com/espn/rss/news',
  'https://www.goal.com/en/feeds/news',
  'https://www.bbc.co.uk/sport/rss.xml',
  'https://www.skysports.com/rss/12040',
  'https://www.premierleague.com/rss.xml',
  'https://www.transfermarkt.com/rss/news',
  'https://www.fourfourtwo.com/rss.xml',
  'https://www.sportingnews.com/rss.xml',
  'https://www.bleacherreport.com/rss.xml',
  'https://www.goal.com/en-us/feeds/news'
];

const usaFeeds = [
  'http://rss.cnn.com/rss/edition.rss',
  'https://feeds.nytimes.com/nyt/rss/HomePage',
  'https://www.washingtonpost.com/rss/',
  'https://www.usatoday.com/rss/',
  'https://feeds.foxnews.com/foxnews/latest',
  'https://www.npr.org/rss/rss.php?id=1001',
  'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml',
  'https://www.latimes.com/rss.xml',
  'https://www.chicagotribune.com/rss.xml',
  'https://www.wsj.com/xml/rss/3_7085.xml'
];

const worldFeeds = [
  'http://feeds.bbci.co.uk/news/world/rss.xml',
  'https://www.aljazeera.com/xml/rss/all.xml',
  'https://variety.com/feed/',
  'https://www.rollingstone.com/feed/',
  'https://www.theverge.com/rss/index.xml',
  'https://www.wired.com/feed/rss',
  'https://www.espn.com/espn/rss/news',
  'https://www.coindesk.com/arc/outboundfeeds/rss/',
  'https://cointelegraph.com/rss',
  'https://feeds.feedburner.com/ign/all',
  'https://www.gamespot.com/feeds/news/',
  'https://www.pcgamer.com/rss/',
  'https://kotaku.com/rss',
  'https://www.businessoffashion.com/feed',
  'https://fashionista.com/.rss/excerpt',
  'https://wwd.com/feed/'
];

// Helper function to extract image from RSS item
const extractImageFromItem = (item) => {
  if (item['media:content'] && item['media:content'].$ && item['media:content'].$.url) {
    return item['media:content'].$.url;
  }
  if (item['media:thumbnail'] && item['media:thumbnail'].$ && item['media:thumbnail'].$.url) {
    return item['media:thumbnail'].$.url;
  }
  if (item.enclosure && item.enclosure.url) {
    return item.enclosure.url;
  }
  if (item['content:encoded']) {
    const imgMatch = item['content:encoded'].match(/<img[^>]+src=["']([^"'>]+)["']/i);
    if (imgMatch && imgMatch[1] && imgMatch[1].startsWith('http')) {
      return imgMatch[1];
    }
  }
  if (item.description || item.summary || item.contentSnippet) {
    const content = item.description || item.summary || item.contentSnippet;
    const imgMatch = content.match(/<img[^>]+src=["']([^"'>]+)["']/i);
    if (imgMatch && imgMatch[1] && imgMatch[1].startsWith('http')) {
      return imgMatch[1];
    }
  }
  return 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&h=250&fit=crop';
};

// Helper function to fetch RSS feeds
const fetchRSSFeeds = async (feeds) => {
  const allArticles = [];

  for (const feedUrl of feeds) {
    try {
      console.log(`Fetching RSS feed: ${feedUrl}`);
      const feed = await parser.parseURL(feedUrl);

      feed.items.forEach(item => {
        const article = {
          id: item.guid || item.link || Math.random().toString(36).substr(2, 9),
          title: item.title || 'No title',
          excerpt: item.contentSnippet || item.summary || item.title || 'No content',
          content: item.content || item.summary || item.contentSnippet || '',
          category: 'news',
          image: extractImageFromItem(item),
          read_time: '5 min read',
          author: feed.title || 'Unknown Source',
          source: 'rss',
          external_link: item.link,
          date: item.pubDate || new Date().toISOString(),
          content_type: 'article',
          status: 'published',
          featured: false
        };
        allArticles.push(article);
      });
    } catch (error) {
      console.error(`Error fetching RSS feed ${feedUrl}:`, error.message);
    }
  }

  return allArticles
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 50);
};

// RSS feed routes
app.get('/api/news/nigerian', async (req, res) => {
  try {
    const articles = await fetchRSSFeeds(nigerianFeeds);
    res.json(articles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Nigerian news' });
  }
});

app.get('/api/news/ghana', async (req, res) => {
  try {
    const articles = await fetchRSSFeeds(ghanaFeeds);
    res.json(articles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Ghana news' });
  }
});

app.get('/api/news/kenya', async (req, res) => {
  try {
    const articles = await fetchRSSFeeds(kenyaFeeds);
    res.json(articles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Kenya news' });
  }
});

app.get('/api/news/south-africa', async (req, res) => {
  try {
    const articles = await fetchRSSFeeds(southAfricaFeeds);
    res.json(articles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch South Africa news' });
  }
});

app.get('/api/news/uk', async (req, res) => {
  try {
    const articles = await fetchRSSFeeds(ukFeeds);
    res.json(articles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch UK news' });
  }
});

app.get('/api/news/sports', async (req, res) => {
  try {
    const articles = await fetchRSSFeeds(sportsFeeds);
    res.json(articles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Sports news' });
  }
});

app.get('/api/news/usa', async (req, res) => {
  try {
    const articles = await fetchRSSFeeds(usaFeeds);
    res.json(articles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch USA news' });
  }
});

app.get('/api/news/world', async (req, res) => {
  try {
    const articles = await fetchRSSFeeds(worldFeeds);
    res.json(articles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch World news' });
  }
});

// ======================================================
// COMMENTS ENDPOINTS (using PostgreSQL)
// ======================================================

// GET /api/comments
app.get('/api/comments', async (req, res) => {
  try {
    const { articleId } = req.query;
    let result;

    if (articleId) {
      result = await pool.query(
        'SELECT * FROM comments WHERE article_id = $1 ORDER BY date DESC',
        [parseInt(articleId) || 0]
      );
    } else {
      result = await pool.query(
        'SELECT * FROM comments ORDER BY date DESC'
      );
    }

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching comments:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/comments
app.post('/api/comments', async (req, res) => {
  const { articleId, author, content } = req.body;

  if (!articleId || !author || !content) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO comments (article_id, author, content)
       VALUES ($1, $2, $3) RETURNING *`,
      [parseInt(articleId) || 0, author, content]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating comment:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/comments/:id/like
app.post('/api/comments/:id/like', async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE comments SET likes = likes + 1 WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error liking comment:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ======================================================
// START SERVER
// ======================================================

// Initialize database tables then start server
initializeDatabase()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 Server running on port ${PORT}`);
      console.log(`📦 Database: Neon PostgreSQL`);
      console.log(`🔑 Default login: admin / admin123`);
      console.log(`🌐 Health check: http://localhost:${PORT}/\n`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

module.exports = app;