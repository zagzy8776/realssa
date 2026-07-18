const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const { Pool } = require('pg');
const dns = require('dns').promises;
const rateLimit = require('express-rate-limit');
const { initRssBot } = require('./services/rssBot');
const { initSportsBot } = require('./services/sportsBot');
const notificationService = require('./services/notificationService');
const { runMigrations } = require('./worker');

// SSRF protection helper
const PRIVATE_IP_RE = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|::1$|fc00:|fd)/;
async function isSafeUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    const { address } = await dns.lookup(u.hostname);
    return !PRIVATE_IP_RE.test(address);
  } catch {
    return false;
  }
}

// XSS escape helper
function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Refuse to boot with a weak/default secret — fail fast instead of silently
// falling back to a publicly-known value.
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set');
}
if (!process.env.CRON_SECRET) {
  throw new Error('CRON_SECRET must be set');
}

// Neon PostgreSQL connection (Articles/Main)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined
});

// Users PostgreSQL connection (falls back to DATABASE_URL if USERS_DATABASE_URL not provided)
const usersDbUrl = process.env.USERS_DATABASE_URL || process.env.DATABASE_URL;
const usersPool = new Pool({
  connectionString: usersDbUrl,
  ssl: usersDbUrl ? { rejectUnauthorized: false } : undefined
});

// Test database connection
if (process.env.DATABASE_URL) {
  pool.query('SELECT NOW()', async (err, res) => {
    if (err) {
      console.error('❌ Database connection failed:', err.message);
    } else {
      console.log('✅ Database connected:', res.rows[0]);

      // Run auto-migrations first so all base tables (rss_articles, live_matches, etc.) exist
      try {
        await runMigrations();
        console.log('✅ Database auto-migrations completed.');
      } catch (migErr) {
        console.error('❌ Startup migrations failed:', migErr.message);
      }

      // Ensure Sports Hub tables exist (matches, followed_matches)
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS matches (
            id SERIAL PRIMARY KEY,
            provider_match_id TEXT UNIQUE NOT NULL,
            competition_name TEXT,
            home_team_name TEXT,
            home_team_crest TEXT,
            away_team_name TEXT,
            away_team_crest TEXT,
            status TEXT,
            minute TEXT,
            home_score INTEGER,
            away_score INTEGER,
            kickoff_at TIMESTAMPTZ,
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
          
          CREATE TABLE IF NOT EXISTS followed_matches (
            id SERIAL PRIMARY KEY,
            device_id TEXT NOT NULL,
            provider_match_id TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(device_id, provider_match_id)
          );
          
          CREATE TABLE IF NOT EXISTS user_article_reactions (
            device_id VARCHAR(255) NOT NULL,
            article_id VARCHAR(255) NOT NULL,
            reaction_type VARCHAR(50) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (device_id, article_id)
          );
        `);
        console.log('✅ Sports Hub tables verified.');
      } catch (err) {
        console.error('❌ Failed to ensure Sports Hub tables:', err.message);
      }

      // Ensure User affinities table exists in usersPool
      try {
        await usersPool.query(`
          CREATE TABLE IF NOT EXISTS user_category_affinities (
            device_id VARCHAR(255) NOT NULL,
            category VARCHAR(100) NOT NULL,
            score INTEGER DEFAULT 0,
            last_interacted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (device_id, category)
          );
          CREATE INDEX IF NOT EXISTS idx_user_category_affinities_device ON user_category_affinities(device_id);
        `);
        console.log('✅ User affinities table verified.');
      } catch (err) {
        console.error('❌ Failed to ensure User affinities table:', err.message);
      }

      // Cleanup and modify rss_articles
      try {
        // Delete Punch news entirely as per user request
        const deletePunchResult = await pool.query(`
          DELETE FROM rss_articles 
          WHERE source_name ~* 'punch' OR external_link ~* 'punchng.com'
        `);
        console.log(`🧹 Database startup check: deleted ${deletePunchResult.rowCount} Punch articles.`);

        // Ensure full_content column exists for the new Extractor Engine
        await pool.query(`ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS full_content TEXT;`);
        console.log('✅ Extractor Engine: ensured full_content column exists.');

        // Clean up logos for the rest
        const logoCleanResult = await pool.query(`
          UPDATE rss_articles 
          SET image = 'https://realssanews.com.ng/logo.png' 
          WHERE image ~* '(logo|icon|brand|placeholder|avatar|favicon)'
             OR image IS NULL
        `);
        console.log(`🧹 Database startup check: set logo images to RealSSA fallback for ${logoCleanResult.rowCount} rows`);
      } catch (dbErr) {
        console.error('❌ Failed to run startup cleanup / modifications:', dbErr.message);
      }

      // Sanitize historical source_name columns by removing verbose boilerplate suffixes
      try {
        const sourceCleanResult = await pool.query(`
          UPDATE rss_articles
          SET source_name = regexp_replace(
            source_name, 
            '\\s*(-\\s*Latest News|\\|\\s*Nigeria''s Most Widely Read Newspaper|-\\s*BBC News|\\s*-\\s*The Cable|\\s*-\\s*Vanguard News|\\s*-\\s*Premium Times).*$', 
            '', 
            'i'
          )
          WHERE source_name ~* 'Latest News|Most Widely Read|BBC News|The Cable|Vanguard News|Premium Times'
        `);
        console.log(`🧹 Database startup check: cleaned source names for ${sourceCleanResult.rowCount} rows`);
      } catch (dbErr) {
        console.error('❌ Failed to run startup source name sanitization:', dbErr.message);
      }

      // Initialize the RSS bot to periodically fetch news
      initRssBot(pool);
      // Initialize the Sports bot to periodically fetch matches
      initSportsBot(pool, notificationService);
    }
  });
}

// Middleware
const cors = require('cors');
const compression = require('compression');
app.use(compression()); // Gzip all responses to make API calls fast

// Allowed origins configuration
const allowedOrigins = [
  'https://realssanews.com.ng',
  'https://www.realssanews.com.ng',
  'https://realssa.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost',
  'https://localhost',
  'capacitor://localhost'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// Rate limiting middleware
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 300, // Limit each IP to 300 requests per 15 minutes
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // Limit each IP to 20 attempts per 15 minutes
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' }
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use(express.json());

// Database file paths
const usersFilePath = path.join(__dirname, 'data', 'users.json');
const articlesFilePath = path.join(__dirname, 'data', 'articles.json');
const commentsFilePath = path.join(__dirname, 'data', 'comments.json');

// Ensure data directory exists (handled gracefully for read-only Vercel environment)
const dataDir = path.join(__dirname, 'data');
try {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
} catch (e) {
  console.warn('Skipping data directory creation (read-only fs):', e.message);
}

// Initialize data files with default content if they don't exist
const initializeDataFiles = () => {
  // Create default users file if it doesn't exist
  if (!fs.existsSync(usersFilePath)) {
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD;
    if (!adminPass) {
      console.warn('⚠️ WARNING: ADMIN_PASSWORD environment variable not set. Using default credentials "admin / admin123". This is insecure in production!');
    }
    const defaultUsers = [
      {
        id: '1',
        username: adminUser,
        password: bcrypt.hashSync(adminPass || 'admin123', 10), // Default password (fallback)
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
        title: 'Welcome to RealSSA News',
        excerpt: 'Discover the latest in African news, culture, sports, and entertainment',
        content: '<p>Welcome to RealSSA News — your premier platform for African news and insights...</p>',
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

try { initializeDataFiles(); } catch (e) { console.warn('initializeDataFiles skipped (read-only fs):', e.message); }

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
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
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

// ── AI Agent Routes ─────────────────────────────────────────────────────
const { initRouter: initAiRouter } = require('./routes/aiAgents');

// AI agent health check
app.get('/api/ai/health', (req, res) => {
  res.json({
    status: 'ok',
    agents: [
      'aiHomepageEditor',
      'aiFeedRepairAgent',
      'aiImageSanityChecker',
      'aiWebSearchAgent',
      'aiNotificationOptimizer',
      'aiInvestigativeAgent',
      'aiEngagementAnalyst',
      'aiContentGapNegotiator',
      'aiMatchEventDetector (existing sportsBot)'
    ],
    gemini_api_key_set: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString()
  });
});

// Mount all AI agent routes under /api/ai
const aiRouter = initAiRouter(pool);
app.use('/api/ai', aiRouter);

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'RealSSA News API Server', status: 'running' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/debug-env', async (req, res) => {
  const { secret } = req.query;
  if (!secret || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return res.json({ status: 'missing', value: null });
  }
  let obfuscated = dbUrl;
  try {
    const url = new URL(dbUrl);
    url.password = '****';
    obfuscated = url.toString();
  } catch (e) {
    obfuscated = `${dbUrl.substring(0, 10)}... (length: ${dbUrl.length})`;
  }

  let poolError = null;
  let poolResult = null;
  try {
    const testRes = await pool.query('SELECT NOW()');
    poolResult = testRes.rows[0];
  } catch (err) {
    poolError = { message: err.message, stack: err.stack };
  }

  let usersPoolError = null;
  let usersPoolResult = null;
  try {
    const testRes = await usersPool.query('SELECT NOW()');
    usersPoolResult = testRes.rows[0];
  } catch (err) {
    usersPoolError = { message: err.message, stack: err.stack };
  }

  res.json({
    status: 'configured',
    obfuscated,
    cronSecretSet: !!process.env.CRON_SECRET,
    usersDbUrlSet: !!process.env.USERS_DATABASE_URL,
    geminiKeySet: !!process.env.GEMINI_API_KEY,
    poolResult,
    poolError,
    usersPoolResult,
    usersPoolError
  });
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

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
    expiresIn: '1h'
  });

  res.json({ token });
});

// Import summarizer for on-demand generation
const { generateSummary, rewriteArticle } = require('./services/summariser');

// Article extraction for Reader Mode
const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');

app.post('/api/extract', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });
  
  // SSRF Protection
  if (!(await isSafeUrl(url))) {
    return res.status(400).json({ error: 'Invalid or unsafe URL' });
  }

  try {
    // Spoffing Googlebot UA to bypass most paywalls and bot-blockers
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
    const html = await response.text();

    // Extract OG / Twitter image for the Reels card hero
    const ogPatterns = [
      /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"'>\s]+)["']/i,
      /<meta[^>]*content=["']([^"'>\s]+)["'][^>]*property=["']og:image["']/i,
      /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"'>\s]+)["']/i,
      /<meta[^>]*property=["']twitter:image["'][^>]*content=["']([^"'>\s]+)["']/i,
    ];
    let ogImage = null;
    for (const pat of ogPatterns) {
      const m = html.match(pat);
      if (m && m[1] && m[1].startsWith('http')) {
        const candidate = m[1];
        const isPunchBrand = candidate.includes('punchng.com') && (candidate.includes('cropped-') || candidate.includes('punch-logo') || candidate.includes('PUNCH-Logo') || candidate.includes('logo'));
        if (!isPunchBrand) {
          ogImage = candidate;
          break;
        }
      }
    }

    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    let article = reader.parse();
    
    // If readability fails or returns empty, try DB fallback before failing
    if (!article || !article.textContent || article.textContent.trim().length < 100) {
      if (process.env.DATABASE_URL) {
        try {
          const dbRes = await pool.query(
            "SELECT title, COALESCE(ai_summary, original_excerpt) AS content, original_excerpt, ai_summary, source_name, image FROM rss_articles WHERE external_link = $1 LIMIT 1",
            [url]
          );
          if (dbRes.rows.length > 0) {
            const row = dbRes.rows[0];
            console.log(`✅ DB fallback match in extraction for: "${row.title}"`);
            return res.json({
              title: row.title,
              content: row.content || "No summary available for this article.",
              textContent: row.content || "",
              length: (row.content || "").length,
              excerpt: row.original_excerpt || row.ai_summary || "",
              byline: row.source_name || "RealSSA News Desk",
              siteName: row.source_name || "RealSSA",
              image: row.image || ogImage
            });
          }
        } catch (dbErr) {
          console.error('Failed to query DB fallback:', dbErr.message);
        }
      }
      if (!article) {
        return res.status(422).json({ error: 'Could not extract article' });
      }
    }

    // AI Rewriting Engine!
    if (article.textContent && article.textContent.length > 200) {
      console.log(`⚡ Generating AI Original Report for extracted article: "${article.title}"`);
      try {
        const rewrittenHtml = await rewriteArticle(article.title, article.textContent);
        if (rewrittenHtml) {
          article.content = rewrittenHtml;
          article.byline = 'RealSSA News Desk'; // claim it as original
          console.log(`✅ AI Original Report generated successfully!`);
        }
      } catch (rewriteError) {
        console.error(`❌ Failed to rewrite extracted article:`, rewriteError.message);
      }
    }

    res.json({ ...article, image: ogImage });
  } catch (err) {
    console.error('Extract error, checking DB fallback...', err.message);
    if (process.env.DATABASE_URL) {
      try {
        const dbRes = await pool.query(
          "SELECT title, COALESCE(ai_summary, original_excerpt) AS content, original_excerpt, ai_summary, source_name, image FROM rss_articles WHERE external_link = $1 LIMIT 1",
          [url]
        );
        if (dbRes.rows.length > 0) {
          const row = dbRes.rows[0];
          console.log(`✅ DB fallback recovery in extraction for: "${row.title}"`);
          return res.json({
            title: row.title,
            content: row.content || "No summary available for this article.",
            textContent: row.content || "",
            length: (row.content || "").length,
            excerpt: row.original_excerpt || row.ai_summary || "",
            byline: row.source_name || "RealSSA News Desk",
            siteName: row.source_name || "RealSSA",
            image: row.image
          });
        }
      } catch (dbErr) {
        console.error('Failed to query DB fallback in catch:', dbErr.message);
      }
    }
    res.status(500).json({ error: 'Extraction failed', message: err.message });
  }
});

// GET Daily Digest package (Top 20 cached offline articles under 200KB)
app.get('/api/digest/daily', async (req, res) => {
  const digestPath = path.join(__dirname, 'data', 'daily_digest.json');
  if (fs.existsSync(digestPath)) {
    try {
      const data = fs.readFileSync(digestPath, 'utf8');
      return res.json(JSON.parse(data));
    } catch (err) {
      console.error('Failed to read daily digest cache:', err.message);
    }
  }

  // Fallback: compile on-demand if database exists
  if (process.env.DATABASE_URL) {
    try {
      const result = await pool.query(
        `SELECT 'rss-' || id as id,
                title,
                COALESCE(ai_summary, original_excerpt) AS excerpt,
                category,
                image,
                published_at as date,
                source_name as author
         FROM rss_articles
         WHERE image IS NOT NULL AND image != ''
         ORDER BY published_at DESC
         LIMIT 20`
      );

      const digestArticles = result.rows.map(row => {
        let elegantExcerpt = '';
        if (row.excerpt) {
          const rawExcerpt = row.excerpt.trim();
          if (rawExcerpt.length <= 140) {
            elegantExcerpt = rawExcerpt;
          } else {
            const sliced = rawExcerpt.slice(0, 140);
            const lastSpace = sliced.lastIndexOf(' ');
            elegantExcerpt = lastSpace > 0 ? sliced.slice(0, lastSpace).trim() + '...' : sliced + '...';
          }
        }
        return {
          id: row.id,
          title: row.title,
          excerpt: elegantExcerpt,
          category: row.category,
          image: row.image,
          date: row.date,
          author: row.author
        };
      });

      // Cache it
      fs.writeFileSync(digestPath, JSON.stringify(digestArticles, null, 2));
      return res.json(digestArticles);
    } catch (dbErr) {
      console.error('Failed to run on-demand digest compile:', dbErr.message);
    }
  }

  res.status(404).json({ error: 'Daily digest unavailable' });
});

// Ingest client-side errors and insert into queryable database
app.post('/api/client-error', async (req, res) => {
  const { deviceId, message, stack, componentName } = req.body;
  if (!message) return res.status(400).json({ error: 'error message required' });

  if (process.env.DATABASE_URL) {
    try {
      await usersPool.query(`
          INSERT INTO client_errors (device_id, message, stack, component_name)
          VALUES ($1, $2, $3, $4)
        `, [deviceId || null, message, stack || null, componentName || 'Unknown']);
      return res.json({ success: true });
    } catch (err) {
      console.error('Failed to log client error to DB:', err.message);
      return res.status(500).json({ error: 'Database logging failed' });
    }
  }

  console.log(`[Client Crash Log] deviceId: ${deviceId} | msg: ${message} | comp: ${componentName}`);
  res.json({ success: true, message: 'Logged to standard output' });
});

let affinitiesTableVerified = false;

app.post('/api/profile/sync', async (req, res) => {
  const { deviceId, counts } = req.body;
  if (!deviceId || !counts) return res.status(400).json({ error: 'deviceId and counts required' });

  if (process.env.DATABASE_URL) {
    try {
      // Ensure User affinities table exists in usersPool within request lifecycle (Serverless-safe)
      if (!affinitiesTableVerified) {
        await usersPool.query(`
          CREATE TABLE IF NOT EXISTS user_category_affinities (
            device_id VARCHAR(255) NOT NULL,
            category VARCHAR(100) NOT NULL,
            score INTEGER DEFAULT 0,
            last_interacted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (device_id, category)
          );
          CREATE INDEX IF NOT EXISTS idx_user_category_affinities_device ON user_category_affinities(device_id);
        `);
        affinitiesTableVerified = true;
        console.log('✅ User affinities table verified inline.');
      }

      for (const [category, score] of Object.entries(counts)) {
        // Upsert engagement score (starts at 1 if not exists, caps around 50 later to prevent runaway scaling)
        await usersPool.query(
          `INSERT INTO user_category_affinities (device_id, category, score, last_interacted_at)
           VALUES ($1, $2, $3, NOW())
          ON CONFLICT (device_id, category) 
          DO UPDATE SET score = EXCLUDED.score, last_interacted_at = NOW()
        `, [deviceId, category, score]);
      }
      return res.json({ success: true });
    } catch (err) {
      console.error('Failed to sync affinities:', err.message);
      return res.status(500).json({ error: 'Failed to sync affinities' });
    }
  }
  res.json({ success: true, message: 'No DB configured' });
});

// Get all articles (combines JSON files + Neon database)
app.get('/api/articles', async (req, res) => {
  try {
    const deviceId = req.query.deviceId ? String(req.query.deviceId) : null;

    // Get articles from JSON files (admin-posted)
    const jsonArticles = readJsonFile(articlesFilePath);

    // Get RSS articles from Neon database
    let rssArticles = [];
    if (process.env.DATABASE_URL) {
      try {
        let affinitiesMap = {};

        if (deviceId) {
          try {
            const userRes = await usersPool.query(
              'SELECT category, score FROM user_category_affinities WHERE device_id = $1',
              [deviceId]
            );
            userRes.rows.forEach(r => { affinitiesMap[r.category] = r.score; });
          } catch (err) {
            console.error('Failed to fetch user affinities:', err.message);
          }
        }

        const queryStr = `
          SELECT 
            'rss-' || id as id,
            id as db_id,
            title,
            original_excerpt as excerpt,
            ai_summary,
            category,
            image,
            author,
            source_name,
            external_link,
            published_at as date,
            content_type,
            '5 min read' as read_time
          FROM rss_articles 
          WHERE published_at > NOW() - INTERVAL '7 days'
        `;

        const result = await pool.query(queryStr);
        let articlesData = result.rows;

        // In-memory personalization and sorting
        if (deviceId && Object.keys(affinitiesMap).length > 0) {
          const now = Date.now();
          articlesData.forEach(a => {
            const uScore = affinitiesMap[a.category] || 0;
            const hoursDiff = (now - new Date(a.date).getTime()) / 3600000;
            // Enhanced Personalized Ranking Logic
            const timeDecay = 1.0 / Math.pow((1.0 + Math.max(hoursDiff, 0)), 0.5);
            a.personalized_score = (uScore * 0.4) + (timeDecay * 6.0);
          });
          articlesData.sort((a, b) => b.personalized_score - a.personalized_score || new Date(b.date) - new Date(a.date));
        } else {
          articlesData.sort((a, b) => new Date(b.date) - new Date(a.date));
        }

        // Apply LIMIT 100
        articlesData = articlesData.slice(0, 100);

        rssArticles = articlesData.map(row => ({
          id: row.id,
          dbId: row.db_id,
          title: row.title,
          excerpt: row.ai_summary || row.excerpt,
          content: row.ai_summary || row.excerpt,
          category: row.category || 'news',
          image: row.image,
          readTime: row.read_time,
          author: row.author,
          source: 'rss',
          externalLink: row.external_link,
          date: row.date,
          contentType: row.content_type || 'article',
          status: 'published',
          featured: false,
          ai_summary: row.ai_summary,
          needsSummary: !row.ai_summary && row.content_type === 'article'
        }));
      } catch (dbError) {
        console.warn('DB query failed, using JSON only:', dbError.message);
      }
    }

    // Combine and return
    const allArticles = [...jsonArticles, ...rssArticles];
    res.json(allArticles);
  } catch (error) {
    console.error('Error fetching articles:', error);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

// Get featured articles - combines internal articles with World news
// MUST be defined BEFORE /api/articles/:id to prevent Express from matching "featured" as an ID
app.get('/api/articles/featured', async (req, res) => {
  try {
    // 1. Get RSS articles from Neon database as featured
    let rssArticles = [];
    if (process.env.DATABASE_URL) {
      try {
        const result = await pool.query(
          `SELECT 
            'rss-' || id as id,
            id as db_id,
            title,
            original_excerpt as excerpt,
            ai_summary,
            category,
            image,
            author,
            source_name,
            external_link,
            published_at as date,
            content_type,
            '5 min read' as read_time
           FROM rss_articles 
           WHERE image IS NOT NULL AND image != ''
           ORDER BY published_at DESC 
           LIMIT 10`
        );
        rssArticles = result.rows.map(row => ({
          id: row.id,
          title: row.title,
          excerpt: row.ai_summary || row.excerpt,
          category: row.category || 'news',
          image: row.image,
          readTime: row.read_time,
          author: row.author,
          source: 'rss',
          externalLink: row.external_link,
          date: row.date,
          contentType: row.content_type || 'article',
          featured: true
        }));
      } catch (dbError) {
        console.warn('DB query for featured failed:', dbError.message);
      }
    }

    let featuredArticles = rssArticles;

    // 2. Also try to get JSON file articles (admin-posted)
    const jsonArticles = readJsonFile(articlesFilePath);
    const adminArticles = jsonArticles.slice(0, 5).map(a => ({ ...a, featured: true }));
    featuredArticles = [...adminArticles, ...featuredArticles];

    // 3. If we have fewer than 8 articles, supplement from BBC RSS
    if (featuredArticles.length < 8) {
      try {
        const parser = new Parser();
        const res = await fetch('http://feeds.bbci.co.uk/news/world/rss.xml', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        if (!res.ok) throw new Error(`Status code ${res.status}`);
        const xmlText = await res.text();
        const sanitizedXml = xmlText.replace(/&(?!amp;|lt;|gt;|quot;|#39;)/g, '&amp;');
        const worldFeed = await parser.parseString(sanitizedXml);
        const worldStories = worldFeed.items.slice(0, 5).map(item => ({
          id: 'world-' + (item.guid || item.link || Math.random().toString(36).substr(2, 9)),
          title: item.title,
          excerpt: item.contentSnippet || item.summary || item.title,
          category: 'World News',
          image: extractImageFromItem(item),
          readTime: '5 min read',
          author: 'BBC News',
          source: 'rss',
          externalLink: item.link,
          date: item.pubDate || new Date().toISOString(),
          contentType: 'article',
          featured: true
        }));
        featuredArticles = [...featuredArticles, ...worldStories];
      } catch (rssError) {
        console.error('Error fetching World news for featured:', rssError.message);
      }
    }

    // Limit to 10 featured articles
    featuredArticles = featuredArticles.slice(0, 10);

    res.json(featuredArticles);
  } catch (error) {
    console.error('Error fetching featured articles:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Trending articles — DB-first (most recent from all categories, mixed)
// MUST be defined BEFORE /api/articles/:id to prevent Express from matching "trending" as an ID
app.get('/api/articles/trending', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 15);
    const offset = (page - 1) * limit;
    const preferred = req.query.preferred ? String(req.query.preferred).split(',').map(s => s.trim().toLowerCase()) : [];
    const categoryFilter = req.query.category ? String(req.query.category).trim().toLowerCase() : null;
    const useDiverse = req.query.diverse === 'true';

    let excludeList = [];
    if (req.query.exclude) {
      excludeList = String(req.query.exclude).split(',').map(id => id.trim()).filter(Boolean);
    }

    if (process.env.DATABASE_URL) {
      // Build ORDER BY: preferred categories first, then by recency
      let orderBy = 'published_at DESC';
      if (preferred.length > 0) {
        const caseStr = preferred.map((cat, i) => `WHEN LOWER(category) = '${cat.replace(/'/g, "''")}' THEN ${i}`).join(' ');
        orderBy = `CASE ${caseStr} ELSE ${preferred.length} END, published_at DESC`;
      }

      let excludeClause = '';
      let queryParams = [limit, offset];

      if (excludeList.length > 0) {
        const placeholders = excludeList.map((_, i) => `$${3 + i}`).join(', ');
        excludeClause = `AND 'rss-' || id NOT IN (${placeholders})`;
        queryParams.push(...excludeList);
      }

      let categoryClause = '';
      if (categoryFilter) {
        queryParams.push(categoryFilter);
        categoryClause = `AND LOWER(category) = $${queryParams.length}`;
      }

      let queryText = '';
      if (useDiverse) {
        queryText = `
          SELECT * FROM (
            SELECT 'rss-' || id AS id,
                   title,
                   COALESCE(ai_summary, original_excerpt) AS excerpt,
                   category, image, source_name AS author,
                   external_link, published_at AS date, content_type,
                   '5 min read' AS read_time,
                   published_at,
                   ROW_NUMBER() OVER (PARTITION BY source_name ORDER BY published_at DESC) AS rn
            FROM rss_articles
            WHERE image IS NOT NULL AND image != '' ${excludeClause} ${categoryClause}
          ) t
          WHERE t.rn <= 2
          ORDER BY ${orderBy}
          LIMIT $1 OFFSET $2
        `;
      } else {
        queryText = `
          SELECT 'rss-' || id AS id,
                 title,
                 COALESCE(ai_summary, original_excerpt) AS excerpt,
                 category, image, source_name AS author,
                 external_link, published_at AS date, content_type,
                 '5 min read' AS read_time
          FROM rss_articles
          WHERE image IS NOT NULL AND image != '' ${excludeClause} ${categoryClause}
          ORDER BY ${orderBy}
          LIMIT $1 OFFSET $2
        `;
      }

      const dbResult = await pool.query(queryText, queryParams);
      if (page === 1 && dbResult.rows.length < 5) {
        // Fallback to live RSS only on first page when DB is empty
        console.log('Trending: DB empty, falling back to live RSS...');
      } else {
        return res.json(dbResult.rows.map(r => ({
          id: r.id, title: r.title, excerpt: r.excerpt,
          category: r.category, image: r.image, author: r.author,
          externalLink: r.external_link, date: r.date,
          contentType: r.content_type, readTime: r.read_time, source: 'rss'
        })));
      }
    }

    // Fallback: live RSS scraping (only if DB is empty on first page)
    console.log('Trending: DB empty, falling back to live RSS...');
    const [nigeria, world, sports, ghana] = await Promise.all([
      fetchRSSFeeds(nigerianFeeds.slice(0, 2)),
      fetchRSSFeeds(worldFeeds.slice(0, 2)),
      fetchRSSFeeds(sportsFeeds.slice(0, 1)),
      fetchRSSFeeds(ghanaFeeds.slice(0, 1))
    ]);
    let trending = [...nigeria, ...world, ...sports, ...ghana];
    if (excludeList.length > 0) {
      trending = trending.filter(a => !excludeList.includes(a.id));
    }
    trending = trending
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
    res.json(trending);
  } catch (error) {
    console.error('Error fetching trending articles:', error);
    res.status(500).json({ error: 'Failed to fetch trending articles' });
  }
});


// GET /api/articles/most-read — MUST be before /api/articles/:id
app.get('/api/articles/most-read', async (req, res) => {
  try {
    if (!process.env.DATABASE_URL) return res.json([]);
    const result = await pool.query(
      `SELECT 'rss-' || id as id, title, image, category, external_link,
              published_at as date, source_name as author, view_count,
              original_excerpt as excerpt, '3 min read' as read_time
       FROM rss_articles
       WHERE image IS NOT NULL AND image != ''
         AND published_at > NOW() - INTERVAL '7 days'
       ORDER BY view_count DESC NULLS LAST
       LIMIT 10`
    );
    res.json(result.rows.map(r => ({
      ...r,
      externalLink: r.external_link,
      readTime: r.read_time,
      views: r.view_count || 0
    })));
  } catch (err) {
    console.error('Most read error:', err.message);
    res.json([]);
  }
});

// Get single article by ID (supports both JSON and RSS articles)
// WITH ON-DEMAND AI SUMMARY GENERATION
// Increment view/dwell tracking for an article
app.post('/api/articles/:id/view', async (req, res) => {
  try {
    const rawId = req.params.id;
    const dbId = rawId.startsWith('rss-') ? rawId.replace('rss-', '') : rawId;
    if (process.env.DATABASE_URL) {
      await pool.query(
        'UPDATE rss_articles SET view_count = COALESCE(view_count, 0) + 1 WHERE id = $1',
        [dbId]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update view count' });
  }
});

app.get('/api/articles/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if it's an RSS article (id starts with 'rss-')
    if (id.startsWith('rss-')) {
      if (!process.env.DATABASE_URL) {
        return res.status(404).json({ error: 'Article not found' });
      }

      const articleId = id.replace('rss-', '');
      const result = await pool.query(
        `SELECT 
          'rss-' || id as id,
          id as db_id,
          title,
          original_excerpt as excerpt,
          ai_summary,
          category,
          image,
          author,
          source_name,
          external_link,
          published_at as date,
          content_type,
          '5 min read' as read_time
         FROM rss_articles 
         WHERE id = $1`,
        [articleId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Article not found' });
      }

      const row = result.rows[0];

      // 🚀 ON-DEMAND AI SUMMARY GENERATION
      let aiSummary = row.ai_summary;
      if (!aiSummary && row.content_type === 'article' && row.excerpt) {
        console.log(`⚡ Generating AI summary for article ${articleId}: "${row.title}"`);
        try {
          aiSummary = await generateSummary(row.title, row.excerpt);
          if (aiSummary) {
            // Save to database for future requests
            await pool.query(
              'UPDATE rss_articles SET ai_summary = $1 WHERE id = $2',
              [aiSummary, articleId]
            );
            // Decay scores by 50% for all categories associated with this device
            // (Assuming device_id passed via header or query for personalized interaction)
            const deviceId = req.headers['x-device-id'];
            if (deviceId) {
              await usersPool.query(
                `UPDATE user_category_affinities 
                 SET score = GREATEST(score * 0.5, 0.1) 
                 WHERE device_id = $1`,
                [deviceId]
              );
            }
            console.log(`✅ AI summary generated and cached for article ${articleId}`);
          }
        } catch (summaryError) {
          console.error(`❌ Failed to generate summary for article ${articleId}:`, summaryError.message);
          // Continue without AI summary - use original excerpt
        }
      }

      const article = {
        id: row.id,
        title: row.title,
        excerpt: aiSummary || row.excerpt,
        content: aiSummary || row.excerpt,
        category: row.category || 'news',
        image: row.image,  // Image guaranteed from ingestion
        readTime: row.read_time,
        author: row.author,
        source: 'rss',
        externalLink: row.external_link,
        date: row.date,
        contentType: row.content_type || 'article',
        status: 'published',
        featured: false,
        ai_summary: aiSummary
      };

      return res.json(article);
    }

    // JSON file article
    const articles = readJsonFile(articlesFilePath);
    const article = articles.find(a => a.id === id || a.id.toString() === id);

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json(article);
  } catch (error) {
    console.error('Error fetching article:', error);
    res.status(500).json({ error: 'Failed to fetch article' });
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
    image: req.body.image || '',

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
      ['enclosure', 'enclosure'],
      ['content:encoded', 'content:encoded'],
      ['description', 'description']
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
  'https://www.tribuneonlineng.com/feed/',
  'https://businessday.ng/feed/',
  'https://nairametrics.com/rss',
  'https://infoguidenigeria.com/rss',
  'https://pmnewsnigeria.com/rss',
  'https://asorock.com/rss',
  'https://thenigerianvoice.com/rss'
];

// Ghana News RSS feeds
const ghanaFeeds = [
  'https://www.graphic.com.gh/rss.xml',
  'https://www.ghanaweb.com/GhanaHomePage/rss.xml',
  'https://www.myjoyonline.com/feed/',
  'https://www.citi.com.gh/feed/',
  'https://www.ghanatodaynews.com/feed/',
  'https://www.yen.com.gh/feed/',
  'https://www.ghanaweb.com/GhanaHomePage/NewsArchive/rss.xml',
  'https://oneclickghana.com/feed',
  'https://peacefmonline.com/feed',
  'https://citinewsroom.com/feed',
  'https://www.ghanatv.com.gh/feed/',
  'https://www.ghananewsagency.org/feed/',
  'https://www.ghanatoday.com/feed/'
];

// Kenya News RSS feeds
const kenyaFeeds = [
  'https://www.nation.co.ke/rss.xml',
  'https://www.standardmedia.co.ke/rss/kenya.php',
  'https://www.the-star.co.ke/rss.xml',
  'https://www.capitalfm.co.ke/feed/',
  'https://www.capitalfm.co.ke/news/feed/',
  'https://www.kenyanews.go.ke/feed/',
  'https://nairobiwire.com/feed/',
  'https://www.kenyans.co.ke/feed/',
  'https://www.kenyans.co.ke/feeds/news',
  'https://citizentv.co.ke/feed',
  'https://www.tuko.co.ke/feed/',
  'https://www.pulselive.co.ke/feed/',
  'https://www.k24tv.co.ke/feed/'
];

// South Africa News RSS feeds
const southAfricaFeeds = [
  'https://www.news24.com/rss.xml',
  'https://www.iol.co.za/rss.xml',
  'https://iol.co.za/rss',
  'https://www.timeslive.co.za/rss.xml',
  'https://www.sowetanlive.co.za/rss.xml',
  'https://www.dispatchlive.co.za/rss.xml',
  'https://www.heraldlive.co.za/rss.xml',
  'https://mg.co.za/rss',
  'https://www.citizen.co.za/rss.xml',
  'https://www.citizen.co.za/feed',
  'https://www.dailymaverick.co.za/rss.xml',
  'https://www.dailymaverick.co.za/dmrss',
  'https://www.enca.com/rss.xml',
  'https://www.sabcnews.com/sabcnews/feed/'
];

// UK News RSS feeds
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

// Sports News RSS feeds
const sportsFeeds = [
  'https://allafrica.com/tools/headlines/rdf/sport/headlines.rdf',
  'https://allafrica.com/tools/headlines/rdf/soccer/headlines.rdf',
  'https://allafrica.com/tools/headlines/rdf/athletics/headlines.rdf',
  'https://www.completesports.com/feed',
  'https://soccernet.ng/feed',
  'https://allnigeriasoccer.com/feed',
  'https://gormahia.com/feed',
  'https://africatopsports.com/feed',
  'https://supersport.com/rss',
  'https://ghanasoccernet.com/feed',
  'https://ghanasoccernet.com/rss',
  'https://thenff.com/feed',
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

// USA News RSS feeds
const usaFeeds = [
  'http://rss.cnn.com/rss/edition.rss',
  'https://feeds.nytimes.com/nyt/rss/HomePage',
  'https://www.washingtonpost.com/rss/',
  'https://www.usatoday.com/rss/',
  'https://feeds.foxnews.com/foxnews/latest',
];

// Crypto News RSS feeds
const cryptoFeeds = [
  'https://cointelegraph.com/rss',
  'https://decrypt.co/feed'
];

const cultureFeeds = [
  'https://www.bellanaija.com/nollywood/feed',
  'https://kemifilani.ng/feed',
  'https://fakaza.com/feed/rss',
  'https://okayafrica.com/feed/',
  'https://www.essence.com/feed/',
  'https://www.rollingstone.com/feed/',
  'https://www.bellanaija.com/feed',
  'https://notjustok.com/feed',
  'https://tooxclusive.com/feed',
  'https://mp3bullet.ng/feed',
  'https://afrobeatsintelligence.substack.com/feed',
  'https://nollycritic.com/feed',
  'https://realnollywood.com/feed',
  'https://novice2star.com/feed',
  'https://aipate.com/feed',
  'https://nollywire.com/feed',
  'https://unorthodoxreviews.com/feed',
  'https://musicinafrica.net/feed',
  'https://groove-africa.com/feed',
  'https://musicarenagh.com/feed',
  'https://zambianmusicblog.co/rss'
];

const entertainmentFeeds = [
  'https://variety.com/feed/',
  'https://deadline.com/feed/',
  'https://www.pulse.ng/entertainment/rss'
];

const jobsFeeds = [
  'https://weworkremotely.com/remote-jobs.rss',
  'https://reliefweb.int/jobs/rss.xml',
  'https://remoteok.com/remote-jobs.rss'
];

const techFeeds = [
  'https://techsoma.africa/feed',
  'https://fintechnews.africa/feed',
  'https://siliconcanals.com/feed',
  'https://techcabal.com/feed',
  'https://techpoint.africa/feed',
  'https://techcrunch.com/feed/',
  'https://www.wired.com/feed/rss',
  'https://www.theverge.com/rss/index.xml',
  'https://www.cnet.com/rss/news/',
  'https://feeds.arstechnica.com/arstechnica/index',
  'https://www.techradar.com/feeds.xml'
];

const businessFeeds = [
  'https://www.africanews.com/feed/rss?themes=business',
  'https://rss.punchng.com/v1/category/business',
  'https://howwemadeitinafrica.com/feed',
  'https://addisfortune.net/rss',
  'https://www.cnbc.com/id/10001147/device/rss/rss.html',
  'https://www.ft.com/rss/home/international',
  'https://feeds.content.dowjones.io/public/rss/WSJcomUSBusiness',
  'https://feeds.bbci.co.uk/news/business/rss.xml',
  'https://feeds.npr.org/1006/rss.xml',
  'https://financialpost.com/category/news/economy/feed.xml'
];

const scienceFeeds = [
  'https://www.nature.com/nature.rss',
  'https://www.sciencenews.org/feed',
  'https://scitechdaily.com/feed/',
  'https://www.sciencedaily.com/rss/all.xml',
  'https://earth.org/feed/',
  'https://www.news-medical.net/syndication.axd?format=rss'
];

const lifestyleFeeds = [
  'https://wwd.com/fashion-news/feed/',
  'https://www.theguardian.com/fashion/rss',
  'https://www.elle.com/rss/default.xml',
  'https://www.vogue.com/feed/rss',
  'https://hollywoodlife.com/feed/',
  'https://www.eater.com/rss/index.xml',
  'https://nypost.com/celebrities/feed/'
];

// USA News RSS feeds (continued)
const usaFeedsRemaining = [
  'https://www.npr.org/rss/rss.php?id=1001',
  'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml',
  'https://www.latimes.com/rss.xml',
  'https://www.chicagotribune.com/rss.xml',
  'https://www.wsj.com/xml/rss/3_7085.xml'
];



// World News RSS feeds
const worldFeeds = [
  'https://africa.com/feed',
  'https://asia.nikkei.com/rss/feed/nar',
  'https://asiatimes.com/feed',
  'https://thediplomat.com/feed',
  'https://asianews.network/feed',
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

// Helper function to extract image from RSS item - IMPROVED VERSION
const extractImageFromItem = (item) => {
  // Try different image sources in order of preference

  // 1. Check for media:content with url attribute
  if (item['media:content'] && item['media:content'].$ && item['media:content'].$.url) {
    return item['media:content'].$.url;
  }

  // 2. Check for media:thumbnail
  if (item['media:thumbnail'] && item['media:thumbnail'].$ && item['media:thumbnail'].$.url) {
    return item['media:thumbnail'].$.url;
  }

  // 3. Check for enclosure (common in podcasts and some news feeds)
  if (item.enclosure && item.enclosure.url) {
    return item.enclosure.url;
  }

  // 4. Check for enclosure as array
  if (item.enclosure && Array.isArray(item.enclosure) && item.enclosure[0] && item.enclosure[0].url) {
    return item.enclosure[0].url;
  }

  // 5. Extract from content:encoded if available (WordPress feeds)
  if (item['content:encoded']) {
    const imgMatch = item['content:encoded'].match(/<img[^>]+src=["']([^"'>]+)["']/i);
    if (imgMatch && imgMatch[1]) {
      // Make sure it's an absolute URL
      if (imgMatch[1].startsWith('http')) {
        return imgMatch[1];
      }
    }
  }

  // 6. Extract from description/summary if available
  if (item.description || item.summary || item.contentSnippet) {
    const content = item.description || item.summary || item.contentSnippet;
    const imgMatch = content.match(/<img[^>]+src=["']([^"'>]+)["']/i);
    if (imgMatch && imgMatch[1]) {
      if (imgMatch[1].startsWith('http')) {
        return imgMatch[1];
      }
    }
  }

  // 7. Extract from content if available
  if (item.content) {
    const imgMatch = item.content.match(/<img[^>]+src=["']([^"'>]+)["']/i);
    if (imgMatch && imgMatch[1]) {
      if (imgMatch[1].startsWith('http')) {
        return imgMatch[1];
      }
    }
  }

  // 8. Check for itunes:image (podcast feeds)
  if (item['itunes:image'] && item['itunes:image'].href) {
    return item['itunes:image'].href;
  }

  return null;
};

// Helper function to fetch RSS feeds
const fetchRSSFeeds = async (feeds) => {
  const allArticles = [];
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

  for (const feedUrl of feeds) {
    try {
      console.log(`Fetching RSS feed: ${feedUrl}`);
      // Enforce a strict 15-second timeout using fetch timeout signal
      const res = await fetch(feedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*'
        },
        signal: AbortSignal.timeout(15000)
      });
      if (!res.ok) throw new Error(`Status code ${res.status}`);
      const xmlText = await res.text();
      const sanitizedXml = xmlText.replace(/&(?!amp;|lt;|gt;|quot;|#39;)/g, '&amp;');
      const feed = await parser.parseString(sanitizedXml);

      feed.items.forEach(item => {
        const article = {
          id: item.guid || item.link || Math.random().toString(36).substr(2, 9),
          title: item.title || 'No title',
          excerpt: item.contentSnippet || item.summary || item.title || 'No content',
          content: item.content || item.summary || item.contentSnippet || '',
          category: 'news',
          image: extractImageFromItem(item, feedUrl),
          readTime: '5 min read',
          author: feed.title || 'Unknown Source',
          source: 'rss',
          externalLink: item.link,
          date: item.pubDate || new Date().toISOString(),
          contentType: 'article',
          status: 'published',
          featured: false
        };
        if (!article.image) return;
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

// ─── HELPER: DB-first news fetcher (instant from Neon DB, live RSS fallback) ───
// This prevents timeout errors on Android
const makeDbFirstRoute = (category, feedList, dbCategory) => async (req, res) => {
  const cat = dbCategory || category;
  try {
    // Enable CDN and browser caching with stale-while-revalidate for speed
    res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=30, stale-while-revalidate=30');

    // 1. Get matching admin-posted articles from JSON (the local "news wire")
    const jsonArticles = readJsonFile(articlesFilePath) || [];
    const cats = Array.isArray(cat) ? cat : [cat];
    const catsLower = cats.map(c => c.toLowerCase());

    let matchingJson = jsonArticles.filter(a =>
      catsLower.includes((a.category || '').toLowerCase())
    ).map(a => ({
      ...a,
      source: 'admin'
    }));

    // Parse exclude list
    let excludeList = [];
    if (req.query.exclude) {
      excludeList = String(req.query.exclude).split(',').map(id => id.trim()).filter(Boolean);
    }

    if (excludeList.length > 0) {
      matchingJson = matchingJson.filter(a => !excludeList.includes(a.id));
    }

    // 2. Try DB first (returns in <500ms)
    if (process.env.DATABASE_URL) {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const offset = (page - 1) * limit;

      const catPlaceholders = cats.map((_, i) => `$${i + 1}`).join(', ');

      let excludeClause = '';
      let queryParams = [...cats];
      if (excludeList.length > 0) {
        const placeholders = excludeList.map((_, i) => `$${cats.length + i + 1}`).join(', ');
        excludeClause = `AND 'rss-' || id NOT IN (${placeholders})`;
        queryParams.push(...excludeList);
      }

      const countResult = await pool.query(
        `SELECT COUNT(*) FROM rss_articles WHERE category IN (${catPlaceholders}) ${excludeClause}`,
        queryParams
      );
      const total = parseInt(countResult.rows[0].count, 10);

      if (total >= 5) {
        const limitParamIndex = queryParams.length + 1;
        const offsetParamIndex = queryParams.length + 2;

        const dbResult = await pool.query(
          `SELECT 'rss-' || id AS id,
                  title,
                  COALESCE(ai_summary, original_excerpt) AS excerpt,
                  category, image, source_name AS author,
                  external_link, published_at AS date, content_type,
                  is_featured, '5 min read' AS read_time
           FROM rss_articles
           WHERE category IN (${catPlaceholders}) ${excludeClause}
           ORDER BY published_at DESC
           LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`,
          [...queryParams, limit, offset]
        );
        const rssArticles = dbResult.rows.map(r => ({
          id: r.id, title: r.title, excerpt: r.excerpt,
          category: r.category, image: r.image, author: r.author,
          externalLink: r.external_link, date: r.date,
          contentType: r.content_type, readTime: r.read_time,
          isFeatured: r.is_featured, source: 'rss'
        }));

        const adminArticles = page === 1 ? matchingJson : [];
        const combined = [...adminArticles, ...rssArticles];
        // Sort by date descending
        combined.sort((a, b) => new Date(b.date || b.published_at).getTime() - new Date(a.date || a.published_at).getTime());

        // Paginate in memory
        const paginated = combined.slice(0, limit);

        if (req.query.paginated === 'true') {
          return res.json({
            articles: paginated,
            pagination: {
              currentPage: page,
              totalPages: Math.ceil(combined.length / limit),
              totalItems: combined.length,
              itemsPerPage: limit
            }
          });
        }
        return res.json(paginated);
      }
    }

    // 3. Fallback: live RSS scraping (only if DB is empty)
    console.log(`DB empty for [${cat}], falling back to live RSS (fetching max 3 feeds)...`);
    const liveArticles = await fetchRSSFeeds(feedList.slice(0, 3));
    let combined = [...matchingJson, ...liveArticles];
    if (excludeList.length > 0) {
      combined = combined.filter(a => !excludeList.includes(a.id));
    }
    combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (req.query.paginated === 'true') {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const slice = combined.slice((page - 1) * limit, page * limit);
      return res.json({
        articles: slice,
        pagination: { currentPage: page, totalPages: Math.ceil(combined.length / limit), totalItems: combined.length, itemsPerPage: limit }
      });
    }
    res.json(combined);
  } catch (error) {
    console.error(`Error fetching [${cat}] news:`, error.message);
    res.status(500).json({ error: `Failed to fetch ${category} news` });
  }
};

// ==========================================
// SPORTS LIVESCORE HUB API
// ==========================================

// Get today's matches
app.get('/api/sports/matches', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM (
        SELECT 
          provider_match_id,
          competition_name,
          home_team_name,
          home_team_crest,
          away_team_name,
          away_team_crest,
          status,
          minute,
          home_score,
          away_score,
          kickoff_at,
          updated_at
        FROM matches
        WHERE kickoff_at >= NOW() - INTERVAL '24 hours'

        UNION ALL

        SELECT 
          match_id AS provider_match_id,
          competition AS competition_name,
          home_team AS home_team_name,
          NULL AS home_team_crest,
          away_team AS away_team_name,
          NULL AS away_team_crest,
          status,
          COALESCE(match_minute::text, '') AS minute,
          home_score,
          away_score,
          COALESCE(kickoff_at, updated_at, NOW()) AS kickoff_at,
          updated_at
        FROM live_matches
        WHERE (kickoff_at >= NOW() - INTERVAL '24 hours' OR status = 'live')
          AND NOT EXISTS (
            SELECT 1 FROM matches WHERE provider_match_id = live_matches.match_id
          )
      ) combined_matches
      ORDER BY 
        CASE 
          WHEN status = 'live' THEN 1
          WHEN status = 'scheduled' THEN 2
          ELSE 3
        END,
        kickoff_at ASC
    `);
    res.json({ matches: result.rows });
  } catch (err) {
    console.error('Error fetching sports matches:', err.message);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// Manual sports poll trigger (call from cron or admin to force a refresh)
app.get('/api/cron/sports', async (req, res) => {
  const { secret, standings } = req.query;
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.status(200).json({
    success: true,
    message: standings === 'true' ? 'Sports standings update started' : 'Sports matches polling started',
    timestamp: new Date().toISOString()
  });

  setImmediate(async () => {
    try {
      if (!process.env.FOOTBALL_DATA_API_KEY) {
        console.error('[sportsCron] FOOTBALL_DATA_API_KEY not set');
        return;
      }
      const { pollMatches, fetchAndCacheStandings } = require('./services/sportsBot');
      if (standings === 'true') {
        console.log('[sportsCron] Starting standings update...');
        await fetchAndCacheStandings(pool);
        console.log('[sportsCron] Standings update completed successfully');
      } else {
        console.log('[sportsCron] Starting match polling...');
        await pollMatches(pool, notificationService);
        console.log('[sportsCron] Match polling completed successfully');
      }
    } catch (err) {
      console.error('❌ Sports cron background job failed:', err.message);
    }
  });
});

// Sports health endpoint — reports whether the bot can run
app.get('/api/sports/health', async (req, res) => {
  try {
    const keyOk = !!process.env.FOOTBALL_DATA_API_KEY;
    const m = await pool.query('SELECT COUNT(*) AS c FROM matches');
    const lm = await pool.query('SELECT COUNT(*) AS c FROM live_matches');
    res.json({
      footballKeySet: keyOk,
      matches: m.rows[0].c,
      liveMatches: lm.rows[0].c,
      status: keyOk ? 'operational' : 'missing_api_key'
    });
  } catch (err) {
    res.json({ footballKeySet: !!process.env.FOOTBALL_DATA_API_KEY, status: 'error', error: err.message });
  }
});

// Follow or Unfollow a match
app.post('/api/sports/follow', express.json(), async (req, res) => {
  const { device_id, provider_match_id, action } = req.body;
  if (!device_id || !provider_match_id) return res.status(400).json({ error: 'Missing parameters' });

  try {
    if (action === 'unfollow') {
      await pool.query('DELETE FROM followed_matches WHERE device_id = $1 AND provider_match_id = $2', [device_id, provider_match_id]);
      res.json({ success: true, message: 'Unfollowed' });
    } else {
      await pool.query(`
        INSERT INTO followed_matches (device_id, provider_match_id) 
        VALUES ($1, $2) ON CONFLICT DO NOTHING
      `, [device_id, provider_match_id]);
      res.json({ success: true, message: 'Followed' });
    }
  } catch (err) {
    console.error('Error following match:', err.message);
    res.status(500).json({ error: 'Failed to update follow status' });
  }
});

// Get matches followed by a device
app.get('/api/sports/following/:device_id', async (req, res) => {
  try {
    const result = await pool.query('SELECT provider_match_id FROM followed_matches WHERE device_id = $1', [req.params.device_id]);
    res.json({ following: result.rows.map(r => r.provider_match_id) });
  } catch (err) {
    console.error('Error fetching followed matches:', err.message);
    res.status(500).json({ error: 'Failed to fetch following list' });
  }
});

// Get Nigerian news — DB-first (instant)
app.get('/api/news/nigerian', makeDbFirstRoute('nigerian', nigerianFeeds, ['nigerian-news', 'nigeria']));

// Get Local news based on GPS coordinates or Vercel IP headers (instant location sensor)
app.get('/api/news/local', async (req, res) => {
  try {
    let country = req.headers['x-vercel-ip-country'] || 'NG';

    const { lat, lng } = req.query;
    if (lat && lng) {
      const latitude = parseFloat(String(lat));
      const longitude = parseFloat(String(lng));
      if (latitude > 4 && latitude < 14 && longitude > 3 && longitude < 15) {
        country = 'NG';
      } else if (latitude > 4.5 && latitude < 11.5 && longitude > -3.5 && longitude < 1.5) {
        country = 'GH';
      } else if (latitude > -4.7 && latitude < 5.0 && longitude > 33.5 && longitude < 42.0) {
        country = 'KE';
      } else if (latitude > -35.0 && latitude < -22.0 && longitude > 16.0 && longitude < 33.0) {
        country = 'ZA';
      } else if (latitude > 49.0 && latitude < 61.0 && longitude > -9.0 && longitude < 2.0) {
        country = 'GB';
      } else if (latitude > 24.0 && latitude < 49.0 && longitude > -125.0 && longitude < -66.0) {
        country = 'US';
      }
    }

    country = String(country).toUpperCase();

    let dbCategory = 'nigerian-news';
    let feeds = nigerianFeeds;

    if (country === 'GH') {
      dbCategory = 'ghana';
      feeds = ghanaFeeds;
    } else if (country === 'KE') {
      dbCategory = 'kenya';
      feeds = kenyaFeeds;
    } else if (country === 'ZA') {
      dbCategory = 'south-africa';
      feeds = southAfricaFeeds;
    } else if (country === 'GB') {
      dbCategory = 'uk';
      feeds = ukFeeds;
    } else if (country === 'US') {
      dbCategory = 'usa';
      feeds = usaFeeds;
    }

    const handler = makeDbFirstRoute(dbCategory, feeds, [dbCategory, 'nigerian-news', 'nigeria'].filter(Boolean));
    return handler(req, res);
  } catch (error) {
    console.error('Error fetching local news:', error);
    res.status(500).json({ error: 'Failed to fetch local news' });
  }
});

// Get Ghana news — DB-first
app.get('/api/news/ghana', makeDbFirstRoute('ghana', ghanaFeeds, 'ghana'));

// Get Kenya news — DB-first
app.get('/api/news/kenya', makeDbFirstRoute('kenya', kenyaFeeds, 'kenya'));

// Get South Africa news — DB-first
app.get('/api/news/south-africa', makeDbFirstRoute('south-africa', southAfricaFeeds, 'south-africa'));

// Get UK news — DB-first
app.get('/api/news/uk', makeDbFirstRoute('uk', ukFeeds, 'uk'));

// Get USA news — DB-first
app.get('/api/news/usa', makeDbFirstRoute('usa', usaFeeds, 'usa'));

// Get Crypto news — DB-first
app.get('/api/news/crypto', makeDbFirstRoute('crypto', cryptoFeeds, 'crypto'));

// Get Culture news — DB-first
app.get('/api/news/culture', makeDbFirstRoute('culture', cultureFeeds, 'culture'));

// Get Entertainment news — DB-first
app.get('/api/news/entertainment', makeDbFirstRoute('entertainment', entertainmentFeeds, 'entertainment'));

// Get Jobs news — DB-first
app.get('/api/news/jobs', makeDbFirstRoute('jobs', jobsFeeds, 'jobs'));

// Get Tech news — DB-first
app.get('/api/news/tech', makeDbFirstRoute('tech', techFeeds, 'tech'));

// Get Business news — DB-first
app.get('/api/news/business', makeDbFirstRoute('business', businessFeeds, 'business'));

// Get Science news — DB-first
app.get('/api/news/science', makeDbFirstRoute('science', scienceFeeds, 'science'));

// Get Lifestyle news — DB-first
app.get('/api/news/lifestyle', makeDbFirstRoute('lifestyle', lifestyleFeeds, 'lifestyle'));

// Get Sports news — DB-first, live RSS fallback if < 5 results
app.get('/api/news/sports', async (req, res) => {
  try {
    // 1. Try DB first (instant)
    if (process.env.DATABASE_URL) {
      const dbResult = await pool.query(
        `SELECT 'rss-' || id AS id, title,
                COALESCE(ai_summary, original_excerpt) AS excerpt,
                category, image, source_name AS author,
                external_link, published_at AS date, content_type,
                is_featured, '5 min read' AS read_time
         FROM rss_articles
         WHERE category = 'sports'
         ORDER BY published_at DESC
         LIMIT 50`
      );
      if (dbResult.rows.length >= 5) {
        return res.json(dbResult.rows.map(r => ({
          id: r.id, title: r.title, excerpt: r.excerpt,
          category: 'sports', image: r.image, author: r.author,
          externalLink: r.external_link, date: r.date,
          contentType: r.content_type, readTime: r.read_time,
          isFeatured: r.is_featured, source: 'rss'
        })));
      }
    }

    // 2. Fallback — fetch live RSS, insert into DB, then respond
    console.log('Sports DB < 5 results, fetching live RSS...');
    const liveArticles = await fetchRSSFeeds(sportsFeeds);

    // Background-insert new articles into DB so next request hits cache
    if (process.env.DATABASE_URL && liveArticles.length > 0) {
      const crypto = require('crypto');
      for (const a of liveArticles) {
        if (!a.externalLink) continue;
        const hash = crypto.createHash('sha256').update(a.externalLink).digest('hex').slice(0, 64);
        pool.query(
          `INSERT INTO rss_articles
             (url_hash, title, original_excerpt, category, image, author, source_name, external_link, published_at, content_type)
           VALUES ($1,$2,$3,'sports',$4,$5,$6,$7,$8,'article')
           ON CONFLICT (url_hash) DO NOTHING`,
          [hash, a.title, a.excerpt, a.image, a.author, a.author, a.externalLink, a.date]
        ).catch(e => console.warn('Sports fallback insert:', e.message));
      }
    }

    res.json(liveArticles);
  } catch (error) {
    console.error('Error fetching sports news:', error);
    res.status(500).json({ error: 'Failed to fetch sports news' });
  }
});

// Get featured sports article — highest-scored recent article, falls back to newest
app.get('/api/news/sports/featured', async (req, res) => {
  try {
    if (!process.env.DATABASE_URL) return res.json(null);
    const result = await pool.query(
      `SELECT 'rss-' || id AS id, title,
              COALESCE(ai_summary, original_excerpt) AS excerpt,
              category, image, source_name AS author,
              external_link, published_at AS date, content_type,
              '5 min read' AS read_time
       FROM rss_articles
       WHERE category = 'sports'
       ORDER BY is_featured DESC, published_at DESC
       LIMIT 1`
    );
    if (result.rows.length === 0) return res.json(null);
    const r = result.rows[0];
    res.json({
      id: r.id, title: r.title, excerpt: r.excerpt,
      category: 'sports', image: r.image, author: r.author,
      externalLink: r.external_link, date: r.date,
      contentType: r.content_type, readTime: r.read_time, source: 'rss'
    });
  } catch (err) {
    console.error('Featured sports error:', err.message);
    res.json(null);
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

// Get World news — DB-first (all non-country-specific categories)
app.get('/api/news/world', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    if (process.env.DATABASE_URL) {
      const countResult = await pool.query(
        `SELECT COUNT(*) FROM rss_articles WHERE category NOT IN ('sports')`
      );
      const total = parseInt(countResult.rows[0].count, 10);

      if (total >= 5) {
        const dbResult = await pool.query(
          `SELECT 'rss-' || id AS id,
                  title,
                  COALESCE(ai_summary, original_excerpt) AS excerpt,
                  category, image, source_name AS author,
                  external_link, published_at AS date, content_type,
                  '5 min read' AS read_time
           FROM rss_articles
           WHERE category NOT IN ('sports')
           ORDER BY published_at DESC
           LIMIT $1 OFFSET $2`,
          [limit, offset]
        );
        const articles = dbResult.rows.map(r => ({
          id: r.id, title: r.title, excerpt: r.excerpt,
          category: r.category, image: r.image, author: r.author,
          externalLink: r.external_link, date: r.date,
          contentType: r.content_type, readTime: r.read_time, source: 'rss'
        }));
        if (req.query.paginated === 'true') {
          return res.json({
            articles,
            pagination: { currentPage: page, totalPages: Math.ceil(total / limit), totalItems: total, itemsPerPage: limit }
          });
        }
        return res.json(articles);
      }
    }

    // Fallback: live RSS scraping
    console.log('World DB empty, falling back to live RSS...');
    const liveArticles = await fetchRSSFeeds(worldFeeds);
    const slice = liveArticles.slice((page - 1) * limit, page * limit);
    if (req.query.paginated === 'true') {
      return res.json({
        articles: slice,
        pagination: { currentPage: page, totalPages: Math.ceil(liveArticles.length / limit), totalItems: liveArticles.length, itemsPerPage: limit }
      });
    }
    res.json(liveArticles);
  } catch (error) {
    console.error('Error fetching World news:', error);
    res.status(500).json({ error: 'Failed to fetch World news' });
  }
});

// Get Breaking news — AI Editor picks (DB-first with AI editorial judgment)
app.get('/api/news/breaking', async (req, res) => {
  try {
    const useDiverse = req.query.diverse === 'true';
    const useAi = req.query.ai !== 'false'; // Allow opting out of AI via ?ai=false

    if (process.env.DATABASE_URL) {
      // Step 1: Try cached AI editor picks (freshest within 1 hour)
      if (useAi && process.env.GEMINI_API_KEY) {
        try {
          const cachedPicks = await pool.query(
            `SELECT article_ids, hero_ids FROM ai_editor_picks 
             WHERE expires_at > NOW() 
             ORDER BY selected_at DESC LIMIT 1`
          );
          if (cachedPicks.rows.length > 0) {
            const pickData = cachedPicks.rows[0];
            const ids = [...pickData.article_ids, ...pickData.hero_ids];
            if (ids.length > 0) {
              // Get full article data for cached picks
              const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
              const articlesRes = await pool.query(
                `SELECT 'rss-' || id AS id, title,
                        COALESCE(ai_summary, original_excerpt) AS excerpt,
                        category, image, source_name AS author,
                        external_link, published_at AS date, content_type,
                        '5 min read' AS read_time
                 FROM rss_articles
                 WHERE 'rss-' || id IN (${placeholders})
                 ORDER BY published_at DESC`,
                ids
              );
              if (articlesRes.rows.length >= 5) {
                return res.json(articlesRes.rows.map(r => ({
                  ...r, source_name: r.author, source: 'rss'
                })));
              }
            }
          }
        } catch (cacheErr) {
          // Cache miss — continue to generate fresh picks
          console.log('AI picks cache miss, generating fresh...');
        }
      }

      // Step 2: Get fresh articles for AI editorial selection
      const hoursBack = useAi ? 2 : 1;
      const freshRes = await pool.query(
        `SELECT 'rss-' || id as id, id as db_id, title, original_excerpt, ai_summary,
                category, image, source_name, external_link, published_at, content_type
         FROM rss_articles
         WHERE published_at > NOW() - INTERVAL '${hoursBack} hours'
           AND image IS NOT NULL AND image != ''
         ORDER BY published_at DESC
         LIMIT 60`
      );

      if (freshRes.rows.length >= 5 && useAi && process.env.GEMINI_API_KEY) {
        const { selectBreakingNow } = require('./services/aiHomepageEditor');
        const { breakingNow, heroStories } = await selectBreakingNow(freshRes.rows, pool);

        if (breakingNow.length >= 5) {
          return res.json(breakingNow.map(r => ({
            id: r.id, title: r.title,
            excerpt: r.ai_summary || r.original_excerpt || '',
            category: r.category, image: r.image,
            author: r.source_name || r.author,
            externalLink: r.external_link, date: r.published_at || r.date,
            contentType: r.content_type || 'article',
            readTime: '5 min read', source: 'rss',
            source_name: r.source_name || r.author,
            editorial_reason: r.editorial_reason || ''
          })));
        }
      }

      // Step 3: Fallback to diverse or recency-based sorting
      let queryText = '';
      if (useDiverse) {
        queryText = `
          SELECT * FROM (
            SELECT 'rss-' || id AS id,
                   title,
                   COALESCE(ai_summary, original_excerpt) AS excerpt,
                   category, image, source_name AS author,
                   external_link, published_at AS date, content_type,
                   '5 min read' AS read_time,
                   ROW_NUMBER() OVER (PARTITION BY source_name ORDER BY published_at DESC) AS rn
            FROM rss_articles
            WHERE image IS NOT NULL AND image != ''
          ) t
          WHERE t.rn <= 2
          ORDER BY published_at DESC
          LIMIT 20
        `;
      } else {
        queryText = `
          SELECT 'rss-' || id AS id,
                 title,
                 COALESCE(ai_summary, original_excerpt) AS excerpt,
                 category, image, source_name AS author,
                 external_link, published_at AS date, content_type,
                 '5 min read' AS read_time
          FROM rss_articles
          WHERE image IS NOT NULL AND image != ''
          ORDER BY published_at DESC
          LIMIT 20
        `;
      }

      const dbResult = await pool.query(queryText);
      if (dbResult.rows.length >= 5) {
        return res.json(dbResult.rows.map(r => ({
          id: r.id, title: r.title, excerpt: r.excerpt,
          category: r.category, image: r.image, author: r.author,
          externalLink: r.external_link, date: r.date,
          contentType: r.content_type, readTime: r.read_time, source: 'rss',
          source_name: r.author
        })));
      }
    }

    // Fallback: live RSS scraping
    console.log('Breaking news DB empty, falling back to live RSS...');
    const [nigerianNews, worldNews, sportsNews] = await Promise.all([
      fetchRSSFeeds(nigerianFeeds.slice(0, 3)),
      fetchRSSFeeds(worldFeeds.slice(0, 3)),
      fetchRSSFeeds(sportsFeeds.slice(0, 2))
    ]);
    const breaking = [...nigerianNews, ...worldNews, ...sportsNews]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20);
    res.json(breaking);
  } catch (error) {
    console.error('Error fetching breaking news:', error);
    res.status(500).json({ error: 'Failed to fetch breaking news' });
  }
});


// Search endpoint — PostgreSQL full-text search with relevance + time-decay ranking
app.get('/api/news/search', async (req, res) => {
  try {
    const { q, category } = req.query;

    if (!q) {
      if (!category) {
        return res.status(400).json({ error: 'Search query or category required' });
      }
      if (!process.env.DATABASE_URL) {
        return res.status(503).json({ error: 'Search unavailable — no database configured' });
      }
      console.log(`🔍 Category-only news request: [${category}]`);
      const result = await pool.query(
        `SELECT
           'rss-' || id          AS id,
           title,
           COALESCE(ai_summary, original_excerpt) AS excerpt,
           category,
           image,
           source_name           AS author,
           external_link,
           published_at          AS date,
           content_type,
           '5 min read'          AS read_time
         FROM rss_articles
         WHERE category = $1
         ORDER BY published_at DESC
         LIMIT 50`,
        [category]
      );
      const articles = result.rows.map(row => ({
        id: row.id,
        title: row.title,
        excerpt: row.excerpt,
        category: row.category || 'news',
        image: row.image,
        author: row.author,
        externalLink: row.external_link,
        date: row.date,
        contentType: row.content_type || 'article',
        readTime: row.read_time,
        source: 'rss',
      }));
      return res.json(articles);
    }

    if (!process.env.DATABASE_URL) {
      return res.status(503).json({ error: 'Search unavailable — no database configured' });
    }

    console.log(`🔍 FTS search: "${q}"${category ? ` [${category}]` : ''}`);

    // websearch_to_tsquery parses natural language: quotes = phrase, - = exclude, OR = union
    // Falls back to plainto_tsquery if the input produces an invalid tsquery
    const categoryFilter = category ? 'AND category = $2' : '';
    const params = category ? [q, category] : [q];

    const result = await pool.query(
      `SELECT
         'rss-' || id          AS id,
         title,
         COALESCE(ai_summary, original_excerpt) AS excerpt,
         category,
         image,
         source_name           AS author,
         external_link,
         published_at          AS date,
         content_type,
         '5 min read'          AS read_time,
         -- Relevance: title match (weight A) scores ~4x higher than excerpt (weight B)
         ts_rank(search_vector, websearch_to_tsquery('english', $1),
                 32 /* rank by unique words, normalise by doc length */) AS relevance,
         -- Time decay: halves every 48 hours; recent articles naturally float up
         EXP(-0.5 * EXTRACT(EPOCH FROM (NOW() - published_at)) / 172800.0) AS freshness
       FROM rss_articles
       WHERE search_vector @@ websearch_to_tsquery('english', $1)
         ${categoryFilter}
         AND published_at > NOW() - INTERVAL '14 days'
       ORDER BY (ts_rank(search_vector, websearch_to_tsquery('english', $1), 32) * 0.6
                 + EXP(-0.5 * EXTRACT(EPOCH FROM (NOW() - published_at)) / 172800.0) * 0.4
                ) DESC
       LIMIT 30`,
      params
    );

    const articles = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      excerpt: row.excerpt,
      category: row.category || 'news',
      image: row.image,
      author: row.author,
      externalLink: row.external_link,
      date: row.date,
      contentType: row.content_type || 'article',
      readTime: row.read_time,
      source: 'rss',
    }));

    console.log(`✅ FTS: ${articles.length} results for "${q}"`);
    res.json(articles);
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({ error: 'Search failed', message: error.message });
  }
});

// --- Dynamic sitemap.xml Generator (Programmatic SEO) ---
app.get('/sitemap.xml', async (req, res) => {
  try {
    const baseUrl = 'https://realssa.news';
    let urls = [
      { loc: `${baseUrl}/`, changefreq: 'daily', priority: 1.0 },
      { loc: `${baseUrl}/reels`, changefreq: 'daily', priority: 0.8 },
      { loc: `${baseUrl}/sports`, changefreq: 'daily', priority: 0.8 },
      { loc: `${baseUrl}/videos`, changefreq: 'daily', priority: 0.8 },
      { loc: `${baseUrl}/saved`, changefreq: 'weekly', priority: 0.5 },
    ];

    if (process.env.DATABASE_URL) {
      // Fetch dynamic publishers
      const pubRes = await pool.query('SELECT slug FROM publishers');
      pubRes.rows.forEach(row => {
        urls.push({ loc: `${baseUrl}/publisher/${row.slug}`, changefreq: 'daily', priority: 0.7 });
      });

      // Fetch active league slugs from competitions
      const compRes = await pool.query('SELECT slug FROM competitions WHERE is_active = true');
      compRes.rows.forEach(row => {
        urls.push({ loc: `${baseUrl}/sports/league/${row.slug}`, changefreq: 'daily', priority: 0.7 });
      });
    }

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    urls.forEach(item => {
      xml += '  <url>\n';
      xml += `    <loc>${item.loc}</loc>\n`;
      xml += `    <changefreq>${item.changefreq}</changefreq>\n`;
      xml += `    <priority>${item.priority.toFixed(1)}</priority>\n`;
      xml += '  </url>\n';
    });
    xml += '</urlset>';

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    console.error('Sitemap generation failed:', err.message);
    res.status(500).send('Error generating sitemap');
  }
});

// --- User Reading Streak sync endpoint ---
app.post('/api/users/streak', async (req, res) => {
  const { deviceId } = req.body;
  if (!deviceId) {
    return res.status(400).json({ error: 'Missing deviceId' });
  }

  try {
    const result = await usersPool.query(
      'SELECT current_streak, longest_streak, last_read_at FROM user_streaks WHERE device_id = $1',
      [deviceId]
    );

    const now = new Date();

    if (result.rows.length === 0) {
      const insertRes = await usersPool.query(
        `INSERT INTO user_streaks (device_id, current_streak, longest_streak, last_read_at)
         VALUES ($1, 1, 1, NOW()) RETURNING *`,
        [deviceId]
      );
      const row = insertRes.rows[0];
      return res.json({
        currentStreak: row.current_streak,
        longestStreak: row.longest_streak,
        lastReadAt: row.last_read_at
      });
    }

    const streak = result.rows[0];
    const lastReadAt = new Date(streak.last_read_at);
    
    // Absolute elapsed time gap calculation
    const gapMs = now - lastReadAt;
    const gapHours = gapMs / (1000 * 60 * 60);

    let nextStreak = streak.current_streak;
    let nextLongest = streak.longest_streak;

    if (gapHours < 24) {
      await usersPool.query(
        'UPDATE user_streaks SET last_read_at = NOW() WHERE device_id = $1',
        [deviceId]
      );
    } else if (gapHours >= 24 && gapHours <= 48) {
      nextStreak += 1;
      if (nextStreak > nextLongest) {
        nextLongest = nextStreak;
      }
      await usersPool.query(
        'UPDATE user_streaks SET current_streak = $1, longest_streak = $2, last_read_at = NOW() WHERE device_id = $1',
        [nextStreak, nextLongest, deviceId]
      );
    } else {
      nextStreak = 1;
      await usersPool.query(
        'UPDATE user_streaks SET current_streak = 1, last_read_at = NOW() WHERE device_id = $1',
        [deviceId]
      );
    }

    res.json({
      currentStreak: nextStreak,
      longestStreak: nextLongest,
      lastReadAt: now.toISOString()
    });
  } catch (err) {
    console.error('Streak sync error:', err.message);
    res.status(500).json({ error: 'Failed to sync reading streak' });
  }
});

// --- Publisher Hub metadata & feeds ---
app.get('/api/publishers/:slug', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, slug, logo_url, bio, wikipedia_url, follower_metrics FROM publishers WHERE slug = $1',
      [req.params.slug]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Publisher not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Fetch publisher details error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/publishers/:slug/posts', async (req, res) => {
  try {
    const pubRes = await pool.query('SELECT id FROM publishers WHERE slug = $1', [req.params.slug]);
    if (pubRes.rows.length === 0) {
      return res.status(404).json({ error: 'Publisher not found' });
    }
    const publisherId = pubRes.rows[0].id;
    const postsRes = await pool.query(
      'SELECT id, platform, post_text, media_url, post_url, published_at FROM publisher_social_posts WHERE publisher_id = $1 ORDER BY published_at DESC LIMIT 10',
      [publisherId]
    );
    res.json(postsRes.rows);
  } catch (err) {
    console.error('Fetch publisher social posts error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/publishers/:slug/articles', async (req, res) => {
  try {
    const pubRes = await pool.query('SELECT name FROM publishers WHERE slug = $1', [req.params.slug]);
    if (pubRes.rows.length === 0) {
      return res.status(404).json({ error: 'Publisher not found' });
    }
    const publisherName = pubRes.rows[0].name;
    const articlesRes = await pool.query(
      `SELECT id, story_hash, title, summary, link, image_url, source, published_at, category, local_verified_count, rumor_flag_count
       FROM rss_articles 
       WHERE source ILIKE $1 
       ORDER BY published_at DESC 
       LIMIT 30`,
      [`%${publisherName}%`]
    );
    res.json(articlesRes.rows);
  } catch (err) {
    console.error('Fetch publisher articles error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- Community Hype Meter & Article Verification ---
app.post('/api/sports/matches/:matchId/hype', async (req, res) => {
  const { team } = req.body;
  if (team !== 'home' && team !== 'away') {
    return res.status(400).json({ error: 'Invalid team parameter' });
  }

  try {
    const column = team === 'home' ? 'home_hype_count' : 'away_hype_count';
    const result = await pool.query(
      `UPDATE live_matches 
       SET ${column} = ${column} + 1 
       WHERE match_id = $1 
       RETURNING home_hype_count, away_hype_count`,
      [req.params.matchId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Hype meter error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/articles/:storyHash/verify', async (req, res) => {
  const { type } = req.body;
  if (type !== 'verify' && type !== 'flag') {
    return res.status(400).json({ error: 'Invalid type parameter' });
  }

  try {
    const column = type === 'verify' ? 'local_verified_count' : 'rumor_flag_count';
    const result = await pool.query(
      `UPDATE rss_articles 
       SET ${column} = ${column} + 1 
       WHERE story_hash = $1 
       RETURNING local_verified_count, rumor_flag_count`,
      [req.params.storyHash]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Article verification error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- PostgreSQL Threaded Comments endpoints (In-Memory Tree Mapping) ---
app.get('/api/comments', async (req, res) => {
  const { articleId } = req.query;
  if (!articleId) {
    return res.status(400).json({ error: 'Missing articleId query parameter' });
  }

  try {
    const result = await usersPool.query(
      'SELECT * FROM comments WHERE article_id = $1 ORDER BY created_at ASC',
      [String(articleId)]
    );

    const allComments = result.rows.map(comment => ({
      id: String(comment.id),
      articleId: comment.article_id,
      parentId: comment.parent_id ? String(comment.parent_id) : null,
      author: comment.author_name,
      content: comment.content,
      date: new Date(comment.created_at).toISOString(),
      likes: comment.likes || 0,
      replies: []
    }));

    const commentMap = {};
    const rootComments = [];

    allComments.forEach(comment => {
      commentMap[comment.id] = comment;
    });

    allComments.forEach(comment => {
      if (comment.parentId) {
        if (commentMap[comment.parentId]) {
          commentMap[comment.parentId].replies.push(comment);
        }
      } else {
        rootComments.push(comment);
      }
    });

    res.json(rootComments.reverse()); // Show newest parent threads first
  } catch (err) {
    console.error('Fetch comments failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/comments', async (req, res) => {
  const { articleId, author, content, parentId } = req.body;
  if (!articleId || !author || !content) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const pId = parentId ? parseInt(parentId, 10) : null;
    const result = await usersPool.query(
      `INSERT INTO comments (article_id, author_name, content, parent_id) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [String(articleId), escapeHtml(author).substring(0, 100), escapeHtml(content).substring(0, 1000), pId]
    );

    const created = result.rows[0];
    res.status(201).json({
      id: String(created.id),
      articleId: created.article_id,
      parentId: created.parent_id ? String(created.parent_id) : null,
      author: created.author_name,
      content: created.content,
      date: new Date(created.created_at).toISOString(),
      likes: created.likes || 0,
      replies: []
    });
  } catch (err) {
    console.error('Submit comment failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/comments/:id/like', async (req, res) => {
  try {
    const result = await usersPool.query(
      'UPDATE comments SET likes = likes + 1 WHERE id = $1 RETURNING *',
      [parseInt(req.params.id, 10)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const updated = result.rows[0];
    res.json({
      id: String(updated.id),
      articleId: updated.article_id,
      parentId: updated.parent_id ? String(updated.parent_id) : null,
      author: updated.author_name,
      content: updated.content,
      date: new Date(updated.created_at).toISOString(),
      likes: updated.likes
    });
  } catch (err) {
    console.error('Like comment failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── CRON JOB HANDLERS ──────────────────────────────────────────────────────
// Note: vercel.json routes /api/(.*) → api/index.js, so cron endpoints must
// be handled here rather than as standalone serverless functions.

const CRON_SECRET = process.env.CRON_SECRET;

const ingestAllFeeds = require('./services/ingestion').ingestAllFeeds;

// GET /api/cron/ingest?category=world&secret=xxx
// Called by external cron-job.org every 30 minutes
app.get('/api/migrate', async (req, res) => {
  if (req.query.secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    await pool.query('ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS story_hash VARCHAR(64)');
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'rss_articles_story_hash_key'
        ) THEN
          ALTER TABLE rss_articles ADD CONSTRAINT rss_articles_story_hash_key UNIQUE (story_hash);
        END IF;
      END
      $$;
    `);
    res.json({ success: true, message: 'Migration applied successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/cron/ingest', async (req, res) => {
  const { secret, category } = req.query;
  if (secret !== CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // Respond immediately — Vercel kills the function at 10s
  // Ingestion runs in background via setImmediate (keeps event loop alive briefly)
  res.status(200).json({
    success: true,
    message: 'Ingestion started',
    category: category || 'all',
    timestamp: new Date().toISOString()
  });
  setImmediate(async () => {
    try {
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
      const result = await ingestAllFeeds(pool, parser, category || null);
      console.log(`✅ Ingestion complete: ${result.newCount} new, ${result.summaryCount} summaries`);
    } catch (error) {
      console.error('❌ Cron ingestion error:', error.message);
    }
  });
});

// GET /api/cron/streams?secret=xxx
// Called by external cron-job.org for video/stream processing
app.get('/api/cron/streams', async (req, res) => {
  const { secret } = req.query;
  if (secret !== CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    console.log('🎥 Cron: Processing video streams...');
    res.status(200).json({
      success: true,
      message: 'Streams processed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Cron streams error:', error);
    res.status(500).json({ error: 'Streams processing failed', message: error.message });
  }
});

// GET /api/streams/live
// Returns active/verified live match streams for the frontend player
app.get('/api/streams/live', async (req, res) => {
  if (process.env.DATABASE_URL) {
    try {
      const result = await pool.query(
        `SELECT id, match_id, match_title, home_team, away_team, stream_url, stream_type, quality, language, is_live, is_verified, created_at, updated_at
         FROM live_streams
         WHERE is_live = true
         ORDER BY is_verified DESC, created_at DESC`
      );
      return res.json(result.rows);
    } catch (err) {
      console.error('Failed to fetch live streams:', err.message);
      return res.status(500).json({ error: 'Failed to fetch live streams' });
    }
  }
  res.json([]);
});

// GET /api/cron/summarize?secret=xxx
// Called by external cron-job.org every hour for AI summaries
app.get('/api/cron/summarize', async (req, res) => {
  const { secret } = req.query;
  if (secret !== CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    console.log('🤖 Cron: Starting automated AI summarization...');
    const articlesResult = await pool.query(
      `SELECT id, title, original_excerpt, content_type
       FROM rss_articles 
       WHERE ai_summary IS NULL 
       AND content_type = 'article'
       AND original_excerpt IS NOT NULL
       AND published_at > NOW() - INTERVAL '7 days'
       ORDER BY published_at DESC
       LIMIT 3`
    );
    const articles = articlesResult.rows;
    console.log(`📊 Found ${articles.length} articles needing summaries`);
    let successCount = 0;
    for (const article of articles) {
      try {
        const summary = await generateSummary(article.title, article.original_excerpt);
        if (summary) {
          await pool.query('UPDATE rss_articles SET ai_summary = $1 WHERE id = $2', [summary, article.id]);
          successCount++;
        }
      } catch (err) {
        console.error(`❌ Error summarizing article ${article.id}:`, err.message);
      }
    }
    console.log(`✅ Summarization complete: ${successCount}/${articles.length} succeeded`);
    res.status(200).json({ success: true, summarized: successCount, total: articles.length, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('❌ Summarization job error:', error.message);
    res.status(500).json({ error: 'Summarization failed', message: error.message });
  }
});

// ── Test Notification Endpoint ──────────────────────────────────────────
// GET /api/cron/test-notify?secret=xxx  — sends a real push to all subscribers
app.get('/api/cron/test-notify', async (req, res) => {
  const { secret } = req.query;
  if (secret !== CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const notificationService = require('./services/notificationService');
  const result = await notificationService.sendBreakingNews({
    id: 'test-1',
    rawId: 'test-1',
    externalLink: null,
    title: '🔔 RealSSA News notifications are working!',
    category: 'nigerian-news',
    summary: 'This is a test push notification from RealSSA News.'
  });
  console.log('Test notify result:', JSON.stringify(result));
  res.json(result);
});

// ── View Counter ─────────────────────────────────────────────────────────
// POST /api/articles/:id/view — increment view count
app.post('/api/articles/:id/view', async (req, res) => {
  try {
    if (!process.env.DATABASE_URL || !req.params.id.startsWith('rss-')) {
      return res.json({ views: 0 });
    }
    const articleId = req.params.id.replace('rss-', '');
    const result = await pool.query(
      `UPDATE rss_articles SET view_count = COALESCE(view_count, 0) + 1
       WHERE id = $1 RETURNING view_count`,
      [articleId]
    );
    res.json({ views: result.rows[0]?.view_count || 1 });
  } catch (err) {
    res.json({ views: 0 });
  }
});

// Dynamic Google News Sitemap — articles from last 48 hours only
app.get('/api/sitemap-news.xml', async (req, res) => {
  try {
    let rows = [];
    if (process.env.DATABASE_URL) {
      const result = await pool.query(
        `SELECT id, title, image, category, published_at, external_link
         FROM rss_articles
         WHERE published_at > NOW() - INTERVAL '48 hours'
         ORDER BY published_at DESC
         LIMIT 1000`
      );
      rows = result.rows;
    }
    const SITE = 'https://www.realssanews.com.ng';
    const urls = rows.map(r => {
      const loc = `${SITE}/article/rss-${r.id}`;
      const pubDate = new Date(r.published_at).toISOString();
      const safeTitle = (r.title || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      return `
  <url>
    <loc>${loc}</loc>
    <lastmod>${pubDate}</lastmod>
    <changefreq>never</changefreq>
    <priority>0.8</priority>
    <news:news>
      <news:publication>
        <news:name>RealSSA News</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${pubDate}</news:publication_date>
      <news:title>${safeTitle}</news:title>
    </news:news>${r.image ? `
    <image:image><image:loc>${r.image}</image:loc></image:image>` : ''}
  </url>`;
    }).join('');
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>`);
  } catch (err) {
    console.error('Sitemap error:', err.message);
    res.status(500).send('Sitemap generation failed');
  }
});

// Import notification routes
const notificationRoutes = require('./routes/notifications');

// Use notification routes
app.use('/api/notifications', notificationRoutes);

// GET /api/sports/standings/:league
app.get('/api/sports/standings/:league', async (req, res) => {
  try {
    if (!process.env.DATABASE_URL) return res.json([]);
    const result = await pool.query(
      `SELECT standings, scraped_at FROM league_tables
       WHERE league_slug = $1
       ORDER BY scraped_at DESC LIMIT 1`,
      [req.params.league]
    );
    if (result.rows.length === 0) return res.json({ standings: [], scraped_at: null });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Standings error:', err.message);
    res.json({ standings: [], scraped_at: null });
  }
});

// ── Live Scores API (reads from live_matches table written by scraper) ────
app.get('/api/sports/live', async (req, res) => {
  try {
    if (!process.env.DATABASE_URL) return res.json([]);
    const result = await pool.query(
      `SELECT match_id, competition, home_team, away_team,
              home_score, away_score, status, match_minute,
              match_url, updated_at
       FROM live_matches
       WHERE status IN ('live', 'scheduled')
         AND (status = 'live' OR kickoff_at > NOW() - INTERVAL '3 hours')
       ORDER BY status DESC, updated_at DESC
       LIMIT 50`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Live scores error:', err.message);
    res.json([]);
  }
});

app.get('/api/sports/results', async (req, res) => {
  try {
    if (!process.env.DATABASE_URL) return res.json([]);
    const result = await pool.query(
      `SELECT match_id, competition, home_team, away_team,
              home_score, away_score, status, match_minute, updated_at
       FROM live_matches
       WHERE status = 'finished'
       ORDER BY updated_at DESC
       LIMIT 30`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Results error:', err.message);
    res.json([]);
  }
});


// Helper for DB fallback match details
async function getMatchDetailsFromDB(matchId) {
  if (!process.env.DATABASE_URL) return null;
  try {
    const dbMatch = await pool.query(`
      SELECT * FROM (
        SELECT 
          provider_match_id,
          competition_name,
          home_team_name,
          home_team_crest,
          away_team_name,
          away_team_crest,
          status,
          minute,
          home_score,
          away_score,
          kickoff_at,
          updated_at
        FROM matches
        WHERE provider_match_id = $1

        UNION ALL

        SELECT 
          match_id AS provider_match_id,
          competition AS competition_name,
          home_team AS home_team_name,
          NULL AS home_team_crest,
          away_team AS away_team_name,
          NULL AS away_team_crest,
          status,
          COALESCE(match_minute::text, '') AS minute,
          home_score,
          away_score,
          COALESCE(kickoff_at, updated_at, NOW()) AS kickoff_at,
          updated_at
        FROM live_matches
        WHERE match_id = $1
      ) combined
      LIMIT 1
    `, [matchId]);

    if (dbMatch.rows.length === 0) return null;
    const m = dbMatch.rows[0];
    return {
      id: m.provider_match_id,
      status: m.status,
      utcDate: m.kickoff_at,
      venue: 'Unknown Stadium',
      competition: { name: m.competition_name },
      homeTeam: { name: m.home_team_name, crest: m.home_team_crest },
      awayTeam: { name: m.away_team_name, crest: m.away_team_crest },
      score: {
        fullTime: { home: m.home_score, away: m.away_score }
      }
    };
  } catch (err) {
    console.error('getMatchDetailsFromDB error:', err.message);
    return null;
  }
}

// GET /api/sports/matches/:id/details (venue, referees, H2H aggregates, recent matches)
app.get('/api/sports/matches/:id/details', async (req, res) => {
  const matchId = req.params.id;
  const apiKey = process.env.FOOTBALL_DATA_API_KEY || '0327f3b996a6499fb450bd012b939809';
  const isNumeric = /^\d+$/.test(matchId);

  // 1. Grasp Soccerway or non-numeric matches immediately via DB fallback
  if (!isNumeric) {
    const dbFallback = await getMatchDetailsFromDB(matchId);
    if (dbFallback) {
      return res.json({ match: dbFallback, h2h: null });
    }
    return res.status(404).json({ error: 'Match not found in local database' });
  }

  try {
    // 2. Football-Data numeric match - check cache first
    if (process.env.DATABASE_URL) {
      const cacheResult = await pool.query(
        `SELECT data FROM match_details_cache 
         WHERE match_id = $1 AND fetched_at >= NOW() - INTERVAL '15 minutes'`,
        [matchId]
      );
      if (cacheResult.rows.length > 0) {
        console.log(`Cache HIT for match details: ${matchId}`);
        return res.json(cacheResult.rows[0].data);
      }
    }

    // 3. Cache missed - fetch live data
    console.log(`Cache MISS for match details: ${matchId}. Fetching live...`);
    const matchRes = await fetch(`https://api.football-data.org/v4/matches/${matchId}`, {
      headers: { 'X-Auth-Token': apiKey }
    });

    if (!matchRes.ok) {
      // API call failed (e.g. rate limit, bad API key, or non-existent in FD API but numeric)
      // Fallback to local DB gracefully!
      console.warn(`Football-Data match details fetch failed with status ${matchRes.status}. Falling back to DB...`);
      const dbFallback = await getMatchDetailsFromDB(matchId);
      if (dbFallback) {
        return res.json({ match: dbFallback, h2h: null });
      }
      throw new Error(`Football-Data API returned status ${matchRes.status} and no DB fallback found`);
    }
    const matchData = await matchRes.json();

    // 4. Fetch head2head details
    let h2hData = null;
    try {
      const h2hRes = await fetch(`https://api.football-data.org/v4/matches/${matchId}/head2head`, {
        headers: { 'X-Auth-Token': apiKey }
      });
      if (h2hRes.ok) {
        h2hData = await h2hRes.json();
      }
    } catch (h2hErr) {
      console.warn(`H2H fetch failed for match ${matchId}:`, h2hErr.message);
    }

    const combinedResponse = {
      match: matchData,
      h2h: h2hData
    };

    // 5. Save to database cache table
    if (process.env.DATABASE_URL) {
      await pool.query(
        `INSERT INTO match_details_cache (match_id, data, fetched_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (match_id)
         DO UPDATE SET data = EXCLUDED.data, fetched_at = CURRENT_TIMESTAMP`,
        [matchId, JSON.stringify(combinedResponse)]
      ).catch(e => console.warn('Failed to save match details cache:', e.message));
    }

    res.json(combinedResponse);
  } catch (err) {
    console.error('Error fetching match details:', err.message);
    // Fall back to local DB as absolute last resort
    const dbFallback = await getMatchDetailsFromDB(matchId);
    if (dbFallback) {
      return res.json({ match: dbFallback, h2h: null });
    }
    res.status(500).json({ error: 'Failed to fetch match details' });
  }
});


// --- NEW AGGREGATOR ENDPOINTS ------------------------------------------------

// GET /api/search/suggest?q=
app.get('/api/search/suggest', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json([]);
  try {
    if (!process.env.DATABASE_URL) return res.json([]);
    const result = await pool.query(
      "SELECT 'rss-' || id AS id, title, category, image FROM rss_articles WHERE title ILIKE $1 ORDER BY published_at DESC LIMIT 6",
      ['%' + q + '%']
    );
    res.json(result.rows);
  } catch (err) { console.error('Suggest:', err.message); res.json([]); }
});

// POST /api/reactions/:id
app.post('/api/reactions/:id', async (req, res) => {
  const { id } = req.params;
  const { type, deviceId } = req.body;
  if (!['fire', 'heart', 'wow'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
  if (!deviceId) return res.status(400).json({ error: 'Device ID required' });
  
  try {
    if (!process.env.DATABASE_URL) return res.json({ [type]: 1 });
    
    // Check if this device has already reacted to this article
    const existing = await pool.query(
      "SELECT reaction_type FROM user_article_reactions WHERE device_id = $1 AND article_id = $2",
      [deviceId, id]
    );
    
    if (existing.rows.length > 0) {
      const prevType = existing.rows[0].reaction_type;
      if (prevType === type) {
        // Toggle off: User clicked the same reaction again, remove it
        await pool.query(
          "DELETE FROM user_article_reactions WHERE device_id = $1 AND article_id = $2",
          [deviceId, id]
        );
        // Decrease the count in article_reactions
        await pool.query(
          "UPDATE article_reactions SET count = GREATEST(0, count - 1) WHERE article_id = $1 AND reaction_type = $2",
          [id, type]
        );
      } else {
        // Update reaction: User changed their reaction (e.g. from fire to heart)
        await pool.query(
          "UPDATE user_article_reactions SET reaction_type = $1 WHERE device_id = $2 AND article_id = $3",
          [type, deviceId, id]
        );
        // Decrease the old reaction count
        await pool.query(
          "UPDATE article_reactions SET count = GREATEST(0, count - 1) WHERE article_id = $1 AND reaction_type = $2",
          [id, prevType]
        );
        // Increase the new reaction count
        await pool.query(
          "INSERT INTO article_reactions (article_id, reaction_type, count) VALUES ($1, $2, 1) ON CONFLICT (article_id, reaction_type) DO UPDATE SET count = article_reactions.count + 1",
          [id, type]
        );
      }
    } else {
      // New reaction: Insert reaction record
      await pool.query(
        "INSERT INTO user_article_reactions (device_id, article_id, reaction_type) VALUES ($1, $2, $3)",
        [deviceId, id, type]
      );
      // Increase the reaction count
      await pool.query(
        "INSERT INTO article_reactions (article_id, reaction_type, count) VALUES ($1, $2, 1) ON CONFLICT (article_id, reaction_type) DO UPDATE SET count = article_reactions.count + 1",
        [id, type]
      );
    }
    
    // Get updated counts
    const r = await pool.query("SELECT reaction_type, count FROM article_reactions WHERE article_id=$1", [id]);
    const c = { fire: 0, heart: 0, wow: 0 }; r.rows.forEach(x => { c[x.reaction_type] = parseInt(x.count); });
    
    // Also send back what the user's current reaction is (or null)
    const userReact = await pool.query(
      "SELECT reaction_type FROM user_article_reactions WHERE device_id = $1 AND article_id = $2",
      [deviceId, id]
    );
    const userReaction = userReact.rows.length > 0 ? userReact.rows[0].reaction_type : null;
    
    res.json({ counts: c, userReaction });
  } catch (err) { 
    console.error('Reaction:', err.message); 
    res.status(500).json({ error: 'Failed to process reaction' }); 
  }
});

// GET /api/reactions/:id
app.get('/api/reactions/:id', async (req, res) => {
  const { id } = req.params;
  const { deviceId } = req.query;
  try {
    if (!process.env.DATABASE_URL) return res.json({ fire: 0, heart: 0, wow: 0, userReaction: null });
    
    const r = await pool.query("SELECT reaction_type, count FROM article_reactions WHERE article_id=$1", [id]);
    const c = { fire: 0, heart: 0, wow: 0 }; r.rows.forEach(x => { c[x.reaction_type] = parseInt(x.count); });
    
    let userReaction = null;
    if (deviceId) {
      const userReact = await pool.query(
        "SELECT reaction_type FROM user_article_reactions WHERE device_id = $1 AND article_id = $2",
        [deviceId, id]
      );
      if (userReact.rows.length > 0) {
        userReaction = userReact.rows[0].reaction_type;
      }
    }
    
    res.json({ counts: c, userReaction });
  } catch (err) { 
    res.json({ fire: 0, heart: 0, wow: 0, userReaction: null }); 
  }
});

// GET /api/hashtags/trending
app.get('/api/hashtags/trending', async (req, res) => {
  try {
    if (!process.env.DATABASE_URL) return res.json([]);
    const result = await pool.query("SELECT title FROM rss_articles WHERE published_at > NOW() - INTERVAL '48 hours' LIMIT 300");
    const stop = new Set(['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'but', 'is', 'was', 'are', 'were', 'has', 'have', 'had', 'be', 'been', 'it', 'its', 'this', 'that', 'with', 'from', 'by', 'as', 'not', 'no', 'new', 'also', 'after', 'says', 'say', 'will', 'can', 'more', 'than', 'now', 'just', 'his', 'her', 'their', 'our', 'he', 'she', 'they', 'we', 'you', 'who', 'what', 'when', 'where', 'how']);
    const freq = {};
    result.rows.forEach(r => {
      (r.title || '').split(/\s+/).forEach(w => {
        const clean = w.replace(/[^a-zA-Z]/g, '').toLowerCase();
        if (clean.length > 3 && !stop.has(clean)) freq[clean] = (freq[clean] || 0) + 1;
      });
    });
    res.json(Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([tag, count]) => ({ tag, count })));
  } catch (err) { console.error('Hashtags:', err.message); res.json([]); }
});

// Cache for grouped stories to reduce heavy string processing and DB load
let groupedCache = { data: null, timestamp: 0 };
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// GET /api/stories/grouped
app.get('/api/stories/grouped', async (req, res) => {
  try {
    if (!process.env.DATABASE_URL) return res.json([]);

    // Return cached data if valid
    if (groupedCache.data && Date.now() - groupedCache.timestamp < CACHE_TTL) {
      return res.json(groupedCache.data);
    }

    const result = await pool.query("SELECT 'rss-' || id AS id, title, COALESCE(ai_summary, original_excerpt) AS excerpt, category, image, source_name AS author, external_link, published_at AS date FROM rss_articles WHERE image IS NOT NULL AND image != '' AND published_at > NOW() - INTERVAL '72 hours' ORDER BY published_at DESC LIMIT 200");
    const articles = result.rows;

    const groups = [];
    const used = new Set();
    const STOP_WORDS = new Set(['about', 'above', 'after', 'again', 'against', 'all', 'because', 'could', 'their', 'there', 'these', 'those', 'through', 'under', 'until', 'which', 'while', 'would', 'years', 'first', 'state', 'government', 'president']);

    for (const article of articles) {
      if (used.has(article.id)) continue;

      // Extract significant keywords
      const words = new Set(
        (article.title || '').toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter(w => w.length >= 4 && !STOP_WORDS.has(w))
      );

      const related = articles.filter(a => {
        if (a.id === article.id || used.has(a.id)) return false;
        const aWords = (a.title || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !STOP_WORDS.has(w));
        // Count matching significant keywords
        const matchCount = aWords.filter(w => words.has(w)).length;
        // Require at least 2 strong keyword matches for it to be the "same event"
        return matchCount >= 2;
      }).slice(0, 5);

      used.add(article.id);
      related.forEach(r => used.add(r.id));

      groups.push({
        headline: article,
        sources: related,
        coverage_count: related.length + 1,
        category: article.category
      });

      if (groups.length >= 20) break;
    }

    // Update cache
    groupedCache = { data: groups, timestamp: Date.now() };
    res.json(groups);
  } catch (err) {
    console.error('Grouping:', err.message);
    res.json(groupedCache.data || []); // Fallback to stale cache on error
  }
});

// GET /api/cron/feed-health?secret=xxx
// Called weekly by cron-job.org to validate all RSS feeds
const { runFeedHealthCheck } = require('./services/feedHealthChecker');
app.get('/api/cron/feed-health', async (req, res) => {
  const { secret } = req.query;
  if (secret !== CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Respond immediately — health checks take up to 20-30s which would timeout Vercel
  res.status(200).json({
    success: true,
    message: 'Weekly feed health validation started',
    timestamp: new Date().toISOString()
  });

  setImmediate(async () => {
    try {
      const result = await runFeedHealthCheck(pool);
      console.log(`✅ Weekly feed health check complete. Success: ${result.success}, Healthy: ${result.healthyCount}, Failed: ${result.failedCount}`);
    } catch (error) {
      console.error('❌ Feed health check task error:', error.message);
    }
  });
});

// GET /api/news/by-source?source=Vanguard
app.get('/api/news/by-source', async (req, res) => {
  const source = String(req.query.source || '').trim();
  if (!source) return res.status(400).json({ error: 'source required' });
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  try {
    if (!process.env.DATABASE_URL) return res.json([]);
    const result = await pool.query("SELECT 'rss-' || id AS id, title, COALESCE(ai_summary, original_excerpt) AS excerpt, category, image, source_name AS author, external_link, published_at AS date, content_type FROM rss_articles WHERE source_name ILIKE $1 ORDER BY published_at DESC LIMIT $2 OFFSET $3", ['%' + source + '%', limit, offset]);
    res.json(result.rows.map(r => ({ id: r.id, title: r.title, excerpt: r.excerpt, category: r.category, image: r.image, author: r.author, externalLink: r.external_link, date: r.date, contentType: r.content_type, source: 'rss' })));
  } catch (err) { console.error('By-source:', err.message); res.json([]); }
});

// Auto-create reactions table
if (process.env.DATABASE_URL) {
  pool.query("CREATE TABLE IF NOT EXISTS article_reactions (article_id TEXT NOT NULL, reaction_type TEXT NOT NULL, count INTEGER DEFAULT 0, PRIMARY KEY (article_id, reaction_type))").catch(e => console.warn('Reactions table:', e.message));

  // Auto-create notifications-related tables
  pool.query(`
    CREATE TABLE IF NOT EXISTS user_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(100),
      endpoint TEXT UNIQUE NOT NULL,
      p256dh TEXT,
      auth TEXT,
      topics TEXT[] DEFAULT '{}',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(e => console.warn('User subscriptions table creation failed:', e.message));

  pool.query(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id VARCHAR(100) PRIMARY KEY,
      categories JSONB DEFAULT '[]',
      topics JSONB DEFAULT '[]',
      notification_settings JSONB DEFAULT '{}',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(e => console.warn('User preferences table creation failed:', e.message));

  // Auto-create composite index for fast category-sorted queries
  pool.query(`
    CREATE INDEX IF NOT EXISTS idx_rss_articles_cat_pub 
    ON rss_articles (category, published_at DESC)
  `).catch(e => console.warn('Composite index creation failed:', e.message));

  // Auto-create match details cache table
  pool.query(`
    CREATE TABLE IF NOT EXISTS match_details_cache (
      match_id VARCHAR(100) PRIMARY KEY,
      data JSONB NOT NULL,
      fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(e => console.warn('Match details cache table creation failed:', e.message));
}
// Start live scraper and server when running locally or on Fly.io — NOT on Vercel serverless
if (!process.env.VERCEL) {
  try {
    console.log('🚀 Initializing persistent Soccerway live scores scraper...');
    require('./services/liveScraper');
  } catch (err) {
    console.error('❌ Failed to initialize Soccerway live scraper:', err.message);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Try POST /api/auth/login with username: admin, password: admin123`);
  });
}

module.exports = app;
