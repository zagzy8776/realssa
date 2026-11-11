/**
 * WebSub (PubSubHubbub) Service
 * Notifies Google's feed subscriber when new content is published.
 * This causes Google to re-fetch the RSS feed and discover new article URLs.
 * Free, no account required.
 */

const SITE_URL = 'https://realssanews.com.ng';
const HUB_URL = 'https://pubsubhubbub.appspot.com/publish';

/**
 * Notify the WebSub hub that the RSS feed has been updated.
 */
async function pingWebSub() {
  const feedUrl = `${SITE_URL}/rss/all.xml`;

  const body = new URLSearchParams({
    'hub.mode': 'publish',
    'hub.url': feedUrl
  });

  try {
    const response = await fetch(HUB_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(6000)
    });
    console.log(`✅ WebSub ping: HTTP ${response.status}`);
    return response.status;
  } catch (err) {
    console.error('❌ WebSub ping failed:', err.message);
    return null;
  }
}

module.exports = { pingWebSub };
