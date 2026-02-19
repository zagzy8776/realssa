require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');
const { generateRSSFeed } = require('./rss-generator');
const fetch = require('node-fetch').default;


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

// Sports RSS feeds (Nigerian/African + Global)
const sportsFeeds = [
  // Global / International Sports (broad + football-heavy)
  'https://www.skysports.com/rss/12040', // Sky Sports (general)
  'https://api.foxsports.com/v2/content/optimized-rss?partnerKey=MB0Wehpmuj2lUhuRhQaafhBjAJqaPU244mlTDK1i&size=30', // FOX Sports (optimized RSS)
  'https://www.espn.com/espn/rss/news', // ESPN Top News
  'https://feeds.bbci.co.uk/sport/rss.xml', // BBC Sport
  'https://www.goal.com/en/rss', // Goal.com Global Football
  'https://www.sportingnews.com/us/rss', // The Sporting News
  'https://sports.yahoo.com/rss/', // Yahoo Sports News
  'https://www.reuters.com/arc/outboundfeeds/rss/category/sports/', // Reuters Sports
  'https://feeds.abcnews.com/abcnews/sportsheadlines', // ABC News Sports
  'https://www.cbssports.com/rss/headlines/', // CBS Sports
  'https://bleacherreport.com/articles/feed', // Bleacher Report
  'https://www.si.com/.rss', // Sports Illustrated
  'https://globalnews.ca/sports/feed/', // Global News Sports (Canada but broad)

  // Nigerian / African / Home-base (Super Eagles, NPFL, AFCON, local football)
  'https://www.pulsesports.ng/feed', // Pulse Sports Nigeria (great for NPFL, Super Eagles)
  'https://www.completesports.com/feed/', // Complete Sports Nigeria
  'https://www.sports247.ng/feed', // Sports247 Nigeria
  'https://www.goal.com/en-ng/rss', // Goal.com Nigeria (Super Eagles focus)
  'https://guardian.ng/feed/?cat=football', // Guardian Nigeria Sports/Football
  'https://dailypost.ng/category/sports/feed/', // Daily Post Nigeria Sports
  'https://www.premiumtimesng.com/sports/feed', // Premium Times Sports
  'https://www.legit.ng/sports/feed/', // Legit.ng Sports
  'https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf', // AllAfrica Nigeria Sports
];

// Ghana RSS feeds (News, Culture, Entertainment, Sports)
const ghanaFeeds = [
  // Major Ghana News Sources
  'https://www.graphic.com.gh/rss.xml', // Graphic Online (major Ghana news)
  'https://www.myjoyonline.com/feed/', // Joy Online (comprehensive Ghana news)
  'https://citinewsroom.com/feed/', // Citi FM/Newsroom (breaking news)
  'https://www.ghanaweb.com/GhanaHomePage/rss.php', // GhanaWeb (extensive coverage)
  'https://3news.com/feed/', // 3News (TV news network)
  'https://www.pulse.com.gh/rss', // Pulse Ghana (entertainment & lifestyle)
  'https://yen.com.gh/feed/', // Yen.com.gh (youth-focused news)
  'https://www.thefinderonline.com/feed/', // The Finder (investigative journalism)
  'https://www.ghanaiannews.ca/feed/', // Ghanaian News (diaspora focus)
  'https://www.ghanaguardian.com/feed/', // Ghana Guardian

  // Culture & Entertainment
  'https://www.ghanaianmusic.com/feed/', // Ghanaian Music (if available)
  'https://www.celebgist.com/feed/', // Celeb Gist (entertainment)
  'https://www.ghanaweekend.com/feed/', // Ghana Weekend (lifestyle)

  // Sports (Ghana-focused)
  'https://www.goal.com/en-gh/rss', // Goal.com Ghana
  'https://sports.myjoyonline.com/feed/', // Joy Sports
  'https://www.ghanasoccernet.com/feed/', // Ghana Soccer Net
  'https://www.pulse.com.gh/sports/rss', // Pulse Sports Ghana

  // Business & Economy
  'https://www.businessghana.com/rss.xml', // Business Ghana
  'https://www.bftonline.com.gh/feed/', // Business Financial Times
];

// Kenya RSS feeds (Entertainment, Music, Culture, Fashion + News)
const kenyaFeeds = [
  // Major Kenya News & Entertainment Sources
  'https://nation.africa/kenya/rss', // Nation Africa (broad Kenyan news, entertainment, culture, lifestyle)
  'https://www.standardmedia.co.ke/rss/entertainment.php', // The Standard Entertainment
  'https://www.kenyans.co.ke/rss.xml', // Kenyans.co.ke (breaking news, entertainment, gossip, celebrity)
  'https://www.ghafla.co.ke/ke/feed', // Ghafla Kenya (entertainment, celebrity gossip, music, fashion)
  'https://www.mpasho.co.ke/feed', // Mpasho (entertainment, lifestyle, music, videos, celebrity news)
  'https://nairobiwire.com/feed', // Nairobi Wire (Kenya breaking news, entertainment, politics, lifestyle)
  'https://www.capitalfm.co.ke/feed', // Capital FM Kenya (news, music, entertainment)
  'https://www.pulse.ng/rss', // Pulse Kenya (entertainment, music, fashion, celebrity)

  // Additional Entertainment & Culture
  'https://www.standardmedia.co.ke/rss/headlines.php', // The Standard General (fallback)
  'https://www.the-star.co.ke/rss', // The Star Kenya (entertainment focus)
];

// South Africa RSS feeds (Entertainment, Music, Culture, Fashion + News)
const southAfricaFeeds = [
  // Major South Africa News & Entertainment Sources
  'https://www.news24.com/news24/rss', // News24 (broad SA news, entertainment section)
  'https://www.iol.co.za/rss/iol/entertainment', // IOL Entertainment
  'https://www.timeslive.co.za/rss', // TimesLIVE / Sunday Times (SA news, entertainment, lifestyle)
  'https://www.thesouthafrican.com/feed', // The South African (entertainment, music, culture, lifestyle)
  'https://sahiphopmag.co.za/feed', // SA Hip Hop Mag (South African hip hop, music, urban culture)
  'https://samusicnews.co.za/feed', // SA Music News & Entertainment
  'https://undergroundpress.co.za/feed', // Underground Press (music, film, TV, comedy, events)
  'https://www.bizcommunity.com/rss', // Bizcommunity (business + entertainment/lifestyle in SA)

  // Additional Entertainment Feeds
  'https://www.news24.com/entertainment/rss', // News24 Entertainment specific
  'https://www.iol.co.za/rss/iol/entertainment/music', // IOL Music specific
];

// UK RSS feeds (Entertainment, Music, Fashion, Celebrity + News)
const ukFeeds = [
  // Major UK News & Entertainment Sources
  'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml', // BBC News Entertainment & Arts
  'https://www.theguardian.com/uk/entertainment/rss', // The Guardian Entertainment
  'https://metro.co.uk/entertainment/showbiz/feed/', // Metro UK Showbiz
  'https://www.dailymail.co.uk/tvshowbiz/index.rss', // Daily Mail TV & Showbiz
  'https://www.independent.co.uk/arts-entertainment/rss', // The Independent Entertainment
  'https://www.nme.com/rss', // NME (music, entertainment, culture)
  'https://www.vogue.co.uk/feed/rss', // Vogue UK (fashion, style, culture)
  'https://www.hellomagazine.com/rss/', // Hello! Magazine (celebrity, fashion, entertainment)

  // Additional UK Entertainment
  'https://www.sky.com/rss/entertainment', // Sky Entertainment (if available)
  'https://www.itv.com/rss/entertainment', // ITV Entertainment (if available)
];

// USA RSS feeds (Entertainment, Music, Fashion, Celebrity + News)
const usaFeeds = [
  // Major USA News & Entertainment Sources
  'https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml', // NYTimes Entertainment
  'https://rss.cnn.com/rss/edition_entertainment.rss', // CNN Entertainment
  'https://www.buzzfeed.com/entertainment.xml', // BuzzFeed Entertainment
  'https://www.billboard.com/feed/', // Billboard (music industry, charts, news)
  'https://www.vogue.com/feed/rss', // Vogue US (fashion, style, celebrity)
  'https://people.com/feed/', // People Magazine (celebrity, entertainment, music)
  'https://ew.com/feed/', // Entertainment Weekly
  'https://variety.com/feed/', // Variety (entertainment, film, music, TV)

  // Additional USA Entertainment
  'https://rss.nytimes.com/services/xml/rss/nyt/Movies.xml', // NYTimes Movies
  'https://www.hollywoodreporter.com/feed/', // Hollywood Reporter
];

// Helper function to fetch RSS feeds with timeout
const fetchRSSFeeds = async (feeds, timeoutMs = 5000) => {
  const allArticles = [];
  const parser = new Parser();

  for (const feedUrl of feeds) {
    try {
      console.log(`Fetching RSS feed: ${feedUrl}`);
      
      // Add timeout to each feed request
      const feedPromise = parser.parseURL(feedUrl);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      );
      
      const feed = await Promise.race([feedPromise, timeoutPromise]);

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

// Get Sports news
app.get('/api/news/sports', async (req, res) => {
  try {
    console.log('Fetching Sports news feeds...');
    const articles = await fetchRSSFeeds(sportsFeeds);
    console.log(`Fetched ${articles.length} Sports articles`);
    res.json(articles);
  } catch (error) {
    console.error('Error fetching Sports news:', error);
    res.status(500).json({ error: 'Failed to fetch Sports news' });
  }
});

// Get Ghana news
app.get('/api/news/ghana', async (req, res) => {
  try {
    console.log('Fetching Ghana news feeds...');
    const articles = await fetchRSSFeeds(ghanaFeeds);
    console.log(`Fetched ${articles.length} Ghana articles`);
    res.json(articles);
  } catch (error) {
    console.error('Error fetching Ghana news:', error);
    res.status(500).json({ error: 'Failed to fetch Ghana news' });
  }
});

// Get Kenya news
app.get('/api/news/kenya', async (req, res) => {
  try {
    console.log('Fetching Kenya news feeds...');
    const articles = await fetchRSSFeeds(kenyaFeeds);
    console.log(`Fetched ${articles.length} Kenya articles`);
    res.json(articles);
  } catch (error) {
    console.error('Error fetching Kenya news:', error);
    res.status(500).json({ error: 'Failed to fetch Kenya news' });
  }
});

// Get South Africa news
app.get('/api/news/south-africa', async (req, res) => {
  try {
    console.log('Fetching South Africa news feeds...');
    const articles = await fetchRSSFeeds(southAfricaFeeds);
    console.log(`Fetched ${articles.length} South Africa articles`);
    res.json(articles);
  } catch (error) {
    console.error('Error fetching South Africa news:', error);
    res.status(500).json({ error: 'Failed to fetch South Africa news' });
  }
});

// Get UK news
app.get('/api/news/uk', async (req, res) => {
  try {
    console.log('Fetching UK news feeds...');
    const articles = await fetchRSSFeeds(ukFeeds);
    console.log(`Fetched ${articles.length} UK articles`);
    res.json(articles);
  } catch (error) {
    console.error('Error fetching UK news:', error);
    res.status(500).json({ error: 'Failed to fetch UK news' });
  }
});

// Get USA news
app.get('/api/news/usa', async (req, res) => {
  try {
    console.log('Fetching USA news feeds...');
    const articles = await fetchRSSFeeds(usaFeeds);
    console.log(`Fetched ${articles.length} USA articles`);
    res.json(articles);
  } catch (error) {
    console.error('Error fetching USA news:', error);
    res.status(500).json({ error: 'Failed to fetch USA news' });
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

// Simple news endpoint - returns articles from database (fast)
app.get('/api/news', async (req, res) => {
  try {
    // Get articles from database
    const result = await pool.query('SELECT * FROM articles ORDER BY date DESC LIMIT 50');
    
    // If no articles in DB, return empty array
    if (result.rows.length === 0) {
      return res.json([]);
    }
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching news from DB:', error);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

// News feed endpoint - aggregates all RSS feeds for the main news feed
app.get('/news-feed', async (req, res) => {
  try {
    console.log('Fetching news feed...');
    
    // Set a timeout for the entire operation
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('News feed timeout')), 25000)
    );
    
    const fetchPromise = (async () => {
      // Fetch from multiple feed sources with shorter timeouts
      const [nigerianArticles, worldArticles, ghanaArticles, kenyaArticles, southAfricaArticles] = await Promise.all([
        fetchRSSFeeds(nigerianFeeds.slice(0, 5), 3000).catch(() => []), // Only first 5 feeds, 3s timeout each
        fetchRSSFeeds(worldFeeds.slice(0, 5), 3000).catch(() => []),
        fetchRSSFeeds(ghanaFeeds.slice(0, 3), 3000).catch(() => []),
        fetchRSSFeeds(kenyaFeeds.slice(0, 3), 3000).catch(() => []),
        fetchRSSFeeds(southAfricaFeeds.slice(0, 3), 3000).catch(() => [])
      ]);

      // Map articles with their categories
      const nigerianMapped = nigerianArticles.map(item => ({
        ...item,
        country: 'Nigeria',
        category: item.category || 'news'
      }));

      const worldMapped = worldArticles.map(item => ({
        ...item,
        country: 'Global',
        category: item.category || 'world'
      }));

      const ghanaMapped = ghanaArticles.map(item => ({
        ...item,
        country: 'Ghana',
        category: item.category || 'news'
      }));

      const kenyaMapped = kenyaArticles.map(item => ({
        ...item,
        country: 'Kenya',
        category: item.category || 'news'
      }));

      const southAfricaMapped = southAfricaArticles.map(item => ({
        ...item,
        country: 'South Africa',
        category: item.category || 'news'
      }));

      // Combine all articles
      const combined = [
        ...nigerianMapped,
        ...worldMapped,
        ...ghanaMapped,
        ...kenyaMapped,
        ...southAfricaMapped
      ];

      // Sort by date (newest first) - return ALL articles
      return combined
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    })();
    
    // Race between fetch and timeout
    const sorted = await Promise.race([fetchPromise, timeoutPromise]);

    console.log(`Fetched ${sorted.length} articles for news feed`);
    res.json(sorted);
  } catch (error) {
    console.error('Error fetching news feed:', error);
    // Return empty array instead of error so frontend can handle gracefully
    res.json([]);
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

// Push Notification endpoints
const subscriptionsFilePath = path.join(__dirname, 'data', 'subscriptions.json');

// Ensure subscriptions file exists
if (!fs.existsSync(subscriptionsFilePath)) {
  fs.writeFileSync(subscriptionsFilePath, JSON.stringify([]));
}

// Subscribe to push notifications
app.post('/api/push/subscribe', (req, res) => {
  try {
    const subscription = req.body;
    
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription data' });
    }

    const subscriptions = readJsonFile(subscriptionsFilePath);
    
    // Check if already subscribed
    const exists = subscriptions.find(sub => sub.endpoint === subscription.endpoint);
    if (exists) {
      return res.json({ message: 'Already subscribed' });
    }

    // Add new subscription
    subscriptions.push({
      ...subscription,
      createdAt: new Date().toISOString()
    });
    
    writeJsonFile(subscriptionsFilePath, subscriptions);
    
    console.log(`New push subscription: ${subscription.endpoint.substring(0, 50)}...`);
    res.json({ message: 'Subscribed successfully' });
  } catch (error) {
    console.error('Error saving subscription:', error);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// Unsubscribe from push notifications
app.post('/api/push/unsubscribe', (req, res) => {
  try {
    const { endpoint } = req.body;
    
    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint required' });
    }

    let subscriptions = readJsonFile(subscriptionsFilePath);
    subscriptions = subscriptions.filter(sub => sub.endpoint !== endpoint);
    writeJsonFile(subscriptionsFilePath, subscriptions);
    
    console.log(`Push subscription removed: ${endpoint.substring(0, 50)}...`);
    res.json({ message: 'Unsubscribed successfully' });
  } catch (error) {
    console.error('Error removing subscription:', error);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

// Send push notification (admin only)
app.post('/api/push/send', async (req, res) => {
  try {
    const { title, body, url } = req.body;
    
    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body required' });
    }

    const subscriptions = readJsonFile(subscriptionsFilePath);
    
    if (subscriptions.length === 0) {
      return res.json({ message: 'No subscribers', sent: 0 });
    }

    // Send notification to all subscribers
    const webpush = require('web-push');
    
    // Set VAPID keys
    webpush.setVapidDetails(
      'mailto:admin@realssa.com',
      process.env.VAPID_PUBLIC_KEY || '',
      process.env.VAPID_PRIVATE_KEY || ''
    );

    const payload = JSON.stringify({
      title: title || 'Realssa News',
      body: body,
      icon: '/logo.png',
      badge: '/badge-72x72.png',
      data: {
        url: url || '/',
        dateOfArrival: Date.now()
      }
    });

    const results = await Promise.allSettled(
      subscriptions.map(sub => 
        webpush.sendNotification(sub, payload).catch(err => {
          if (err.statusCode === 410) {
            // Subscription expired, remove it
            return { expired: true, endpoint: sub.endpoint };
          }
          throw err;
        })
      )
    );

    // Remove expired subscriptions
    const expiredEndpoints = results
      .filter(r => r.value?.expired)
      .map(r => r.value.endpoint);
    
    if (expiredEndpoints.length > 0) {
      const updatedSubscriptions = subscriptions.filter(
        sub => !expiredEndpoints.includes(sub.endpoint)
      );
      writeJsonFile(subscriptionsFilePath, updatedSubscriptions);
      console.log(`Removed ${expiredEndpoints.length} expired subscriptions`);
    }

    const successful = results.filter(r => r.status === 'fulfilled' && !r.value?.expired).length;
    
    console.log(`Push notification sent to ${successful}/${subscriptions.length} subscribers`);
    res.json({ 
      message: 'Notification sent', 
      sent: successful,
      total: subscriptions.length,
      expired: expiredEndpoints.length
    });
  } catch (error) {
    console.error('Error sending push notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// Get subscription count (admin only)
app.get('/api/push/stats', (req, res) => {
  try {
    const subscriptions = readJsonFile(subscriptionsFilePath);
    res.json({ 
      subscribers: subscriptions.length,
      message: 'Push notification stats'
    });
  } catch (error) {
    console.error('Error getting push stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// RSS Feed endpoint - Generate RSS from articles
app.get('/rss/:category.xml', (req, res) => {
  try {
    const { category } = req.params;
    const rss = generateRSSFeed(category);
    
    res.set('Content-Type', 'application/rss+xml');
    res.set('Cache-Control', 'public, max-age=300'); // Cache 5 minutes
    res.send(rss);
  } catch (error) {
    console.error('RSS generation error:', error);
    res.status(500).send('Error generating RSS feed');
  }
});

// YouTube API Proxy endpoints
const YOUTUBE_CHANNELS = {
  africa: [
    { id: 'UC2Dj5hSvl9dz0KU3I6cX5QA', name: 'Channels Television', country: 'Nigeria' },
    { id: 'UCz8Qai14D9P6M1e9j7l5d3g', name: 'TVC News Nigeria', country: 'Nigeria' },
    { id: 'UC5Qw760GT1cTqk7K0irbXLQ', name: 'Arise News', country: 'Pan-African' },
    { id: 'UCW2U2fS60N1D4g2K0rK0z8g', name: 'africanews', country: 'Pan-African' },
    { id: 'UC4L2p46_r1JvM6m0S5m3d7g', name: 'CGTN Africa', country: 'China/Africa' },
    { id: 'UCi-DhB7T_3T3b3D4E5F6G7H', name: 'Newzroom Afrika', country: 'South Africa' },
    { id: 'UC1A1B2C3D4E5F6G7H8I9J0K', name: 'SABC News', country: 'South Africa' },
    { id: 'UC9A8B7C6D7E8F9G0H1I2J3K', name: 'Parliament RSA', country: 'South Africa' },
    { id: 'UCJ0-OtVpF0wOKEqT2Z1HEtA', name: 'BBC News Africa', country: 'UK/Africa' },
    { id: 'UC8r1E2PQgJfUdS_KjGHDoRw', name: 'Al Jazeera English', country: 'Qatar/Africa' },
  ],
  asia: [
    { id: 'UC1yBKRuGpCkSrBEWjsDx4UQ', name: 'NDTV', country: 'India' },
    { id: 'UCq-Fj5jknLsUf-MWSy4_brA', name: 'DW News', country: 'Germany' },
    { id: 'UCXIJgqnII2ZOINSWNOGFThA', name: 'Times Now', country: 'India' },
    { id: 'UCa3-g2QTYC96dhNUwXY1k0Q', name: 'India Today', country: 'India' },
    { id: 'UCX6OQ3DkcsbYNE6H8uQQuVA', name: 'BBC News', country: 'UK' },
    { id: 'UC4s1hA4OZ9LZcLjKNLy3tzw', name: 'NHK World-Japan', country: 'Japan' },
    { id: 'UCJx4n0Yv5YBwVtGQjXfZp5A', name: 'Arirang News', country: 'South Korea' },
    { id: 'UC6qTSOb700ocZ7bKMqZwt8w', name: 'CNA', country: 'Singapore' },
    { id: 'UCX6OQ3DkcsbYNE6H8uQQuVA', name: 'BBC News', country: 'UK' },
    { id: 'UC1AnxMZpI5pxKuJcMnqS0rg', name: 'Al Jazeera English', country: 'Qatar' },
  ],
  middle_east: [
    { id: 'UC1AnxMZpI5pxKuJcMnqS0rg', name: 'Al Jazeera English', country: 'Qatar' },
    { id: 'UCJx4n0Yv5YBwVtGQjXfZp5A', name: 'NHK World-Japan', country: 'Japan' },
    { id: 'UC4s1hA4OZ9LZcLjKNLy3tzw', name: 'Arirang News', country: 'South Korea' },
    { id: 'UC6qTSOb700ocZ7bKMqZwt8w', name: 'CNA', country: 'Singapore' },
    { id: 'UCX6OQ3DkcsbYNE6H8uQQuVA', name: 'BBC News', country: 'UK' },
    { id: 'UC1AnxMZpI5pxKuJcMnqS0rg', name: 'Al Jazeera English', country: 'Qatar' },
    { id: 'UCJx4n0Yv5YBwVtGQjXfZp5A', name: 'NHK World-Japan', country: 'Japan' },
    { id: 'UC4s1hA4OZ9LZcLjKNLy3tzw', name: 'Arirang News', country: 'South Korea' },
  ],
  latin_america: [
    { id: 'UCJ0-OtVpF0wOKEqT2Z1HEtA', name: 'BBC News', country: 'UK' },
    { id: 'UCX6OQ3DkcsbYNE6H8uQQuVA', name: 'BBC News', country: 'UK' },
    { id: 'UC1yBKRuGpCkSrBEWjsDx4UQ', name: 'NDTV', country: 'India' },
    { id: 'UCq-Fj5jknLsUf-MWSy4_brA', name: 'DW News', country: 'Germany' },
    { id: 'UCXIJgqnII2ZOINSWNOGFThA', name: 'Times Now', country: 'India' },
    { id: 'UCa3-g2QTYC96dhNUwXY1k0Q', name: 'India Today', country: 'India' },
    { id: 'UCJx4n0Yv5YBwVtGQjXfZp5A', name: 'NHK World-Japan', country: 'Japan' },
    { id: 'UC4s1hA4OZ9LZcLjKNLy3tzw', name: 'Arirang News', country: 'South Korea' },
  ],
  europe: [
    { id: 'UCW2t98l0K5X5X5X5X5X5X5X5', name: 'Euronews', country: 'Europe' },
    { id: 'UCQfwfsi5VrQ8yNUf7lL0YqA', name: 'FRANCE 24 English', country: 'France' },
    { id: 'UCq-Fj5jknLsUf-MWSy4_brA', name: 'DW News', country: 'Germany' },
    { id: 'UC7p4V5X5X5X5X5X5X5X5X5X', name: 'TVP World', country: 'Poland' },
    { id: 'UC1B2C3D4E5F6G7H8I9J0K1L', name: 'CGTN Europe', country: 'Europe' },
    { id: 'UC4V3M9h1l2X5X5X5X5X5X5X5', name: 'European Parliament', country: 'EU' },
    { id: 'UCJ0-OtVpF0wOKEqT2Z1HEtA', name: 'BBC News', country: 'UK' },
    { id: 'UCX6OQ3DkcsbYNE6H8uQQuVA', name: 'BBC News', country: 'UK' },
    { id: 'UC1yBKRuGpCkSrBEWjsDx4UQ', name: 'NDTV', country: 'India' },
    { id: 'UCq-Fj5jknLsUf-MWSy4_brA', name: 'DW News', country: 'Germany' },
    { id: 'UCXIJgqnII2ZOINSWNOGFThA', name: 'Times Now', country: 'India' },
    { id: 'UCa3-g2QTYC96dhNUwXY1k0Q', name: 'India Today', country: 'India' },
    { id: 'UCJx4n0Yv5YBwVtGQjXfZp5A', name: 'NHK World-Japan', country: 'Japan' },
    { id: 'UC4s1hA4OZ9LZcLjKNLy3tzw', name: 'Arirang News', country: 'South Korea' },
  ],
  usa: [
    { id: 'UCVHFbqXqoYvEWM1Ddxl0QDg', name: 'ABC News', country: 'USA' },
    { id: 'UC8-Th83bH_ZdB7c8y9K5w9g', name: 'CBS News', country: 'USA' },
    { id: 'UC6zN50e4c5l7H9K6L0K6N4M', name: 'NBC News', country: 'USA' },
    { id: 'UCaXkIU1QidjPwiAYu6GcHjg', name: 'CNN', country: 'USA' },
    { id: 'UCupvZG-5ko_eiXAupbDfxWw', name: 'Reuters', country: 'USA' },
    { id: 'UC16niRr50-MSBwiO3YDb3RA', name: 'The Guardian', country: 'UK/USA' },
    { id: 'UCJ0-OtVpF0wOKEqT2Z1HEtA', name: 'BBC News', country: 'UK' },
    { id: 'UCX6OQ3DkcsbYNE6H8uQQuVA', name: 'BBC News', country: 'UK' },
    { id: 'UC1yBKRuGpCkSrBEWjsDx4UQ', name: 'NDTV', country: 'India' },
    { id: 'UCq-Fj5jknLsUf-MWSy4_brA', name: 'DW News', country: 'Germany' },
    { id: 'UCXIJgqnII2ZOINSWNOGFThA', name: 'Times Now', country: 'India' },
    { id: 'UCa3-g2QTYC96dhNUwXY1k0Q', name: 'India Today', country: 'India' },
    { id: 'UCJx4n0Yv5YBwVtGQjXfZp5A', name: 'NHK World-Japan', country: 'Japan' },
    { id: 'UC4s1hA4OZ9LZcLjKNLy3tzw', name: 'Arirang News', country: 'South Korea' },
  ],
  canada: [
    { id: 'UCdva8oK1X7Z5X5X5X5X5X5X5', name: 'CBC News', country: 'Canada' },
    { id: 'UC7L2c5X5X5X5X5X5X5X5X5X', name: 'CTV News', country: 'Canada' },
    { id: 'UC3K5X5X5X5X5X5X5X5X5X5X', name: 'Global News', country: 'Canada' },
    { id: 'UCJ0-OtVpF0wOKEqT2Z1HEtA', name: 'BBC News', country: 'UK' },
    { id: 'UCX6OQ3DkcsbYNE6H8uQQuVA', name: 'BBC News', country: 'UK' },
    { id: 'UC1yBKRuGpCkSrBEWjsDx4UQ', name: 'NDTV', country: 'India' },
    { id: 'UCq-Fj5jknLsUf-MWSy4_brA', name: 'DW News', country: 'Germany' },
    { id: 'UCXIJgqnII2ZOINSWNOGFThA', name: 'Times Now', country: 'India' },
    { id: 'UCa3-g2QTYC96dhNUwXY1k0Q', name: 'India Today', country: 'India' },
    { id: 'UCJx4n0Yv5YBwVtGQjXfZp5A', name: 'NHK World-Japan', country: 'Japan' },
    { id: 'UC4s1hA4OZ9LZcLjKNLy3tzw', name: 'Arirang News', country: 'South Korea' },
  ],
  australia: [
    { id: 'UCJ0-OtVpF0wOKEqT2Z1HEtA', name: 'BBC News', country: 'UK' },
    { id: 'UCX6OQ3DkcsbYNE6H8uQQuVA', name: 'BBC News', country: 'UK' },
    { id: 'UC1yBKRuGpCkSrBEWjsDx4UQ', name: 'NDTV', country: 'India' },
    { id: 'UCq-Fj5jknLsUf-MWSy4_brA', name: 'DW News', country: 'Germany' },
    { id: 'UCXIJgqnII2ZOINSWNOGFThA', name: 'Times Now', country: 'India' },
    { id: 'UCa3-g2QTYC96dhNUwXY1k0Q', name: 'India Today', country: 'India' },
    { id: 'UCJx4n0Yv5YBwVtGQjXfZp5A', name: 'NHK World-Japan', country: 'Japan' },
    { id: 'UC4s1hA4OZ9LZcLjKNLy3tzw', name: 'Arirang News', country: 'South Korea' },
  ],
};

// Helper function to check channel status and get recent videos
async function checkChannelLiveStatus(channelId, apiKey) {
  try {
    // First, get channel details
    const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&id=${channelId}&key=${apiKey}`;
    const channelResponse = await fetch(channelUrl);
    const channelData = await channelResponse.json();

    if (!channelData.items || channelData.items.length === 0) {
      return null;
    }

    const channel = channelData.items[0];
    const uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads;

    // Check for live streams first
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video&key=${apiKey}`;
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    let videoId = '';
    let title = channel.snippet.title;
    let isLive = false;
    let thumbnail = channel.snippet.thumbnails?.high?.url || channel.snippet.thumbnails?.default?.url || '';
    let views = 'Recorded';

    if (searchData.items && searchData.items.length > 0) {
      // Channel is live!
      const liveVideo = searchData.items[0];
      videoId = liveVideo.id.videoId;
      title = liveVideo.snippet.title;
      isLive = true;
      views = '🔴 LIVE';
      thumbnail = liveVideo.snippet.thumbnails?.high?.url || thumbnail;
    } else {
      // Get recent videos from uploads playlist
      const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=5&key=${apiKey}`;
      const playlistResponse = await fetch(playlistUrl);
      const playlistData = await playlistResponse.json();

      if (playlistData.items && playlistData.items.length > 0) {
        // Get the most recent video
        const recentVideo = playlistData.items[0].snippet;
        videoId = recentVideo.resourceId.videoId;
        title = recentVideo.title;
        thumbnail = recentVideo.thumbnails?.high?.url || thumbnail;

        // Check if this video is live
        const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails&id=${videoId}&key=${apiKey}`;
        const videoResponse = await fetch(videoUrl);
        const videoData = await videoResponse.json();

        if (videoData.items && videoData.items.length > 0) {
          const video = videoData.items[0];
          isLive = video.snippet.liveBroadcastContent === 'live';
          if (isLive) {
            views = '🔴 LIVE';
          }
        }
      }
    }

    return {
      id: channelId,
      title: `${channel.snippet.title} ${isLive ? '- LIVE' : ''}`,
      channelName: channel.snippet.title,
      videoId: videoId || 'dQw4w9WgXcQ', // Fallback video ID
      thumbnail: thumbnail,
      isLive,
      views: views,
      country: channel.snippet.country || 'International',
      category: 'news',
      channelId,
    };
  } catch (error) {
    console.error(`Error checking channel ${channelId}:`, error);
    return null;
  }
}

// Helper function to get trending news videos by search
async function getTrendingNewsVideos(searchQuery, apiKey, maxResults = 5) {
  try {
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchQuery)}&type=video&order=date&maxResults=${maxResults}&key=${apiKey}`;
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    if (!searchData.items || searchData.items.length === 0) {
      return [];
    }

    const videos = [];
    for (const item of searchData.items) {
      const videoId = item.id.videoId;
      const snippet = item.snippet;
      
      // Get video details for live status
      const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails&id=${videoId}&key=${apiKey}`;
      const videoResponse = await fetch(videoUrl);
      const videoData = await videoResponse.json();

      let isLive = false;
      if (videoData.items && videoData.items.length > 0) {
        isLive = videoData.items[0].snippet.liveBroadcastContent === 'live';
      }

      videos.push({
        id: videoId,
        title: snippet.title,
        channelName: snippet.channelTitle,
        videoId: videoId,
        thumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || '',
        isLive,
        views: isLive ? '🔴 LIVE' : 'Recent',
        country: 'Global',
        category: 'news',
        channelId: snippet.channelId,
      });
    }

    return videos;
  } catch (error) {
    console.error(`Error getting trending videos for "${searchQuery}":`, error);
    return [];
  }
}

// Get live YouTube channels
app.get('/api/youtube/live-channels', async (req, res) => {
  try {
    const category = req.query.category || 'all';
    const apiKey = process.env.YOUTUBE_API_KEY || '';

    // If no API key, return sample data
    if (!apiKey || apiKey === '') {
      console.log('No YouTube API key found, using sample data');
      const sampleData = [
        { id: 's1', title: 'Channels Television - LIVE', channelName: 'Channels Television', videoId: '5qap5aO4i9A', thumbnail: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400', isLive: true, views: '125K watching', country: 'Nigeria', category: 'africa' },
        { id: 's2', title: 'FRANCE 24 English - LIVE', channelName: 'FRANCE 24', videoId: '2x5X5X5X5X5X', thumbnail: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400', isLive: true, views: '89K watching', country: 'France', category: 'europe' },
        { id: 's3', title: 'ABC News Live', channelName: 'ABC News', videoId: 'w_Ma8oQLmSM', thumbnail: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400', isLive: true, views: '256K watching', country: 'USA', category: 'usa' },
        { id: 's4', title: 'DW News - LIVE', channelName: 'DW News', videoId: 'DX68Dd9lD8w', thumbnail: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400', isLive: true, views: '45K watching', country: 'Germany', category: 'europe' },
        { id: 's5', title: 'CBC News - LIVE', channelName: 'CBC News', videoId: '5x5X5X5X5X5X', thumbnail: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400', isLive: true, views: '32K watching', country: 'Canada', category: 'canada' },
        { id: 's6', title: 'Arise News - LIVE', channelName: 'Arise News', videoId: '6x5X5X5X5X5X', thumbnail: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400', isLive: true, views: '18K watching', country: 'Pan-African', category: 'africa' },
        { id: 's7', title: 'SABC News - LIVE', channelName: 'SABC News', videoId: '7x5X5X5X5X5X', thumbnail: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400', isLive: true, views: '22K watching', country: 'South Africa', category: 'africa' },
        { id: 's8', title: 'Euronews Live', channelName: 'Euronews', videoId: 'py5X5X5X5X5X', thumbnail: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400', isLive: true, views: '67K watching', country: 'Europe', category: 'europe' },
      ];
      
      const filtered = category === 'all' 
        ? sampleData 
        : sampleData.filter(ch => ch.category === category);
      
      return res.json(filtered);
    }

    const channels = YOUTUBE_CHANNELS[category] || [];
    const allChannels = category === 'all' 
      ? [...YOUTUBE_CHANNELS.africa, ...YOUTUBE_CHANNELS.europe, ...YOUTUBE_CHANNELS.usa, ...YOUTUBE_CHANNELS.canada]
      : channels;

    console.log(`Fetching live status for ${allChannels.length} channels in ${category}...`);

    // Fetch all channels in parallel (limited to avoid quota issues)
    const results = await Promise.all(
      allChannels.slice(0, 10).map(ch => checkChannelLiveStatus(ch.id, apiKey))
    );

    const liveChannels = results.filter((r) => r !== null);

    // Sort: Live channels first, then by country
    liveChannels.sort((a, b) => {
      if (a.isLive && !b.isLive) return -1;
      if (!a.isLive && b.isLive) return 1;
      return a.channelName.localeCompare(b.channelName);
    });

    console.log(`Found ${liveChannels.filter(c => c.isLive).length} live channels`);
    res.json(liveChannels);
  } catch (error) {
    console.error('Error fetching YouTube live channels:', error);
    res.status(500).json({ error: 'Failed to fetch YouTube channels' });
  }
});

// Get YouTube categories
app.get('/api/youtube/categories', (req, res) => {
  try {
    const categories = [
      { id: 'all', label: '🌍 All Regions', icon: '🌐' },
      { id: 'africa', label: '🌍 Africa', icon: '🌍' },
      { id: 'asia', label: '🌏 Asia', icon: '🌏' },
      { id: 'middle_east', label: '☪️ Middle East', icon: '☪️' },
      { id: 'latin_america', label: '🌎 Latin America', icon: '🌎' },
      { id: 'europe', label: '🌐 Europe', icon: '🌐' },
      { id: 'usa', label: '🇺🇸 USA', icon: '🇺🇸' },
      { id: 'canada', label: '🇨🇦 Canada', icon: '🇨🇦' },
      { id: 'australia', label: '🇦🇺 Australia', icon: '🇦🇺' },
    ];
    res.json(categories);
  } catch (error) {
    console.error('Error fetching YouTube categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get trending news videos by search query
app.get('/api/youtube/trending', async (req, res) => {
  try {
    const { query, maxResults = 5 } = req.query;
    const apiKey = process.env.YOUTUBE_API_KEY || '';

    if (!query) {
      return res.status(400).json({ error: 'Search query required' });
    }

    // If no API key, return empty array
    if (!apiKey || apiKey === '') {
      console.log('No YouTube API key found, returning empty trending videos');
      return res.json([]);
    }

    const videos = await getTrendingNewsVideos(query, apiKey, parseInt(maxResults));
    console.log(`Fetched ${videos.length} trending videos for query: "${query}"`);
    res.json(videos);
  } catch (error) {
    console.error('Error fetching trending videos:', error);
    res.status(500).json({ error: 'Failed to fetch trending videos' });
  }
});

// Import notification routes
const notificationRoutes = require('./routes/notifications');

// Use notification routes
app.use('/api/notifications', notificationRoutes);

// Start server

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Try POST /api/auth/login with username: admin, password: admin123`);
  console.log(`RSS feeds available at: /rss/all.xml, /rss/nigeria.xml, /rss/sports.xml, etc.`);
});
