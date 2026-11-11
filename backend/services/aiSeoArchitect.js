/**
 * AI SEO & Rich Schema Architect Agent (aiSeoArchitect.js)
 * 
 * Features:
 * 1. Rich JSON-LD Structured Data: Generates NewsArticle & ClaimReview schema
 *    for Google News, Google Discover, and Bing Rich Snippets.
 * 2. Dynamic OpenGraph & Meta Tag Generator: Constructs meta descriptions,
 *    canonical links, twitter cards, and social thumbnail metadata.
 */

const SITE_URL = 'https://realssanews.com.ng';

/**
 * Generate JSON-LD NewsArticle schema object for an article
 * @param {object} article - Article object
 * @returns {object} Valid Schema.org JSON-LD object
 */
function generateNewsArticleSchema(article) {
  if (!article) return null;

  const articleId = article.id || 'article';
  const canonicalUrl = `${SITE_URL}/article/${articleId}`;
  const headline = (article.title || 'Breaking News').slice(0, 110);
  const description = (article.ai_summary || article.original_excerpt || article.description || article.title || '').slice(0, 200);
  const publishedDate = article.published_at ? new Date(article.published_at).toISOString() : new Date().toISOString();
  
  const logoUrl = `${SITE_URL}/logo.png`;
  const imageUrl = (article.image && !/logo|icon|placeholder/i.test(article.image))
    ? article.image
    : logoUrl;

  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    'mainEntityOfPage': {
      '@type': 'WebPage',
      '@id': canonicalUrl
    },
    'headline': headline,
    'description': description,
    'image': [imageUrl],
    'datePublished': publishedDate,
    'dateModified': publishedDate,
    'author': {
      '@type': 'Organization',
      'name': article.source_name || article.author || 'RealSSA News',
      'url': SITE_URL
    },
    'publisher': {
      '@type': 'Organization',
      'name': 'RealSSA News',
      'logo': {
        '@type': 'ImageObject',
        'url': logoUrl
      }
    },
    'articleSection': article.category || 'General',
    'inLanguage': 'en-NG'
  };
}

/**
 * Generate full HTML meta tags and JSON-LD script string for server rendering
 * @param {object} article - Article object
 * @returns {string} HTML string containing meta tags and JSON-LD <script> block
 */
function generateSeoHtmlHead(article) {
  if (!article) return '';

  const schemaObj = generateNewsArticleSchema(article);
  const headline = (article.title || 'RealSSA News').replace(/"/g, '&quot;');
  const description = (article.ai_summary || article.original_excerpt || article.title || '').slice(0, 160).replace(/"/g, '&quot;');
  const canonicalUrl = `${SITE_URL}/article/${article.id}`;
  const imageUrl = (article.image && !/logo|icon|placeholder/i.test(article.image)) ? article.image : `${SITE_URL}/logo.png`;

  return `
    <!-- Primary Meta Tags -->
    <title>${headline} | RealSSA News</title>
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${canonicalUrl}" />

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:title" content="${headline}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:site_name" content="RealSSA News" />

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${canonicalUrl}" />
    <meta name="twitter:title" content="${headline}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${imageUrl}" />

    <!-- Schema.org JSON-LD for Google News & Discover -->
    <script type="application/ld+json">
      ${JSON.stringify(schemaObj, null, 2)}
    </script>
  `;
}

module.exports = { generateNewsArticleSchema, generateSeoHtmlHead };
