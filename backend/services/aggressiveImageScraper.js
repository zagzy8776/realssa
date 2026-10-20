/**
 * Aggressive Image Scraper for News Sites
 * 
 * Handles sites like Punch News that hide article images behind:
 * - Picture tags with multiple sources
 * - Lazy-loaded images (data-src, data-lazy-src)
 * - CDN URLs with custom parameters
 * - Image galleries and carousels
 * - Featured images in custom attributes
 * 
 * Goals:
 * 1. Skip Punch logos/placeholders aggressively
 * 2. Find ACTUAL article images
 * 3. Prioritize high-resolution versions
 * 4. Handle relative URLs correctly
 */

const LOG = {
  info: (m) => console.log(`[AggressiveImageScraper] ${m}`),
  warn: (m) => console.warn(`[AggressiveImageScraper] ${m}`),
};

// Patterns that 100% indicate logo/branding (NOT article images)
const DEFINITE_LOGO_PATTERNS = /logo|favicon|icon|brand|watermark|badge|sprite|admin[-_]?bar|navigation|header[-_]?image|footer[-_]?image|sidebar[-_]?ad|placeholder|default[-_]?image|empty[-_]?image|no[-_]?image|coming[-_]?soon/i;

// Punch-specific logo patterns - only match actual logo files, not all punchng URLs
const PUNCH_LOGO_PATTERNS = /cropped-punch|PUNCH-Logo|punch-ng-logo|punchng.*logo|punch.*brand|punchng.*default/i;

/**
 * Aggressively score an image URL for likelihood of being an actual article image
 * Returns score 0-100 (higher = more likely to be article image)
 */
function scoreImageLikelihood(url, articleTitle = '') {
  if (!url || typeof url !== 'string') return 0;
  if (!url.startsWith('http')) return 0;
  
  let score = 50; // Base score
  
  // Definite logo/branding → 0
  if (DEFINITE_LOGO_PATTERNS.test(url)) return 0;
  if (PUNCH_LOGO_PATTERNS.test(url)) return 0;
  if (url.includes('data:')) return 0;
  
  // High resolution indicators
  if (url.includes('1200') || url.includes('1080') || url.includes('1024') || url.includes('1920')) score += 20;
  if (url.includes('800') || url.includes('720') || url.includes('600')) score += 15;
  if (url.includes('large') || url.includes('full') || url.includes('hd') || url.includes('high')) score += 15;
  
  // Low resolution = probably thumbnail
  if (url.includes('200') || url.includes('300') || url.includes('400') || url.includes('thumb') || url.includes('small')) score -= 20;
  
  // CDN indicators (usually article images)
  if (url.includes('cdn') || url.includes('cloudinary') || url.includes('imgix') || url.includes('akamai')) score += 10;
  
  // Featured image indicators
  if (url.includes('featured') || url.includes('hero') || url.includes('cover') || url.includes('main[-_]image')) score += 15;
  
  // Article/post indicator
  if (url.includes('article') || url.includes('post') || url.includes('story') || url.includes('news')) score += 10;
  
  // Photo/image keywords
  if (url.includes('photo') || url.includes('picture') || url.includes('image') || url.includes('jpg') || url.includes('jpeg') || url.includes('png')) score += 5;
  
  // Bad indicators
  if (url.includes('ad') || url.includes('banner') || url.includes('promo')) score -= 10;
  if (url.includes('analytics') || url.includes('pixel') || url.includes('tracking')) score = 0;
  
  return Math.min(100, Math.max(0, score));
}

/**
 * Extract ALL candidate images from HTML, not just the first match
 */
function extractAllImages(html, baseUrl) {
  const images = [];
  
  // 1. og:image tags
  const ogPatterns = [
    /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"'>]+)["']/gi,
    /<meta[^>]*content=["']([^"'>]+)["'][^>]*property=["']og:image["']/gi
  ];
  for (const pattern of ogPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      images.push({ url: match[1], source: 'og:image' });
    }
  }
  
  // 2. twitter:image tags
  const twitterPatterns = [
    /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"'>]+)["']/gi,
    /<meta[^>]*content=["']([^"'>]+)["'][^>]*name=["']twitter:image["']/gi
  ];
  for (const pattern of twitterPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      images.push({ url: match[1], source: 'twitter:image' });
    }
  }
  
  // 3. Picture tags (modern approach)
  const picturePattern = /<picture[^>]*>.*?<\/picture>/gis;
  let pictureMatch;
  while ((pictureMatch = picturePattern.exec(html)) !== null) {
    const sourcePattern = /<source[^>]*srcset=["']([^"'>]+)["']/gi;
    let sourceMatch;
    while ((sourceMatch = sourcePattern.exec(pictureMatch[0])) !== null) {
      // srcset can contain multiple URLs
      sourceMatch[1].split(',').forEach(src => {
        const url = src.trim().split(/\s+/)[0]; // Get URL before size descriptor
        images.push({ url, source: 'picture>source' });
      });
    }
    // Also get img src if present
    const imgPattern = /<img[^>]*src=["']([^"'>]+)["']/i;
    const imgMatch = pictureMatch[0].match(imgPattern);
    if (imgMatch) images.push({ url: imgMatch[1], source: 'picture>img' });
  }
  
  // 4. Lazy-loaded images (data-src, data-lazy-src)
  const lazyPatterns = [
    /data-src=["']([^"'>]+)["']/gi,
    /data-lazy-src=["']([^"'>]+)["']/gi,
    /data-image=["']([^"'>]+)["']/gi,
    /data-src-full=["']([^"'>]+)["']/gi
  ];
  for (const pattern of lazyPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      images.push({ url: match[1], source: 'lazy-load' });
    }
  }
  
  // 5. Regular img tags
  const imgPattern = /<img[^>]*src=["']([^"'>]+)["']/gi;
  let imgMatch;
  while ((imgMatch = imgPattern.exec(html)) !== null) {
    images.push({ url: imgMatch[1], source: 'img-src' });
  }
  
  // 6. Background images in style attributes
  const bgPattern = /style=["']([^"']*background-image:\s*url\(["']?([^)'"]+)["']?\)[^"']*)["']/gi;
  let bgMatch;
  while ((bgMatch = bgPattern.exec(html)) !== null) {
    images.push({ url: bgMatch[2], source: 'background-image' });
  }
  
  // 7. Content attribute with image  
  const contentPattern = /content=["']([^"'>]+\.(jpg|jpeg|png|webp))["']/gi;
  let contentMatch;
  while ((contentMatch = contentPattern.exec(html)) !== null) {
    images.push({ url: contentMatch[1], source: 'content-attr' });
  }
  
  // Normalize URLs
  return images
    .map(img => ({
      ...img,
      url: normalizeUrl(img.url, baseUrl)
    }))
    .filter(img => img.url); // Remove failed normalizations
}

/**
 * Normalize relative URLs to absolute
 */
function normalizeUrl(url, baseUrl) {
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
  // Relative path
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return null;
  }
}

/**
 * Main function: Find best article image from URL
 */
async function findBestArticleImage(articleUrl, htmlContent = null, articleTitle = '') {
  try {
    // Fetch HTML if not provided
    let html = htmlContent;
    if (!html) {
      const res = await fetch(articleUrl, {
        signal: AbortSignal.timeout(8000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RealSSABot/1.0; +https://realssanews.com.ng)'
        }
      });
      if (!res.ok) return null;
      html = await res.text();
    }
    
    // Extract all candidate images
    const candidates = extractAllImages(html, articleUrl);
    
    if (candidates.length === 0) {
      LOG.warn(`No images found for ${articleUrl}`);
      return null;
    }
    
    // Score each candidate
    const scored = candidates.map(img => ({
      ...img,
      score: scoreImageLikelihood(img.url, articleTitle)
    }));
    
    // Filter out definite non-images
    const viable = scored.filter(img => img.score > 10);
    
    if (viable.length === 0) {
      LOG.warn(`All ${candidates.length} images scored too low for ${articleUrl}`);
      return null;
    }
    
    // Sort by score descending, then by source priority
    const SOURCE_PRIORITY = {
      'og:image': 100,
      'twitter:image': 90,
      'featured-image': 85,
      'picture>img': 80,
      'lazy-load': 75,
      'img-src': 60,
      'background-image': 50,
      'content-attr': 40
    };
    
    viable.sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;
      const aPrio = SOURCE_PRIORITY[a.source] || 0;
      const bPrio = SOURCE_PRIORITY[b.source] || 0;
      return bPrio - aPrio;
    });
    
    const best = viable[0];
    LOG.info(`Best image for ${articleUrl.substring(0, 50)}...: ${best.url.substring(0, 60)}... (score: ${best.score}, source: ${best.source})`);
    
    return best.url;
  } catch (err) {
    LOG.warn(`Error finding image for ${articleUrl}: ${err.message}`);
    return null;
  }
}

module.exports = {
  findBestArticleImage,
  scoreImageLikelihood,
  extractAllImages,
  normalizeUrl,
  DEFINITE_LOGO_PATTERNS,
  PUNCH_LOGO_PATTERNS,
};
