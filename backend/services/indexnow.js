/**
 * IndexNow Service
 * Pings Bing, Yandex, and other search engines instantly when new articles are published.
 * Free, no account required. Key is verified via a .txt file on the domain.
 */

const INDEXNOW_KEY = process.env.INDEXNOW_KEY || 'realssanews2026a8f3b4c5d6e7f89012';
const SITE_HOST = 'realssanews.com.ng';
const SITE_URL = 'https://realssanews.com.ng';

/**
 * Ping IndexNow with a batch of URLs.
 * @param {string[]} urls - Array of full URLs to submit
 */
async function pingIndexNow(urls) {
  if (!urls || urls.length === 0) return;

  const urlList = Array.isArray(urls) ? urls.slice(0, 10000) : [urls];

  const body = {
    host: SITE_HOST,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
    urlList
  };

  try {
    const response = await fetch('https://api.indexnow.org/IndexNow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(6000)
    });
    console.log(`✅ IndexNow ping: HTTP ${response.status} for ${urlList.length} URLs`);
    return response.status;
  } catch (err) {
    console.error('❌ IndexNow ping failed:', err.message);
    return null;
  }
}

module.exports = { pingIndexNow, INDEXNOW_KEY };
