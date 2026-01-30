require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const metascraper = require('metascraper');
const metascraperImage = require('metascraper-image');
const metascraperDescription = require('metascraper-description');
const metascraperTitle = require('metascraper-title');
const axios = require('axios');
const crypto = require('crypto');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.example.com"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration with security
app.use(cors({
  origin: process.env.FRONTEND_URL || ['http://localhost:5173', 'https://realssa.vercel.app'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login requests per windowMs
  message: {
    error: 'Too many login attempts from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);
app.use('/api/auth/', authLimiter);

// Input sanitization middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Request logging for security
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';
  console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${ip} - UA: ${userAgent}`);
  next();
});

// RSS Parser setup
const parser = new Parser();

// Metascraper setup for image extraction
const scraper = metascraper([
  metascraperImage(),
  metascraperDescription(),
  metascraperTitle()
]);

// Database file paths
const usersFilePath = path.join(__dirname, 'data', 'users.json');
const articlesFilePath = path.join(__dirname, 'data', 'articles.json');

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
};

initializeDataFiles();

// Helper function to read JSON file with fallback
const readJsonFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error(`Error reading ${path.basename(filePath)}:`, err);
  }
  
  // Return default data if file doesn't exist or is corrupted
  if (filePath.includes('articles.json')) {
    return [
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
  } else if (filePath.includes('users.json')) {
    return [
      {
        id: '1',
        username: 'admin',
        password: bcrypt.hashSync('admin123', 10),
        isAdmin: true
      }
    ];
  }
  
  return [];
};

// Helper function to write JSON file with error handling and backup
const writeJsonFile = (filePath, data) => {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write to primary file
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Successfully wrote to ${path.basename(filePath)}`);
    
    // Create backup in case of file corruption
    const backupPath = filePath.replace('.json', '_backup.json');
    try {
      fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));
      console.log(`Backup created: ${path.basename(backupPath)}`);
    } catch (backupErr) {
      console.warn(`Failed to create backup: ${backupErr.message}`);
    }
  } catch (err) {
    console.error(`Error writing to ${path.basename(filePath)}:`, err);
    
    // Try to restore from backup if write fails
    const backupPath = filePath.replace('.json', '_backup.json');
    if (fs.existsSync(backupPath)) {
      try {
        const backupData = fs.readFileSync(backupPath, 'utf-8');
        fs.writeFileSync(filePath, backupData);
        console.log(`Restored from backup: ${path.basename(filePath)}`);
      } catch (restoreErr) {
        console.error(`Failed to restore from backup:`, restoreErr);
      }
    }
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

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// User registration endpoint
app.post('/api/auth/register', authLimiter, (req, res) => {
  const { username, password } = req.body;
  const users = readJsonFile(usersFilePath);

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  if (users.some(u => u.username === username)) {
    return res.status(400).json({ message: 'Username already exists' });
  }

  const newUser = {
    id: crypto.randomUUID(),
    username,
    password: bcrypt.hashSync(password, 10),
    isAdmin: false,
    createdAt: new Date().toISOString(),
    preferences: {
      interests: [],
      darkMode: false,
      bookmarks: [],
      readingHistory: []
    }
  };

  users.push(newUser);
  writeJsonFile(usersFilePath, users);

  const token = jwt.sign({ id: newUser.id }, process.env.JWT_SECRET || 'default_secret', {
    expiresIn: '24h'
  });

  res.status(201).json({ token, user: { id: newUser.id, username: newUser.username, isAdmin: newUser.isAdmin } });
});

// User login endpoint
app.post('/api/auth/login', authLimiter, (req, res) => {
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

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'default_secret', {
    expiresIn: '24h'
  });

  res.json({ 
    token, 
    user: { 
      id: user.id, 
      username: user.username, 
      isAdmin: user.isAdmin,
      preferences: user.preferences || { interests: [], darkMode: false, bookmarks: [], readingHistory: [] }
    } 
  });
});

// Get user profile
app.get('/api/auth/profile', authenticate, (req, res) => {
  const users = readJsonFile(usersFilePath);
  const user = users.find(u => u.id === req.user.id);
  
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  res.json({
    id: user.id,
    username: user.username,
    isAdmin: user.isAdmin,
    preferences: user.preferences || { interests: [], darkMode: false, bookmarks: [], readingHistory: [] }
  });
});

// Update user preferences
app.put('/api/auth/preferences', authenticate, (req, res) => {
  const users = readJsonFile(usersFilePath);
  const userIndex = users.findIndex(u => u.id === req.user.id);

  if (userIndex === -1) {
    return res.status(404).json({ message: 'User not found' });
  }

  const { interests, darkMode, bookmarks, readingHistory } = req.body;
  const updatedUser = {
    ...users[userIndex],
    preferences: {
      ...users[userIndex].preferences,
      interests: interests || users[userIndex].preferences.interests,
      darkMode: darkMode !== undefined ? darkMode : users[userIndex].preferences.darkMode,
      bookmarks: bookmarks || users[userIndex].preferences.bookmarks,
      readingHistory: readingHistory || users[userIndex].preferences.readingHistory
    }
  };

  users[userIndex] = updatedUser;
  writeJsonFile(usersFilePath, users);

  res.json({ message: 'Preferences updated successfully' });
});

// Bookmark article
app.post('/api/bookmarks', authenticate, (req, res) => {
  const { articleId } = req.body;
  const users = readJsonFile(usersFilePath);
  const userIndex = users.findIndex(u => u.id === req.user.id);

  if (userIndex === -1) {
    return res.status(404).json({ message: 'User not found' });
  }

  const user = users[userIndex];
  if (!user.preferences.bookmarks) {
    user.preferences.bookmarks = [];
  }

  if (!user.preferences.bookmarks.includes(articleId)) {
    user.preferences.bookmarks.push(articleId);
    writeJsonFile(usersFilePath, users);
  }

  res.json({ message: 'Article bookmarked successfully' });
});

// Remove bookmark
app.delete('/api/bookmarks/:articleId', authenticate, (req, res) => {
  const { articleId } = req.params;
  const users = readJsonFile(usersFilePath);
  const userIndex = users.findIndex(u => u.id === req.user.id);

  if (userIndex === -1) {
    return res.status(404).json({ message: 'User not found' });
  }

  const user = users[userIndex];
  if (!user.preferences.bookmarks) {
    user.preferences.bookmarks = [];
  }

  user.preferences.bookmarks = user.preferences.bookmarks.filter(id => id !== articleId);
  writeJsonFile(usersFilePath, users);

  res.json({ message: 'Bookmark removed successfully' });
});

// Get user bookmarks
app.get('/api/bookmarks', authenticate, (req, res) => {
  const users = readJsonFile(usersFilePath);
  const user = users.find(u => u.id === req.user.id);

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const bookmarks = user.preferences.bookmarks || [];
  const articles = readJsonFile(articlesFilePath);
  const bookmarkedArticles = articles.filter(article => bookmarks.includes(article.id));

  res.json(bookmarkedArticles);
});

// Add to reading history
app.post('/api/reading-history', authenticate, (req, res) => {
  const { articleId } = req.body;
  const users = readJsonFile(usersFilePath);
  const userIndex = users.findIndex(u => u.id === req.user.id);

  if (userIndex === -1) {
    return res.status(404).json({ message: 'User not found' });
  }

  const user = users[userIndex];
  if (!user.preferences.readingHistory) {
    user.preferences.readingHistory = [];
  }

  // Remove if already exists and add to beginning (most recent first)
  user.preferences.readingHistory = user.preferences.readingHistory.filter(id => id !== articleId);
  user.preferences.readingHistory.unshift(articleId);

  // Keep only last 50 articles
  if (user.preferences.readingHistory.length > 50) {
    user.preferences.readingHistory = user.preferences.readingHistory.slice(0, 50);
  }

  writeJsonFile(usersFilePath, users);
  res.json({ message: 'Reading history updated' });
});

// Get personalized recommendations
app.get('/api/recommendations', authenticate, (req, res) => {
  const users = readJsonFile(usersFilePath);
  const user = users.find(u => u.id === req.user.id);
  const articles = readJsonFile(articlesFilePath);

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const readingHistory = user.preferences.readingHistory || [];
  const bookmarks = user.preferences.bookmarks || [];
  const interests = user.preferences.interests || [];

  // Get categories from reading history and bookmarks
  const historyArticles = articles.filter(article => readingHistory.includes(article.id));
  const bookmarkedArticles = articles.filter(article => bookmarks.includes(article.id));
  const allInteractedArticles = [...historyArticles, ...bookmarkedArticles];

  const likedCategories = [...new Set(allInteractedArticles.map(article => article.category))];
  const likedAuthors = [...new Set(allInteractedArticles.map(article => article.author))];

  // Get recommendations based on categories and authors
  let recommendations = articles.filter(article => 
    likedCategories.includes(article.category) || 
    likedAuthors.includes(article.author) ||
    interests.includes(article.category)
  );

  // Remove already read articles
  recommendations = recommendations.filter(article => 
    !readingHistory.includes(article.id) && 
    !bookmarks.includes(article.id)
  );

  // Sort by date (newest first)
  recommendations.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Return top 10 recommendations
  res.json(recommendations.slice(0, 10));
});

// Get "For You" personalized feed
app.get('/api/for-you', authenticate, (req, res) => {
  const users = readJsonFile(usersFilePath);
  const user = users.find(u => u.id === req.user.id);
  const articles = readJsonFile(articlesFilePath);

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const readingHistory = user.preferences.readingHistory || [];
  const bookmarks = user.preferences.bookmarks || [];
  const interests = user.preferences.interests || [];

  // Get categories from reading history and bookmarks
  const historyArticles = articles.filter(article => readingHistory.includes(article.id));
  const bookmarkedArticles = articles.filter(article => bookmarks.includes(article.id));
  const allInteractedArticles = [...historyArticles, ...bookmarkedArticles];

  const likedCategories = [...new Set(allInteractedArticles.map(article => article.category))];
  const likedAuthors = [...new Set(allInteractedArticles.map(article => article.author))];

  // Get personalized articles
  let personalizedArticles = articles.filter(article => 
    likedCategories.includes(article.category) || 
    likedAuthors.includes(article.author) ||
    interests.includes(article.category) ||
    article.featured === true
  );

  // Remove already read articles
  personalizedArticles = personalizedArticles.filter(article => 
    !readingHistory.includes(article.id)
  );

  // Sort by date (newest first) and featured status
  personalizedArticles.sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return new Date(b.date) - new Date(a.date);
  });

  res.json(personalizedArticles.slice(0, 20));
});

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
  // Only serve user-posted articles (admin content), filter out static content
  const userArticles = articles.filter(article => article.source === 'user');
  res.json(userArticles);
});

// Get articles by content type (public route)
app.get('/api/articles/type/:contentType', (req, res) => {
  const articles = readJsonFile(articlesFilePath);
  const contentType = req.params.contentType;
  const filteredArticles = articles.filter(article => article.contentType === contentType);
  res.json(filteredArticles);
});

// Get published articles only (public route)
app.get('/api/articles/published', (req, res) => {
  const articles = readJsonFile(articlesFilePath);
  const publishedArticles = articles.filter(article => article.status === 'published');
  res.json(publishedArticles);
});

// Get featured articles (public route)
app.get('/api/articles/featured', (req, res) => {
  const articles = readJsonFile(articlesFilePath);
  const featuredArticles = articles.filter(article => article.featured === true && article.status === 'published');
  res.json(featuredArticles);
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
    image: req.body.image || 'https://via.placeholder.com/400x250?text=EntertainmentGHC',
    readTime: req.body.readTime || '5 min read',
    author: req.body.author || 'Admin',
    source: req.body.source || 'user',
    contentType: req.body.contentType || 'article', // New field for content type
    status: req.body.status || 'published', // New field for content status
    featured: req.body.featured || false, // New field for featured content
    externalLink: req.body.externalLink || '', // New field for external video links
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

// In-memory cache for RSS feeds
const rssCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

// Helper function to check cache
const getCachedFeed = (feedUrl) => {
  const cached = rssCache.get(feedUrl);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
};

// Helper function to cache feed
const setCachedFeed = (feedUrl, data) => {
  rssCache.set(feedUrl, {
    data,
    timestamp: Date.now()
  });
};

// RSS Parser endpoint for Entertainment and Culture news
app.get('/api/entertainment-news', async (req, res) => {
  try {
    // Entertainment and Culture RSS feeds
    const entertainmentFeeds = [
      'https://www.bellanaija.com/feed/',
      'https://pulse.ng/rss/entertainment',
      'https://www.nollywoodforever.com/feed/',
      'https://www.nairaland.com/feeds/entertainment',
      'https://www.ynaija.com/feed/',
      'https://www.nollywoodgists.com/feed/',
      'https://www.nollywoodnews.com/feed/',
      'https://www.nollywoodgists.com/feed/',
      'https://www.nollywoodgists.com/feed/',
      'https://www.nollywoodgists.com/feed/'
    ];
    
    const allArticles = [];
    const sourceNames = {
      'https://www.bellanaija.com/feed/': 'BellaNaija',
      'https://pulse.ng/rss/entertainment': 'Pulse Nigeria',
      'https://www.nollywoodforever.com/feed/': 'Nollywood Forever',
      'https://www.nairaland.com/feeds/entertainment': 'Nairaland',
      'https://www.ynaija.com/feed/': 'YNaija',
      'https://www.nollywoodgists.com/feed/': 'Nollywood Gists',
      'https://www.nollywoodnews.com/feed/': 'Nollywood News'
    };
    
    // Process all feeds in parallel for better performance
    const fetchPromises = entertainmentFeeds.map(async (feedUrl) => {
      try {
        // Check cache first
        const cachedData = getCachedFeed(feedUrl);
        if (cachedData) {
          console.log(`Using cached data for: ${feedUrl}`);
          return cachedData;
        }
        
        console.log(`Fetching Entertainment RSS feed: ${feedUrl}`);
        const feed = await parser.parseURL(feedUrl);
        
        // Process each item in the feed
        const feedArticles = [];
        for (const item of feed.items) {
          // Extract image from RSS enclosure or media tags first
          let imageUrl = '';
          if (item.enclosure && item.enclosure.url) {
            imageUrl = item.enclosure.url;
          } else if (item['media:content'] && item['media:content'].url) {
            imageUrl = item['media:content'].url;
          } else if (item['media:thumbnail'] && item['media:thumbnail'].url) {
            imageUrl = item['media:thumbnail'].url;
          }
          
          // If no image found in RSS, try to extract from the article page using metascraper
          if (!imageUrl && item.link) {
            try {
              console.log(`Extracting image from article: ${item.link}`);
              const response = await axios.get(item.link, {
                timeout: 8000, // Reduced timeout for faster response
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
              });
              
              const metadata = await scraper({
                url: item.link,
                html: response.data
              });
              
              if (metadata.image) {
                imageUrl = metadata.image;
                console.log(`Found image via metascraper: ${imageUrl}`);
              } else {
                console.log(`No image found via metascraper for: ${item.link}`);
              }
            } catch (scrapeError) {
              console.warn(`Failed to scrape image from ${item.link}:`, scrapeError.message);
            }
          }
          
          // Create article object in our format
          const article = {
            id: item.guid || item.link,
            title: item.title || '',
            excerpt: item.contentSnippet || item.description || '',
            content: item.content || item.description || '',
            category: 'entertainment',
            image: imageUrl || 'https://via.placeholder.com/400x250?text=Entertainment+Image',
            readTime: '3 min read',
            author: sourceNames[feedUrl] || 'Entertainment News',
            source: 'rss',
            contentType: 'entertainment',
            status: 'published',
            featured: false,
            externalLink: item.link || '',
            date: item.pubDate || new Date().toISOString()
          };
          
          feedArticles.push(article);
        }
        
        // Cache the results
        setCachedFeed(feedUrl, feedArticles);
        return feedArticles;
      } catch (error) {
        console.error(`Failed to fetch ${feedUrl}:`, error.message);
        return [];
      }
    });
    
    // Wait for all feeds to complete
    const results = await Promise.all(fetchPromises);
    
    // Flatten all articles
    results.forEach(feedArticles => {
      allArticles.push(...feedArticles);
    });
    
    // Sort articles by date (newest first)
    allArticles.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    res.json(allArticles);
  } catch (error) {
    console.error('Error fetching Entertainment news:', error);
    res.status(500).json({ error: 'Failed to fetch Entertainment news' });
  }
});

// RSS Parser endpoint for Nigerian news
app.get('/api/nigerian-news', async (req, res) => {
  try {
    // All RSS feeds organized by category - Simplified to 3 per category for speed
    const allFeeds = [
      // Nigerian newspaper RSS feeds (3 most reliable)
      'https://punchng.com/feed/',
      'https://www.vanguardngr.com/feed/',
      'https://www.thisdaylive.com/feed/',
      
      // World News RSS feeds (3 most reliable)
      'http://feeds.bbci.co.uk/news/world/rss.xml',
      'https://www.aljazeera.com/xml/rss/all.xml',
      'https://www.espn.com/espn/rss/news',
      
      // International Entertainment RSS feeds (3 most reliable)
      'https://variety.com/feed/',
      'https://www.rollingstone.com/feed/',
      'https://www.theverge.com/rss/index.xml',
      
      // Fashion & Lifestyle RSS feeds (3 most reliable)
      'https://www.businessoffashion.com/feed',
      'https://www.bellanaija.com/feed/',
      'https://pulse.ng/rss/entertainment'
    ];
    
    const allArticles = [];
    const sourceNames = {
      // Nigerian News
      'https://punchng.com/feed/': 'The Punch',
      'https://www.vanguardngr.com/feed/': 'Vanguard',
      'https://www.thisdaylive.com/feed/': 'ThisDay',
      'https://www.premiumtimesng.com/feed': 'Premium Times',
      'https://guardian.ng/feed': 'The Guardian Nigeria',
      'https://www.thenationonlineng.net/feed': 'The Nation Online',
      'https://www.sunnewsonline.com/feed': 'The Sun Nigeria',
      'https://www.dailytrust.com/feed': 'Daily Trust',
      'https://www.nairametrics.com/feed': 'Nairametrics',
      'https://www.nigerianobservernews.com/feed': 'Nigerian Observer',
      
      // World News
      'http://feeds.bbci.co.uk/news/world/rss.xml': 'BBC News',
      'https://www.aljazeera.com/xml/rss/all.xml': 'Al Jazeera',
      
      // International Entertainment
      'https://variety.com/feed/': 'Variety',
      'https://www.rollingstone.com/feed/': 'Rolling Stone',
      
      // International Technology
      'https://www.theverge.com/rss/index.xml': 'The Verge',
      'https://www.wired.com/feed/rss': 'Wired',
      
      // Sports
      'https://www.espn.com/espn/rss/news': 'ESPN',
      
      // Crypto & Finance
      'https://www.coindesk.com/arc/outboundfeeds/rss/': 'CoinDesk',
      'https://cointelegraph.com/rss': 'CoinTelegraph',
      'https://bitcoinmagazine.com/.rss/full/': 'Bitcoin Magazine',
      'https://techcabal.com/feed/': 'TechCabal',
      
      // Gaming
      'https://feeds.feedburner.com/ign/all': 'IGN',
      'https://www.gamespot.com/feeds/news/': 'GameSpot',
      'https://www.pcgamer.com/rss/': 'PC Gamer',
      'https://kotaku.com/rss': 'Kotaku',
      
      // Fashion & Lifestyle
      'https://www.businessoffashion.com/feed': 'The Business of Fashion',
      'https://fashionista.com/.rss/excerpt': 'Fashionista',
      'https://wwd.com/feed/': 'WWD',
      'https://feeds.feedburner.com/fibre2fashion/fashion-news': 'Fibre2Fashion',
      
      // Entertainment & Culture
      'https://www.bellanaija.com/feed/': 'BellaNaija',
      'https://pulse.ng/rss/entertainment': 'Pulse Nigeria',
      'https://www.nollywoodforever.com/feed/': 'Nollywood Forever',
      'https://www.nairaland.com/feeds/entertainment': 'Nairaland',
      'https://www.ynaija.com/feed/': 'YNaija',
      'https://www.nollywoodgists.com/feed/': 'Nollywood Gists',
      'https://www.nollywoodnews.com/feed/': 'Nollywood News',
      'https://www.360nobs.com/feed': '360 Nobs',
      'https://www.naijaparty.com/feed': 'Naija Party',
      'https://www.nigerianmusicblog.com/feed': 'Nigerian Music Blog',
      'https://www.nigerianfilms.com/feed': 'Nigerian Films',
      'https://www.nigeriancelebrities.com/feed': 'Nigerian Celebrities',
      'https://www.nigerianlifestyle.com/feed': 'Nigerian Lifestyle',
      'https://www.nigerianfashionblog.com/feed': 'Nigerian Fashion Blog',
      
      // Technology & Business
      'https://www.nairatech.com/feed': 'Naira Tech',
      'https://www.nigerianstartups.com/feed': 'Nigerian Startups',
      'https://www.nigerianbusiness.com/feed': 'Nigerian Business',
      'https://www.nigerianfinanceblog.com/feed': 'Nigerian Finance Blog',
      'https://www.nigerianentrepreneur.com/feed': 'Nigerian Entrepreneur',
      'https://www.nigerianinvestor.com/feed': 'Nigerian Investor',
      'https://www.nigerianmarket.com/feed': 'Nigerian Market',
      'https://www.nigerianecommerce.com/feed': 'Nigerian E-commerce',
      'https://www.nigeriantechblog.com/feed': 'Nigerian Tech Blog'
    };
    
    // Process all feeds in parallel for better performance
    const fetchPromises = allFeeds.map(async (feedUrl) => {
      try {
        // Check cache first
        const cachedData = getCachedFeed(feedUrl);
        if (cachedData) {
          console.log(`Using cached data for: ${feedUrl}`);
          return cachedData;
        }
        
        console.log(`Fetching RSS feed: ${feedUrl}`);
        const feed = await parser.parseURL(feedUrl);
        
        // Process each item in the feed
        const feedArticles = [];
        for (const item of feed.items) {
          // Extract image from RSS enclosure or media tags first
          let imageUrl = '';
          if (item.enclosure && item.enclosure.url) {
            imageUrl = item.enclosure.url;
          } else if (item['media:content'] && item['media:content'].url) {
            imageUrl = item['media:content'].url;
          } else if (item['media:thumbnail'] && item['media:thumbnail'].url) {
            imageUrl = item['media:thumbnail'].url;
          }
          
          // If no image found in RSS, try to extract from the article page using metascraper
          if (!imageUrl && item.link) {
            try {
              console.log(`Extracting image from article: ${item.link}`);
              const response = await axios.get(item.link, {
                timeout: 8000, // Reduced timeout for faster response
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
              });
              
              const metadata = await scraper({
                url: item.link,
                html: response.data
              });
              
              if (metadata.image) {
                imageUrl = metadata.image;
                console.log(`Found image via metascraper: ${imageUrl}`);
              } else {
                console.log(`No image found via metascraper for: ${item.link}`);
              }
            } catch (scrapeError) {
              console.warn(`Failed to scrape image from ${item.link}:`, scrapeError.message);
            }
          }
          
          // Create human-readable summary
          const humanSummary = createHumanSummary(item.contentSnippet || item.description || item.content || '');
          
          // Create article object in our format
          const article = {
            id: item.guid || item.link,
            title: item.title || '',
            excerpt: humanSummary,
            content: item.content || item.description || '',
            category: getArticleCategory(item.title || '', item.content || ''),
            image: imageUrl || 'https://via.placeholder.com/400x250?text=News+Image',
            readTime: '3 min read',
            author: sourceNames[feedUrl] || 'Nigerian News',
            source: 'rss',
            contentType: getContentType(item.title || ''),
            status: 'published',
            featured: false,
            externalLink: item.link || '',
            date: item.pubDate || new Date().toISOString()
          };
          
          feedArticles.push(article);
        }
        
        // Cache the results
        setCachedFeed(feedUrl, feedArticles);
        return feedArticles;
      } catch (error) {
        console.error(`Failed to fetch ${feedUrl}:`, error.message);
        return [];
      }
    });
    
    // Wait for all feeds to complete
    const results = await Promise.all(fetchPromises);
    
    // Flatten all articles
    results.forEach(feedArticles => {
      allArticles.push(...feedArticles);
    });
    
    // Sort articles by date (newest first)
    allArticles.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    res.json(allArticles);
  } catch (error) {
    console.error('Error fetching Nigerian news:', error);
    res.status(500).json({ error: 'Failed to fetch Nigerian news' });
  }
});


// Helper function to create human-readable summaries
const createHumanSummary = (text) => {
  if (!text || text.length < 10) return '';
  
  // Remove HTML tags and clean up text
  let cleanText = text.replace(/<[^>]*>/g, '');
  cleanText = cleanText.replace(/\s+/g, ' ').trim();
  
  // Remove common RSS feed clutter
  cleanText = cleanText.replace(/Read more about this story on.*$/gm, '');
  cleanText = cleanText.replace(/Source:.*$/gm, '');
  cleanText = cleanText.replace(/Photo Credit:.*$/gm, '');
  cleanText = cleanText.replace(/\[CDATA\[.*?\]\]/g, '');
  
  // Make it sound conversational
  cleanText = cleanText.replace(/According to.*?that/, 'So');
  cleanText = cleanText.replace(/In a recent development/, 'Guess what happened');
  cleanText = cleanText.replace(/Sources close to/, 'Insiders say');
  cleanText = cleanText.replace(/It has been revealed that/, 'Turns out');
  cleanText = cleanText.replace(/Meanwhile,/, 'On the flip side,');
  cleanText = cleanText.replace(/Furthermore/, 'And get this,');
  cleanText = cleanText.replace(/However/, 'But here\'s the thing,');
  cleanText = cleanText.replace(/Additionally/, 'Oh, and also,');
  
  // Add conversational tone
  if (cleanText.length > 200) {
    cleanText = cleanText.substring(0, 200) + '...';
  }
  
  // Remove trailing ellipsis if it's already there
  cleanText = cleanText.replace(/\.{2,}$/g, '');
  
  // Add natural ending
  if (!cleanText.endsWith('.') && !cleanText.endsWith('!') && !cleanText.endsWith('?')) {
    cleanText += '.';
  }
  
  return cleanText.trim();
};

// Helper function to categorize articles
const getArticleCategory = (title, content) => {
  const text = (title + ' ' + content).toLowerCase();
  
  // Ultra-specific categories for competitive advantage
  if (text.includes('nollywood') || text.includes('film') || text.includes('movie') || text.includes('cinema')) {
    return 'nollywood';
  }
  if (text.includes('music') || text.includes('afrobeats') || text.includes('artist') || text.includes('album')) {
    return 'afrobeats';
  }
  if (text.includes('fashion') || text.includes('style') || text.includes('designer') || text.includes('runway')) {
    return 'lagos-fashion';
  }
  if (text.includes('tech') || text.includes('technology') || text.includes('startup') || text.includes('innovation')) {
    return 'nigerian-tech';
  }
  if (text.includes('gaming') || text.includes('game') || text.includes('playstation') || text.includes('xbox') || text.includes('pc gamer')) {
    return 'nigerian-gaming';
  }
  if (text.includes('crypto') || text.includes('bitcoin') || text.includes('blockchain') || text.includes('nft')) {
    return 'crypto-nigeria';
  }
  if (text.includes('sports') || text.includes('football') || text.includes('soccer') || text.includes('basketball')) {
    return 'nigerian-sports';
  }
  if (text.includes('politics') || text.includes('government') || text.includes('election') || text.includes('senate')) {
    return 'nigerian-politics';
  }
  if (text.includes('business') || text.includes('economy') || text.includes('market') || text.includes('investment')) {
    return 'nigerian-business';
  }
  if (text.includes('lifestyle') || text.includes('health') || text.includes('food') || text.includes('travel')) {
    return 'nigerian-lifestyle';
  }
  
  // Default categories
  if (text.includes('entertainment') || text.includes('celebrity') || text.includes('showbiz')) {
    return 'entertainment';
  }
  if (text.includes('news') || text.includes('breaking') || text.includes('today')) {
    return 'news';
  }
  
  return 'general';
};

// Helper function to get content type
const getContentType = (title) => {
  const text = title.toLowerCase();
  
  if (text.includes('review') || text.includes('rating')) {
    return 'review';
  }
  if (text.includes('interview') || text.includes('chat')) {
    return 'interview';
  }
  if (text.includes('list') || text.includes('top')) {
    return 'list';
  }
  if (text.includes('guide') || text.includes('how to')) {
    return 'guide';
  }
  if (text.includes('breaking') || text.includes('update')) {
    return 'breaking';
  }
  
  return 'article';
};

// RSS Feeds configuration object
const FEEDS = {
  nigerian: [
    // Nigerian newspaper RSS feeds (3 most reliable)
    'https://punchng.com/feed/',
    'https://www.vanguardngr.com/feed/',
    'https://www.thisdaylive.com/feed/',
    
    // World News RSS feeds (3 most reliable)
    'http://feeds.bbci.co.uk/news/world/rss.xml',
    'https://www.aljazeera.com/xml/rss/all.xml',
    'https://www.espn.com/espn/rss/news',
    
    // International Entertainment RSS feeds (3 most reliable)
    'https://variety.com/feed/',
    'https://www.rollingstone.com/feed/',
    'https://www.theverge.com/rss/index.xml',
    
    // Fashion & Lifestyle RSS feeds (3 most reliable)
    'https://www.businessoffashion.com/feed',
    'https://www.bellanaija.com/feed/',
    'https://pulse.ng/rss/entertainment'
  ],
  world: [
    // World News RSS feeds
    'http://feeds.bbci.co.uk/news/world/rss.xml',
    'https://www.aljazeera.com/xml/rss/all.xml',
    'https://www.espn.com/espn/rss/news',
    
    // International Entertainment RSS feeds
    'https://variety.com/feed/',
    'https://www.rollingstone.com/feed/',
    'https://www.theverge.com/rss/index.xml',
    
    // International Technology RSS feeds
    'https://www.wired.com/feed/rss',
    'https://www.coindesk.com/arc/outboundfeeds/rss/',
    'https://cointelegraph.com/rss',
    'https://bitcoinmagazine.com/.rss/full/',
    'https://techcabal.com/feed/',
    
    // International Gaming RSS feeds
    'https://feeds.feedburner.com/ign/all',
    'https://www.gamespot.com/feeds/news/',
    'https://www.pcgamer.com/rss/',
    'https://kotaku.com/rss',
    
    // International Fashion & Lifestyle RSS feeds
    'https://www.businessoffashion.com/feed',
    'https://fashionista.com/.rss/excerpt',
    'https://wwd.com/feed/',
    'https://feeds.feedburner.com/fibre2fashion/fashion-news'
  ]
};

const SOURCE_NAMES = {
  // Nigerian News
  'https://punchng.com/feed/': 'The Punch',
  'https://www.vanguardngr.com/feed/': 'Vanguard',
  'https://www.thisdaylive.com/feed/': 'ThisDay',
  'https://www.premiumtimesng.com/feed': 'Premium Times',
  'https://guardian.ng/feed': 'The Guardian Nigeria',
  'https://www.thenationonlineng.net/feed': 'The Nation Online',
  'https://www.sunnewsonline.com/feed': 'The Sun Nigeria',
  'https://www.dailytrust.com/feed': 'Daily Trust',
  'https://www.nairametrics.com/feed': 'Nairametrics',
  'https://www.nigerianobservernews.com/feed': 'Nigerian Observer',
  
  // World News
  'http://feeds.bbci.co.uk/news/world/rss.xml': 'BBC News',
  'https://www.aljazeera.com/xml/rss/all.xml': 'Al Jazeera',
  
  // International Entertainment
  'https://variety.com/feed/': 'Variety',
  'https://www.rollingstone.com/feed/': 'Rolling Stone',
  'https://www.theverge.com/rss/index.xml': 'The Verge',
  
  // International Technology
  'https://www.wired.com/feed/rss': 'Wired',
  'https://www.coindesk.com/arc/outboundfeeds/rss/': 'CoinDesk',
  'https://cointelegraph.com/rss': 'CoinTelegraph',
  'https://bitcoinmagazine.com/.rss/full/': 'Bitcoin Magazine',
  'https://techcabal.com/feed/': 'TechCabal',
  
  // Gaming
  'https://feeds.feedburner.com/ign/all': 'IGN',
  'https://www.gamespot.com/feeds/news/': 'GameSpot',
  'https://www.pcgamer.com/rss/': 'PC Gamer',
  'https://kotaku.com/rss': 'Kotaku',
  
  // Fashion & Lifestyle
  'https://www.businessoffashion.com/feed': 'The Business of Fashion',
  'https://fashionista.com/.rss/excerpt': 'Fashionista',
  'https://wwd.com/feed/': 'WWD',
  'https://feeds.feedburner.com/fibre2fashion/fashion-news': 'Fibre2Fashion',
  
  // Entertainment & Culture
  'https://www.bellanaija.com/feed/': 'BellaNaija',
  'https://pulse.ng/rss/entertainment': 'Pulse Nigeria',
  'https://www.nollywoodforever.com/feed/': 'Nollywood Forever',
  'https://www.nairaland.com/feeds/entertainment': 'Nairaland',
  'https://www.ynaija.com/feed/': 'YNaija',
  'https://www.nollywoodgists.com/feed/': 'Nollywood Gists',
  'https://www.nollywoodnews.com/feed/': 'Nollywood News',
  'https://www.360nobs.com/feed': '360 Nobs',
  'https://www.naijaparty.com/feed': 'Naija Party',
  'https://www.nigerianmusicblog.com/feed': 'Nigerian Music Blog',
  'https://www.nigerianfilms.com/feed': 'Nigerian Films',
  'https://www.nigeriancelebrities.com/feed': 'Nigerian Celebrities',
  'https://www.nigerianlifestyle.com/feed': 'Nigerian Lifestyle',
  'https://www.nigerianfashionblog.com/feed': 'Nigerian Fashion Blog',
  
  // Technology & Business
  'https://www.nairatech.com/feed': 'Naira Tech',
  'https://www.nigerianstartups.com/feed': 'Nigerian Startups',
  'https://www.nigerianbusiness.com/feed': 'Nigerian Business',
  'https://www.nigerianfinanceblog.com/feed': 'Nigerian Finance Blog',
  'https://www.nigerianentrepreneur.com/feed': 'Nigerian Entrepreneur',
  'https://www.nigerianinvestor.com/feed': 'Nigerian Investor',
  'https://www.nigerianmarket.com/feed': 'Nigerian Market',
  'https://www.nigerianecommerce.com/feed': 'Nigerian E-commerce',
  'https://www.nigeriantechblog.com/feed': 'Nigerian Tech Blog'
};

// Dynamic RSS Parser endpoint for all categories
app.get('/api/news/:category', async (req, res) => {
  try {
    const category = req.params.category.toLowerCase();
    
    // Check if category exists in our feeds configuration
    if (!FEEDS[category]) {
      return res.status(404).json({ error: `Category '${category}' not found. Available categories: ${Object.keys(FEEDS).join(', ')}` });
    }
    
    const feeds = FEEDS[category];
    const allArticles = [];
    
    // Process all feeds in parallel for better performance
    const fetchPromises = feeds.map(async (feedUrl) => {
      try {
        // Check cache first
        const cachedData = getCachedFeed(feedUrl);
        if (cachedData) {
          console.log(`Using cached data for: ${feedUrl}`);
          return cachedData;
        }
        
        console.log(`Fetching ${category} RSS feed: ${feedUrl}`);
        const feed = await parser.parseURL(feedUrl);
        
        // Process each item in the feed
        const feedArticles = [];
        for (const item of feed.items) {
          // Extract image from RSS enclosure or media tags first
          let imageUrl = '';
          if (item.enclosure && item.enclosure.url) {
            imageUrl = item.enclosure.url;
          } else if (item['media:content'] && item['media:content'].url) {
            imageUrl = item['media:content'].url;
          } else if (item['media:thumbnail'] && item['media:thumbnail'].url) {
            imageUrl = item['media:thumbnail'].url;
          }
          
          // If no image found in RSS, try to extract from the article page using metascraper
          if (!imageUrl && item.link) {
            try {
              console.log(`Extracting image from article: ${item.link}`);
              const response = await axios.get(item.link, {
                timeout: 8000, // Reduced timeout for faster response
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
              });
              
              const metadata = await scraper({
                url: item.link,
                html: response.data
              });
              
              if (metadata.image) {
                imageUrl = metadata.image;
                console.log(`Found image via metascraper: ${imageUrl}`);
              } else {
                console.log(`No image found via metascraper for: ${item.link}`);
              }
            } catch (scrapeError) {
              console.warn(`Failed to scrape image from ${item.link}:`, scrapeError.message);
            }
          }
          
          // Create human-readable summary
          const humanSummary = createHumanSummary(item.contentSnippet || item.description || item.content || '');
          
          // Create article object in our format
          const article = {
            id: item.guid || item.link,
            title: item.title || '',
            excerpt: humanSummary,
            content: item.content || item.description || '',
            category: getArticleCategory(item.title || '', item.content || ''),
            image: imageUrl || `https://via.placeholder.com/400x250?text=${category}+News`,
            readTime: '3 min read',
            author: SOURCE_NAMES[feedUrl] || `${category.charAt(0).toUpperCase() + category.slice(1)} News`,
            source: 'rss',
            contentType: getContentType(item.title || ''),
            status: 'published',
            featured: false,
            externalLink: item.link || '',
            date: item.pubDate || new Date().toISOString()
          };
          
          feedArticles.push(article);
        }
        
        // Cache the results
        setCachedFeed(feedUrl, feedArticles);
        return feedArticles;
      } catch (error) {
        console.error(`Failed to fetch ${feedUrl}:`, error.message);
        return [];
      }
    });
    
    // Wait for all feeds to complete
    const results = await Promise.all(fetchPromises);
    
    // Flatten all articles
    results.forEach(feedArticles => {
      allArticles.push(...feedArticles);
    });
    
    // Sort articles by date (newest first)
    allArticles.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    res.json(allArticles);
  } catch (error) {
    console.error(`Error fetching ${req.params.category} news:`, error);
    res.status(500).json({ error: `Failed to fetch ${req.params.category} news` });
  }
});

// Start server
const port = process.env.PORT || 3001;
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
  console.log(`Try POST /api/auth/login with username: admin, password: admin123`);
});



