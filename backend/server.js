const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');

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

// Database file paths
const usersFilePath = path.join(__dirname, 'data', 'users.json');
const articlesFilePath = path.join(__dirname, 'data', 'articles.json');
const commentsFilePath = path.join(__dirname, 'data', 'comments.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize data files with default content if they don't exist
const initializeDataFiles = () => {
  // Create default users file if it doesn't exist
  if (!fs.existsSync(usersFilePath)) {
    const defaultUsers = [
      {
        id: '1',
        username: 'admin',
        password: bcrypt.hashSync('admin123', 10), // Default password
        isAdmin: true
      }
    ];
    fs.writeFileSync(usersFilePath, JSON.stringify(defaultUsers, null, 2));
  }

  // Create default articles file if it doesn't exist
  if (!fs.existsSync(articlesFilePath)) {
    const defaultArticles = [
      {
        id: '1',
        title: 'Welcome to EntertainmentGHC',
        excerpt: 'Discover the latest in African entertainment and culture',
        content: '<p>Welcome to our platform where we showcase the best of African entertainment...</p>',
        category: 'general',
        date: new Date().toISOString(),
        author: 'Admin',
        source: 'static'
      }
    ];
    fs.writeFileSync(articlesFilePath, JSON.stringify(defaultArticles, null, 2));
  }

  // Create default comments file if it doesn't exist
  if (!fs.existsSync(commentsFilePath)) {
    fs.writeFileSync(commentsFilePath, JSON.stringify([], null, 2));
  }
};

initializeDataFiles();

// Helper function to read JSON file
const readJsonFile = (filePath) => {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${path.basename(filePath)}:`, err);
    return [];
  }
};

// Helper function to write JSON file
const writeJsonFile = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Error writing to ${path.basename(filePath)}:`, err);
  }
};

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

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const users = readJsonFile(usersFilePath);

  const user = users.find(u => u.username === username);
  if (!user) {
    return res.status(400).json({ message: 'Invalid credentials' });
  }

  const isMatch = bcrypt.compareSync(password, user.password);
  if (!isMatch) {
    return res.status(400).json({ message: 'Invalid credentials' });
  }

  if (!user.isAdmin) {
    return res.status(403).json({ message: 'Admin access required' });
  }

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'default_secret', {
    expiresIn: '1h'
  });

  res.json({ token });
});

// Get all articles (public route - no authentication needed)
app.get('/api/articles', (req, res) => {
  const articles = readJsonFile(articlesFilePath);
  res.json(articles);
});

// Get featured articles - combines internal articles with World news
app.get('/api/articles/featured', async (req, res) => {
  try {
    // 1. Get internal articles from database
    const localArticles = readJsonFile(articlesFilePath);
    let featuredArticles = localArticles.slice(0, 10); // Get up to 10 local articles

    // 2. Get World News RSS (e.g., BBC) for homepage rotation
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

    res.json(featuredArticles);
  } catch (error) {
    console.error('Error fetching featured articles:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new article
app.post('/api/articles', (req, res) => {
  const articles = readJsonFile(articlesFilePath);

  // Generate new ID
  const newId = articles.length > 0
    ? Math.max(...articles.map(a => parseInt(a.id))) + 1
    : 1;

  // Create new article with proper structure
  const newArticle = {
    id: newId.toString(), // Ensure ID is string
    title: req.body.title || '',
    excerpt: req.body.excerpt || '',
    content: req.body.content || req.body.excerpt || '',
    category: req.body.category || 'afrobeats',
    image: req.body.image || 'https://placehold.co/400x250?text=EntertainmentGHC',

    readTime: req.body.readTime || '5 min read',
    author: req.body.author || 'Admin',
    source: req.body.source || 'user',
    date: new Date().toISOString()
  };

  articles.push(newArticle);
  writeJsonFile(articlesFilePath, articles);
  res.status(201).json(newArticle);
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
  if (item['media:content'] && item['media:content'].$ && item['media:content'].$.url) {
    return item['media:content'].$.url;
  }
  if (item['media:thumbnail'] && item['media:thumbnail'].$ && item['media:thumbnail'].$.url) {
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
  return 'https://placehold.co/400x250?text=News+Image';

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

// Import notification routes
const notificationRoutes = require('./routes/notifications');

// Use notification routes
app.use('/api/notifications', notificationRoutes);

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Try POST /api/auth/login with username: admin, password: admin123`);
});
