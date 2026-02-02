require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

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

    const user = result.rows[0];

    if (!user.is_admin) {
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

// Get featured articles - combines internal articles with World news
app.get('/api/articles/featured', async (req, res) => {
  try {
    // 1. Get internal featured articles from database
    const localResult = await pool.query(
      'SELECT * FROM articles WHERE featured = true OR content_type = $1 ORDER BY date DESC',
      ['headline']
    );

    let featuredArticles = localResult.rows;

    // 2. Get World News RSS (e.g., BBC) for homepage rotation
    try {
      const worldFeed = await parser.parseURL('http://feeds.bbci.co.uk/news/world/rss.xml');
      const worldStories = worldFeed.items.slice(0, 5).map(item => ({
        id: 'world-' + (item.guid || item.link || Math.random().toString(36).substr(2, 9)),
        title: item.title,
        excerpt: item.contentSnippet || item.summary || item.title,
        content: item.content || item.summary || '',
        category: 'World News',
        image: extractImageFromItem(item),
        readTime: '5 min read',
        author: 'BBC News',
        source: 'rss',
        externalLink: item.link,
        date: item.pubDate || new Date().toISOString(),
        contentType: 'article',
        status: 'published',
        featured: true
      }));

      // 3. Combine internal articles with World news
      featuredArticles = [...featuredArticles, ...worldStories];
    } catch (rssError) {
      console.error('Error fetching World news for featured:', rssError.message);
      // Continue with just local articles if RSS fails
    }

    // 4. If no articles exist, return empty array (no dummy articles)
    // The frontend will handle empty states gracefully

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
app.put('/api/articles/:id', async (req, res) => {
  try {
    const { title, excerpt, content, category, image, readTime, author, source, featured, contentType, status } = req.body;

    const result = await pool.query(
      `UPDATE articles SET
        title = $1, excerpt = $2, content = $3, category = $4, image = $5,
        read_time = $6, author = $7, source = $8, featured = $9, content_type = $10, status = $11
       WHERE id = $12 RETURNING *`,
      [
        title,
        excerpt,
        content,
        category,
        image,
        readTime,
        author,
        source,
        featured,
        contentType,
        status,
        req.params.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Article not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating article:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete article
app.delete('/api/articles/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM articles WHERE id = $1 RETURNING *', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Article not found' });
    }

    res.json({ message: 'Article deleted' });
  } catch (error) {
    console.error('Error deleting article:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// RSS Feed endpoints
const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media:content'],
      ['media:thumbnail', 'media:thumbnail'],
      ['enclosure', 'enclosure'],
      ['media:group', 'media:group']
    ]
  },
  xml2js: {
    strict: false,
    cdata: true
  }
});

// Nigerian News RSS feeds
const nigerianFeeds = [
  'https://www.premiumtimesng.com/rss.xml',
  'https://www.vanguardngr.com/feed/',
  'https://punchng.com/feed/',
  'https://www.thisdaylive.com/feed/',
  'https://www.thecable.ng/feed/',
  'https://www.channelstv.com/feed/',
  'https://www.dailytrust.com.ng/feed/',
  'https://www.sunnewsonline.com/feed/',
  'https://www.tribuneonlineng.com/feed/',
  'https://www.nairametrics.com/feed/',
  'https://businessday.ng/feed/',
  'https://www.nigerianobservernews.com/feed/',
  'https://thenationonlineng.net/feed/',
  'https://www.premiumtimesng.com/feed/'
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

// Helper function to get proper image URL from RSS item
const getProperImage = (item) => {
  // 1. Check for standard RSS enclosure
  let url = item.enclosure?.url ||
            item.mediaContent?.$?.url ||
            item.content?.match(/src="([^"]+)"/)?.[1];

  // 2. Fix missing "https:"
  if (url && url.startsWith('//')) url = 'https:' + url;

  // 3. If still nothing, use a high-quality fallback based on category
  return url || `https://images.unsplash.com/photo-1504711432869-001077659a9a?q=80&w=800&auto=format&fit=crop`;
};

// Helper function to extract image from RSS item
const extractImageFromItem = (item) => {
  // Helper function to check if URL is a logo or placeholder
  const isLogoOrPlaceholder = (url) => {
    if (!url) return true;
    const lowerUrl = url.toLowerCase();
    // Check for common logo patterns
    if (lowerUrl.includes('logo') || lowerUrl.includes('icon') || lowerUrl.includes('avatar') || lowerUrl.includes('favicon')) {
      return true;
    }
    // Check for placeholder services
    if (lowerUrl.includes('placehold') || lowerUrl.includes('placeholder') || lowerUrl.includes('dummy')) {
      return true;
    }
    // Check for very small images (likely icons)
    if (lowerUrl.includes('50x50') || lowerUrl.includes('100x100') || lowerUrl.includes('179') ||
        lowerUrl.includes('32x32') || lowerUrl.includes('64x64') || lowerUrl.includes('128x128')) {
      return true;
    }
    // Check for social media profile images
    if (lowerUrl.includes('profile') || lowerUrl.includes('twitter') || lowerUrl.includes('facebook')) {
      return true;
    }
    return false;
  };

  // Helper function to validate image URL
  const isValidImageUrl = (url) => {
    if (!url) return false;
    try {
      const parsedUrl = new URL(url.startsWith('//') ? 'https:' + url : url);
      // Check for common image extensions
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
      const hasImageExtension = imageExtensions.some(ext => parsedUrl.pathname.toLowerCase().includes(ext));
      return hasImageExtension || parsedUrl.pathname.includes('image') || parsedUrl.pathname.includes('photo');
    } catch {
      return false;
    }
  };

  // Helper function to fix relative URLs
  const fixUrl = (url, baseUrl) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    if (url.startsWith('//')) return 'https:' + url;
    if (url.startsWith('/')) {
      try {
        const base = new URL(baseUrl);
        return base.origin + url;
      } catch {
        return null;
      }
    }
    return null;
  };

  let imageUrl = null;

  // 1. Extract from content/description (highest priority for actual article images)
  if (item.content || item.description || item.summary) {
    const content = item.content || item.description || item.summary;
    // Look for img tags
    const imgMatches = content.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi);
    if (imgMatches) {
      for (const imgTag of imgMatches) {
        const srcMatch = imgTag.match(/src=["']([^"']+)["']/);
        if (srcMatch) {
          const url = fixUrl(srcMatch[1], item.link);
          if (url && isValidImageUrl(url) && !isLogoOrPlaceholder(url)) {
            imageUrl = url;
            break; // Take the first valid image
          }
        }
      }
    }
  }

  // 2. Try media:thumbnail (second priority)
  if (!imageUrl && item['media:thumbnail']) {
    const thumbnails = Array.isArray(item['media:thumbnail']) ? item['media:thumbnail'] : [item['media:thumbnail']];
    for (const thumb of thumbnails) {
      const url = thumb.$?.url || thumb.url;
      if (url && isValidImageUrl(url) && !isLogoOrPlaceholder(url)) {
        imageUrl = fixUrl(url, item.link);
        break;
      }
    }
  }

  // 3. Try media:content (third priority)
  if (!imageUrl && item['media:content']) {
    const contents = Array.isArray(item['media:content']) ? item['media:content'] : [item['media:content']];
    for (const content of contents) {
      const url = content.$?.url || content.url;
      if (url && isValidImageUrl(url) && !isLogoOrPlaceholder(url)) {
        imageUrl = fixUrl(url, item.link);
        break;
      }
    }
  }

  // 4. Try enclosure (fourth priority - often contains images)
  if (!imageUrl && item.enclosure && item.enclosure.url) {
    const url = item.enclosure.url;
    if (isValidImageUrl(url) && !isLogoOrPlaceholder(url)) {
      imageUrl = fixUrl(url, item.link);
    }
  }

  // 5. Try custom fields or other media fields
  if (!imageUrl) {
    const possibleFields = ['image', 'media', 'picture', 'photo', 'thumbnail'];
    for (const field of possibleFields) {
      if (item[field] && typeof item[field] === 'string' && isValidImageUrl(item[field]) && !isLogoOrPlaceholder(item[field])) {
        imageUrl = fixUrl(item[field], item.link);
        break;
      }
    }
  }

  // 6. Use fallback if no image found
  if (!imageUrl) {
    // Use a high-quality fallback based on content
    const title = (item.title || '').toLowerCase();
    if (title.includes('nigeria') || title.includes('africa')) {
      imageUrl = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=800&auto=format&fit=crop';
    } else if (title.includes('music') || title.includes('artist') || title.includes('entertainment')) {
      imageUrl = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=800&auto=format&fit=crop';
    } else if (title.includes('politics') || title.includes('government')) {
      imageUrl = 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?q=80&w=800&auto=format&fit=crop';
    } else if (title.includes('business') || title.includes('economy')) {
      imageUrl = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=800&auto=format&fit=crop';
    } else if (title.includes('sports') || title.includes('football')) {
      imageUrl = 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=800&auto=format&fit=crop';
    } else {
      imageUrl = 'https://images.unsplash.com/photo-1504711432869-001077659a9a?q=80&w=800&auto=format&fit=crop';
    }
  }

  return imageUrl;
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

// Homepage aggregator - combines Nigerian and World news
app.get('/api/news/homepage', async (req, res) => {
  try {
    console.log('Fetching aggregated homepage news feeds...');

    // Fetch from both Nigerian and World feeds
    const [nigerianArticles, worldArticles] = await Promise.all([
      fetchRSSFeeds(nigerianFeeds),
      fetchRSSFeeds(worldFeeds)
    ]);

    // Map Nigerian articles with proper category
    const nigerianMapped = nigerianArticles.map(item => ({
      ...item,
      category: 'Nigeria'
    }));

    // Map World articles with proper category
    const worldMapped = worldArticles.map(item => ({
      ...item,
      category: 'World'
    }));

    // Combine all articles
    const combined = [...nigerianMapped, ...worldMapped];

    // Sort by date (newest first) and limit to top 20 stories
    const sorted = combined
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20);

    console.log(`Fetched ${sorted.length} aggregated articles for homepage`);
    res.json(sorted);
  } catch (error) {
    console.error('Error fetching aggregated homepage news:', error);
    res.status(500).json({ error: 'Failed to load aggregated news' });
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
