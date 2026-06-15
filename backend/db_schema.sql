-- ======================================================
-- EntertainmentGHC Database Schema for Neon PostgreSQL
-- Run this in Neon SQL Editor to create your tables
-- ======================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Articles table
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
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    article_id INTEGER NOT NULL,
    author VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    likes INTEGER DEFAULT 0,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_date ON articles(date DESC);
CREATE INDEX IF NOT EXISTS idx_articles_featured ON articles(featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_comments_article_id ON comments(article_id);

-- Insert default admin user (password: admin123)
-- The password is bcrypt-hashed. You can change this after first login.
INSERT INTO users (username, password, is_admin)
SELECT 'admin', '$2a$10$8KzQMGx5C5H5X5Y5Z5a5Oe5i5o5u5v5w5x5y5z5A5B5C5D5E5F5G', true
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');