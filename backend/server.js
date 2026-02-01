require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const Parser = require('rss-parser');

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Railway/Heroku connections
  }
});

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const cors = require('cors');
app.use(cors({
  origin: ['https://realssa.vercel.app', 'http://localhost:5173', 'http://localhost:8080'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json());

// Initialize database tables
const initializeDatabase = async () => {
  try {
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create articles table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        excerpt TEXT,
        content TEXT,
        category TEXT,
        image TEXT,
        read_time TEXT,
        author TEXT,
        source TEXT,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        featured BOOLEAN DEFAULT FALSE,
        content_type TEXT DEFAULT 'article',
        status TEXT DEFAULT 'published'
      )
    `);

    // Create comments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        article_id INTEGER REFERENCES articles(id),
        author TEXT NOT NULL,
        content TEXT NOT NULL,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        likes INTEGER DEFAULT 0
      )
    `);

    // Insert default admin user if not exists
    const adminExists = await pool.query('SELECT id FROM users WHERE username = $1', ['admin']);
    if (adminExists.rows.length === 0) {
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      await pool.query(
        'INSERT INTO users (username, password, is_admin) VALUES ($1, $2, $3)',
        ['admin', hashedPassword, true]
      );
      console.log('Default admin user created');
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};

// Initialize database on startup
initializeDatabase();

// Authentication middleware
const authenticate = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
    const user = readJsonFile(usersFilePath).find(u => u.id === decoded.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'EntertainmentGHC API Server', status: 'running' });
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
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
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all articles (public route - no authentication needed)
app.get('/api/articles', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM articles ORDER BY date DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching articles:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get featured articles
app.get('/api/articles/featured', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM articles WHERE featured = true OR content_type = $1 ORDER BY date DESC',
      ['headline']
    );

    let featuredArticles = result.rows;

    // Temporary dummy data for testing if no featured articles exist
    if (featuredArticles.length === 0) {
      featuredArticles.push({
        id: 1,
        title: "Investigative: New Audit reveals 'Audio Projects' in Kagini",
        excerpt: "Realssa investigators uncover the truth behind recent budget allocations.",
        content: "Realssa investigators uncover the truth behind recent budget allocations.",
        category: "politics",
        image: "https://placehold.co/600x400",
        read_time: "5 min read",
        author: "Realssa Team",
        source: "static",
        date: new Date().toISOString(),
        featured: true,
        content_type: "article",
        status: "published"
      });
    }

    res.json(featuredArticles);
  } catch (error) {
    console.error('Error fetching featured articles:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new article
app.post('/api/articles', async (req, res) => {
  try {
    const { title, excerpt, content, category, image, readTime, author, source, featured, contentType, status } = req.body;

    const result = await pool.query(
      `INSERT INTO articles (title, excerpt, content, category, image, read_time, author, source, featured, content_type, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        title || '',
        excerpt || '',
        content || excerpt || '',
        category || 'afrobeats',
        image || 'https://via.placeholder.com/400x250?text=EntertainmentGHC',
        readTime || '5 min read',
        author || 'Admin',
        source || 'user',
        featured || false,
        contentType || 'article',
        status || 'published'
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating article:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update article
app.put('/api/articles/:id', (req, res) => {
  const articles = readJsonFile(articlesFilePath);
  const article = articles.find(a => a.id === req.params.id);

  if (!article) {
    return res.status(404).json({ message: 'Article not found' });
  }

  const updatedArticle = { ...article, ...req.body };
  const updatedArticles = articles.map(a =>
    a.id === req.params.id ? updatedArticle : a
  );

  writeJsonFile(articlesFilePath, updatedArticles);
  res.json(updatedArticle);
});

// Delete article
app.delete('/api/articles/:id', (req, res) => {
  const articles = readJsonFile(articlesFilePath);
  const articleIndex = articles.findIndex(a => a.id === req.params.id);

  if (articleIndex === -1) {
    return res.status(404).json({ message: 'Article not found' });
  }

  const updatedArticles = articles.filter(a => a.id !== req.params.id);
  writeJsonFile(articlesFilePath, updatedArticles);
  res.json({ message: 'Article deleted' });
});

// RSS Feed endpoints
const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media:content'],
      ['media:thumbnail', 'media:thumbnail'],
      ['enclosure', 'enclosure']
    ]
  }
});

// Nigerian News RSS feeds
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

// World News RSS feeds
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

// Helper function to fetch RSS feeds
const fetchRSSFeeds = async (feeds) => {
  const allArticles = [];
  const parser = new Parser();

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
          readTime: '5 min read',
          author: feed.title || 'Unknown Source',
          source: 'rss',
          externalLink: item.link,
          date: item.pubDate || new Date().toISOString(),
          contentType: 'article',
          status: 'published',
          featured: false
        };
        allArticles.push(article);
      });
    } catch (error) {
      console.error(`Error fetching RSS feed ${feedUrl}:`, error.message);
    }
  }

  // Sort by date (newest first) and limit to 50 articles
  return allArticles
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 50);
};

// Helper function to extract image from RSS item
const extractImageFromItem = (item) => {
  // Try different image sources
  if (item.enclosure && item.enclosure.url) {
    return item.enclosure.url;
  }
  if (item['media:content'] && item['media:content'].$.url) {
    return item['media:content'].$.url;
  }
  if (item['media:thumbnail'] && item['media:thumbnail'].$.url) {
    return item['media:thumbnail'].$.url;
  }

  // Extract from content if available
  if (item.content) {
    const imgMatch = item.content.match(/<img[^>]+src="([^">]+)"/);
    if (imgMatch) {
      return imgMatch[1];
    }
  }

  // Default placeholder
  return 'https://via.placeholder.com/400x250?text=News+Image';
};

// Get Nigerian news
app.get('/api/news/nigerian', async (req, res) => {
  try {
    console.log('Fetching Nigerian news feeds...');
    const articles = await fetchRSSFeeds(nigerianFeeds);
    console.log(`Fetched ${articles.length} Nigerian articles`);
    res.json(articles);
  } catch (error) {
    console.error('Error fetching Nigerian news:', error);
    res.status(500).json({ error: 'Failed to fetch Nigerian news' });
  }
});

// Get World news
app.get('/api/news/world', async (req, res) => {
  try {
    console.log('Fetching World news feeds...');
    const articles = await fetchRSSFeeds(worldFeeds);
    console.log(`Fetched ${articles.length} World articles`);
    res.json(articles);
  } catch (error) {
    console.error('Error fetching World news:', error);
    res.status(500).json({ error: 'Failed to fetch World news' });
  }
});

// Comments endpoint
app.get('/api/comments', (req, res) => {
  const { articleId } = req.query;
  const comments = readJsonFile(commentsFilePath);
  const filteredComments = articleId
    ? comments.filter(comment => comment.articleId === articleId)
    : comments;
  res.json(filteredComments);
});

app.post('/api/comments', (req, res) => {
  const { articleId, author, content } = req.body;
  if (!articleId || !author || !content) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const comments = readJsonFile(commentsFilePath);
  const newComment = {
    id: Date.now().toString(),
    articleId,
    author,
    content,
    date: new Date().toISOString(),
    likes: 0
  };

  comments.push(newComment);
  writeJsonFile(commentsFilePath, comments);
  res.status(201).json(newComment);
});

app.post('/api/comments/:id/like', (req, res) => {
  const comments = readJsonFile(commentsFilePath);
  const comment = comments.find(c => c.id === req.params.id);

  if (!comment) {
    return res.status(404).json({ error: 'Comment not found' });
  }

  comment.likes = (comment.likes || 0) + 1;
  writeJsonFile(commentsFilePath, comments);
  res.json(comment);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Try POST /api/auth/login with username: admin, password: admin123`);
});
