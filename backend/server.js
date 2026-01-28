require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const cors = require('cors');
app.use(cors());
app.use(express.json());

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

// Start server
const port = process.env.PORT || 8080;
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
  console.log(`Try POST /api/auth/login with username: admin, password: admin123`);
});
