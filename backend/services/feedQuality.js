const { request } = require('./growthNetwork');
const { imageUrl } = require('./feedImages');
const { text } = require('./growthLogic');

// Quality scoring algorithm
function calculateQualityScore(article) {
  // Base score from source credibility (0-100)
  let score = article.source_credibility_score || 70;

  // Adjust for content quality
  score += (article.word_count || 0) * 0.01; // +1% per 100 words
  score += (article.image_count || 0) * 3; // +3 per image
  score += (article.video_count || 0) * 5; // +5 per video

  // Cap at 100
  score = Math.min(100, Math.max(0, score));

  // Apply penalties
  if (!article.image) score *= 0.95; // 5% penalty for no image
  if (!article.video) score *= 0.98; // 2% penalty for no video

  return Math.round(score * 100) / 100;
}

// Analyze article content quality
async function analyzeArticleQuality(article) {
  // Count words in title and excerpt
  const titleWords = text(article.title).split(/\(\p{L}\p{N}\){3,}/gu).length;
  const excerptWords = text(article.original_excerpt).split(/\(\p{L}\p{N}\){3,}/gu).length;

  // Count images
  const imageCount = (article.image ? 1 : 0) +
         (imageUrl(article.image) ? 1 : 0);

  // Count videos (simplified - would need actual video detection)
  const videoCount = article.video_url ? 1 : 0;

  return {
    word_count: titleWords + excerptWords,
    image_count: imageCount,
    video_count: videoCount,
    quality_score: calculateQualityScore({
      ...article,
      word_count: titleWords + excerptWords,
      image_count: imageCount,
      video_count: videoCount
    })
  };
}

// Update article quality metrics in database
async function updateArticleQuality(pool, articleId, metrics) {
  await pool.query(
    `UPDATE rss_articles
     SET word_count = $1,
         image_count = $2,
         video_count = $3,
         quality_score = $4
     WHERE id = $5`,
    [metrics.word_count, metrics.image_count, metrics.video_count, metrics.quality_score, articleId]
  );
}

// Batch analyze articles
async function analyzeArticles(pool, articleIds) {
  const results = [];
  for (const id of articleIds) {
    const article = await pool.query(
      `SELECT * FROM rss_articles WHERE id = $1`, [id]
    ).then(r => r.rows[0]);

    if (article) {
      const metrics = await analyzeArticleQuality(article);
      await updateArticleQuality(pool, id, metrics);
      results.push(metrics);
    }
  }
  return results;
}

module.exports = { calculateQualityScore, analyzeArticleQuality, updateArticleQuality, analyzeArticles };