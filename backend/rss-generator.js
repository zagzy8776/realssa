/**
 * RSS Feed Generator Service
 * Dynamically queries PostgreSQL (rss_articles) and builds RSS 2.0 XML feeds
 * for syndication across third-party websites, news readers, and aggregators.
 */

const SITE_URL = 'https://realssanews.com.ng';

/**
 * Generate RSS XML feed for a category from PostgreSQL
 * @param {object} pool - PostgreSQL pool connection
 * @param {string} category - Category slug ('all', 'latest', 'nigerian-news', 'sports', etc.)
 * @returns {Promise<string>} Valid RSS 2.0 XML string
 */
async function generateRSSFeedFromDB(pool, category = 'latest') {
  let articles = [];

  if (pool) {
    try {
      let queryStr = `
        SELECT 'rss-' || id as id, title, COALESCE(ai_summary, original_excerpt) AS description,
               category, image, external_link, source_name, published_at
        FROM rss_articles
      `;
      let params = [];

      if (category !== 'all' && category !== 'latest') {
        queryStr += ` WHERE category = $1`;
        params.push(category);
      }

      queryStr += ` ORDER BY published_at DESC LIMIT 30`;

      const res = await pool.query(queryStr, params);
      articles = res.rows;
    } catch (err) {
      console.error('[RSS Generator] Database query error:', err.message);
    }
  }

  const items = articles.map(article => {
    const pubDate = article.published_at ? new Date(article.published_at).toUTCString() : new Date().toUTCString();
    const articleUrl = `${SITE_URL}/article/${article.id}`;
    const mediaTag = article.image && !/logo|icon/i.test(article.image)
      ? `<media:content url="${escapeXml(article.image)}" medium="image"/>`
      : '';

    return `
    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${articleUrl}</link>
      <guid isPermaLink="true">${articleUrl}</guid>
      <description>${escapeXml(article.description || '')}</description>
      <pubDate>${pubDate}</pubDate>
      <category>${escapeXml(article.category || 'General')}</category>
      <source url="${escapeXml(article.external_link || '')}">${escapeXml(article.source_name || 'RealSSA News')}</source>
      ${mediaTag}
    </item>`;
  }).join('\n');

  const feedTitle = category === 'all' || category === 'latest'
    ? 'RealSSA News - Breaking News & Top Headlines'
    : `RealSSA News - ${category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ')}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escapeXml(feedTitle)}</title>
    <link>${SITE_URL}</link>
    <description>Africa's leading digital news network — breaking Nigerian news, sports, business, and global headlines.</description>
    <language>en-ng</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss/${category}.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${SITE_URL}/logo.png</url>
      <title>RealSSA News</title>
      <link>${SITE_URL}</link>
    </image>
    ${items}
  </channel>
</rss>`;
}

function escapeXml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = { generateRSSFeedFromDB };
