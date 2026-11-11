/**
 * Google Indexing API Service
 * Submits new article URLs directly to Google's index — pages appear in minutes, not weeks.
 *
 * SETUP (one-time, free):
 * 1. Go to https://console.cloud.google.com and create a project
 * 2. Enable the "Web Search Indexing API" on that project
 * 3. Create a Service Account: IAM & Admin → Service Accounts → Create
 * 4. Download the JSON key file for that service account
 * 5. In Google Search Console (search.google.com/search-console):
 *    Settings → Users and permissions → Add the service account email as an OWNER
 * 6. Set GOOGLE_INDEXING_CREDENTIALS env var to the entire JSON key file contents
 * 7. Limit: 200 free URL submissions per day
 */

const SITE_URL = 'https://realssanews.com.ng';
const DAILY_LIMIT = 180; // stay under 200 limit
let dailyCount = 0;
let lastReset = new Date().toDateString();

function resetDailyCountIfNeeded() {
  const today = new Date().toDateString();
  if (today !== lastReset) {
    dailyCount = 0;
    lastReset = today;
  }
}

let tokenPromise = null;
let tokenExpiry = 0;

/**
 * Get a Google auth token using service account credentials.
 */
async function getGoogleAuthToken() {
  const credentials = process.env.GOOGLE_INDEXING_CREDENTIALS;
  if (!credentials) return null;

  // Use cached token if valid
  if (tokenPromise && Date.now() < tokenExpiry) {
    return tokenPromise;
  }

  // Otherwise, fetch a new one and cache the promise to handle concurrent requests cleanly
  tokenExpiry = Date.now() + 3500 * 1000; // 58 minutes
  tokenPromise = (async () => {
    try {
      const creds = JSON.parse(credentials);
      const now = Math.floor(Date.now() / 1000);
      const claim = {
        iss: creds.client_email,
        scope: 'https://www.googleapis.com/auth/indexing',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600
      };

      // Build JWT manually (no external deps needed)
      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify(claim)).toString('base64url');
      const signingInput = `${header}.${payload}`;

      const crypto = require('crypto');
      const sign = crypto.createSign('RSA-SHA256');
      sign.update(signingInput);
      const signature = sign.sign(creds.private_key, 'base64url');
      const jwt = `${signingInput}.${signature}`;

      // Exchange JWT for access token
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: jwt
        }),
        signal: AbortSignal.timeout(8000)
      });

      if (!tokenRes.ok) {
        tokenPromise = null;
        return null;
      }
      const tokenData = await tokenRes.json();
      return tokenData.access_token || null;
    } catch (err) {
      console.error('Google auth error:', err.message);
      tokenPromise = null;
      return null;
    }
  })();

  return tokenPromise;
}

/**
 * Submit a single article URL to Google's Indexing API.
 * @param {string} articleId - The article ID (e.g., 'rss-123' or '45')
 */
async function pingGoogleIndexingAPI(articleId) {
  resetDailyCountIfNeeded();

  if (dailyCount >= DAILY_LIMIT) {
    console.log('Google Indexing API: daily limit reached, skipping');
    return null;
  }

  if (!process.env.GOOGLE_INDEXING_CREDENTIALS) {
    return null; // silently skip if not configured
  }

  const url = `${SITE_URL}/article/${articleId}`;
  const token = await getGoogleAuthToken();
  if (!token) return null;

  try {
    const response = await fetch(
      'https://indexing.googleapis.com/v3/urlNotifications:publish',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ url, type: 'URL_UPDATED' }),
        signal: AbortSignal.timeout(6000)
      }
    );
    dailyCount++;
    console.log(`✅ Google Indexing API: HTTP ${response.status} for ${url} (${dailyCount}/${DAILY_LIMIT} today)`);
    return response.status;
  } catch (err) {
    console.error('❌ Google Indexing API failed:', err.message);
    return null;
  }
}

module.exports = { pingGoogleIndexingAPI };
