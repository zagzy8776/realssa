/**
 * Master Search Engine & Indexing Controller
 * Orchestrates real-time indexing commands across Google, Bing, Yandex, and RSS Hubs
 */

const { pingGoogleIndexingAPI } = require('./googleIndexing');
const { pingIndexNow } = require('./indexnow');
const { pingWebSub } = require('./websub');

const SITE_URL = 'https://realssanews.com.ng';

/**
 * Dispatch priority indexing commands to all major search engine bots simultaneously.
 * @param {Array<string>} articleIds - Array of article IDs (e.g., ['rss-101', 'rss-102'])
 * @param {Array<string>} [rawUrls]   - Optional array of absolute URLs
 */
async function dispatchIndexingCommand(articleIds = [], rawUrls = []) {
  const fullUrls = [
    ...rawUrls,
    ...articleIds.map(id => `${SITE_URL}/article/${id}`)
  ];

  if (fullUrls.length === 0) return;

  console.log(`🚀 [Master Indexing Controller] Dispatching crawler commands for ${fullUrls.length} URL(s)...`);

  const tasks = [
    // 1. Command Bing, Yandex, Seznam & Naver via IndexNow API
    pingIndexNow(fullUrls)
      .then(status => {
        if (status) console.log(`[Master Controller] IndexNow (Bing/Yandex): HTTP ${status}`);
      })
      .catch(err => console.error('[Master Controller] IndexNow error:', err.message)),

    // 2. Command RSS & Web Subscribers via WebSub Protocol
    pingWebSub()
      .then(() => console.log('[Master Controller] WebSub Hub pinged successfully'))
      .catch(err => console.error('[Master Controller] WebSub error:', err.message)),

    // 3. Command Googlebot via Google Indexing API (up to 20 articles per batch)
    ...articleIds.slice(0, 20).map(id =>
      pingGoogleIndexingAPI(id)
        .then(status => {
          if (status) console.log(`[Master Controller] Googlebot Direct Ping (${id}): HTTP ${status}`);
        })
        .catch(err => console.error(`[Master Controller] Googlebot Ping Error (${id}):`, err.message))
    )
  ];

  const results = await Promise.allSettled(tasks);
  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  console.log(`✅ [Master Indexing Controller] Dispatched ${succeeded}/${results.length} crawler tasks.`);
}

module.exports = { dispatchIndexingCommand };
