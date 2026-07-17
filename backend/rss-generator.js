const fs = require('fs');
const path = require('path');

// Read articles from your database
function getArticles() {
  try {
    const articlesPath = path.join(__dirname, 'data', 'articles.json');
    const data = fs.readFileSync(articlesPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading articles:', error);
    return [];
  }
}

// Generate RSS XML
function generateRSSFeed(category = 'all') {
  const articles = getArticles();
  
  // Filter by category if specified
  const filtered = category === 'all' 
    ? articles.slice(0, 20)  // Last 20 articles
    : articles.filter(a => {
        const articleCategory = (a.category || '').toLowerCase();
        const searchCategory = category.toLowerCase();
        return articleCategory === searchCategory || 
               articleCategory.includes(searchCategory);
      }).slice(0, 20);
  
  // Build RSS items
  const items = filtered.map(article => `
    <item>
      <title>${escapeXml(article.title)}</title>
      <link>https://realssa.vercel.app/article/${article.id}</link>
      <guid isPermaLink="true">https://realssa.vercel.app/article/${article.id}</guid>
      <description>${escapeXml(article.excerpt || article.description || article.summary || '')}</description>
      <pubDate>${formatDate(article.date)}</pubDate>
      <category>${escapeXml(article.category || 'General')}</category>
      <source url="${escapeXml(article.externalLink || '')}">${escapeXml(article.source || 'Realssa News')}</source>
    </item>
  `).join('');

  // Full RSS XML
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Realssa News - ${category === 'all' ? 'All News' : category.charAt(0).toUpperCase() + category.slice(1)}</title>
    <link>https://realssa.vercel.app</link>
    <description>Latest African news curated from top sources - Nigeria, Ghana, Kenya, South Africa, and worldwide entertainment, sports, and culture.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="https://realssa.vercel.app/rss/${category}.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>https://realssa.vercel.app/logo.png</url>
      <title>Realssa News</title>
      <link>https://realssa.vercel.app</link>
    </image>
    ${items}
  </channel>
</rss>`;
}

// Format date to RFC 822 format
function formatDate(dateString) {
  if (!dateString) return new Date().toUTCString();
  try {
    return new Date(dateString).toUTCString();
  } catch {
    return new Date().toUTCString();
  }
}

// Escape special XML characters
function escapeXml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&apos;');
}

module.exports = { generateRSSFeed };
