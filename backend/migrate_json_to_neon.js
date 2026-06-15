/**
 * ======================================================
 * JSON → Neon PostgreSQL Data Migration Script
 * ======================================================
 * 
 * This script migrates your existing data from JSON files
 * to Neon PostgreSQL database.
 * 
 * Usage:
 *   1. Set DATABASE_URL env variable to your Neon connection string
 *   2. Run: node migrate_json_to_neon.js
 * ======================================================
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Neon PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Paths to JSON data files
const DATA_DIR = __dirname;
const usersFilePath = path.join(DATA_DIR, 'data', 'users.json');
const articlesFilePath = path.join(DATA_DIR, 'data', 'articles.json');
const commentsFilePath = path.join(DATA_DIR, 'data', 'comments.json');

// Helper to read JSON file
const readJsonFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
  }
  return [];
};

async function migrateUsers() {
  console.log('\n📦 Migrating Users...');
  const users = readJsonFile(usersFilePath);
  
  for (const user of users) {
    try {
      // Check if user already exists
      const existing = await pool.query(
        'SELECT id FROM users WHERE username = $1',
        [user.username]
      );
      
      if (existing.rows.length === 0) {
        // Hash password if it's plain text (like the default admin123)
        let password = user.password;
        if (!password.startsWith('$2a$') && !password.startsWith('$2b$')) {
          password = bcrypt.hashSync(password, 10);
        }
        
        await pool.query(
          `INSERT INTO users (username, password, is_admin)
           VALUES ($1, $2, $3)`,
          [user.username, password, user.isAdmin || false]
        );
        console.log(`  ✅ Migrated user: ${user.username}`);
      } else {
        console.log(`  ⏭️  User already exists: ${user.username}`);
      }
    } catch (err) {
      console.error(`  ❌ Error migrating user ${user.username}:`, err.message);
    }
  }
  console.log(`  ✅ Users migration complete. Total: ${users.length}`);
}

async function migrateArticles() {
  console.log('\n📦 Migrating Articles...');
  const articles = readJsonFile(articlesFilePath);
  
  for (const article of articles) {
    try {
      await pool.query(
        `INSERT INTO articles (title, excerpt, content, category, image, 
         read_time, author, source, external_link, featured, 
         status, content_type, date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT DO NOTHING`,
        [
          article.title || '',
          article.excerpt || '',
          article.content || '',
          article.category || 'general',
          article.image || '',
          article.readTime || '5 min read',
          article.author || 'Admin',
          article.source || 'static',
          article.externalLink || null,
          article.featured || false,
          article.status || 'published',
          article.contentType || 'article',
          article.date || new Date().toISOString()
        ]
      );
      console.log(`  ✅ Migrated article: ${article.title?.substring(0, 50)}...`);
    } catch (err) {
      console.error(`  ❌ Error migrating article:`, err.message);
    }
  }
  console.log(`  ✅ Articles migration complete. Total: ${articles.length}`);
}

async function migrateComments() {
  console.log('\n📦 Migrating Comments...');
  const comments = readJsonFile(commentsFilePath);
  
  for (const comment of comments) {
    try {
      // Try to find the article by its old ID (we store it as a mapping)
      // For now, we'll insert comments with article_id as a fallback
      await pool.query(
        `INSERT INTO comments (article_id, author, content, likes, date)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [
          parseInt(comment.articleId) || 0,
          comment.author || 'Anonymous',
          comment.content || '',
          comment.likes || 0,
          comment.date || new Date().toISOString()
        ]
      );
      console.log(`  ✅ Migrated comment by: ${comment.author}`);
    } catch (err) {
      console.error(`  ❌ Error migrating comment:`, err.message);
    }
  }
  console.log(`  ✅ Comments migration complete. Total: ${comments.length}`);
}

async function main() {
  console.log('========================================');
  console.log(' JSON → Neon PostgreSQL Migration');
  console.log('========================================\n');
  
  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Connected to Neon PostgreSQL\n');
    
    // Run migrations
    await migrateUsers();
    await migrateArticles();
    await migrateComments();
    
    console.log('\n========================================');
    console.log(' ✅ Migration Complete!');
    console.log('========================================');
    console.log('\nYour data has been migrated to Neon PostgreSQL.');
    console.log('Now update your server.js to use PostgreSQL instead of JSON files.\n');
    
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    console.log('\nMake sure your DATABASE_URL environment variable is set correctly.');
    console.log('Example:');
    console.log('  DATABASE_URL=postgresql://user:password@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require\n');
  } finally {
    await pool.end();
  }
}

main();