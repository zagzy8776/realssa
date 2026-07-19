/**
 * Buffer Social Media Integration
 * Auto-posts new RealSSA articles to Twitter/Facebook/Instagram via Buffer API
 *
 * Setup:
 *  1. Go to https://buffer.com → Settings → Apps & API → Create Access Token
 *  2. Get profile IDs: https://api.bufferapp.com/1/profiles.json?access_token=YOUR_TOKEN
 *  3. Set BUFFER_ACCESS_TOKEN and BUFFER_PROFILE_IDS in Railway env vars
 */

const BUFFER_ACCESS_TOKEN = process.env.BUFFER_ACCESS_TOKEN || process.env.BUFFER_S_TOKEN;
const BUFFER_PROFILE_IDS  = process.env.BUFFER_PROFILE_IDS  || process.env.BUFFER_FILE_IDS;

const BUFFER_API_BASE = 'https://api.bufferapp.com/1';

/**
 * Check if Buffer is configured with valid credentials.
 * @returns {boolean}
 */
function isBufferConfigured() {
  return !!(BUFFER_ACCESS_TOKEN && BUFFER_PROFILE_IDS);
}

/**
 * Fetch all connected Buffer social profiles.
 * Useful to verify the token and discover profile IDs.
 * @returns {Promise<Array>} List of profile objects
 */
async function getBufferProfiles() {
  if (!BUFFER_ACCESS_TOKEN) throw new Error('BUFFER_ACCESS_TOKEN not set');

  const res = await fetch(
    `${BUFFER_API_BASE}/profiles.json?access_token=${BUFFER_ACCESS_TOKEN}`,
    { method: 'GET' }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Buffer profiles API error (${res.status}): ${err}`);
  }

  return res.json();
}

/**
 * Post a social media update to all configured Buffer profiles.
 *
 * @param {string} text       - The social post body (Gemini-generated hook)
 * @param {string} link       - Article URL to attach
 * @param {string} [imageUrl] - Optional thumbnail image URL
 * @param {boolean} [now]     - If true, post immediately; if false, add to Buffer queue
 * @returns {Promise<boolean>} true on success
 */
async function postToBuffer(text, link, imageUrl, now = false) {
  if (!isBufferConfigured()) {
    console.log('[Buffer] Not configured — skipping social post. Set BUFFER_ACCESS_TOKEN and BUFFER_PROFILE_IDS.');
    return false;
  }

  const profileIds = BUFFER_PROFILE_IDS.split(',').map(id => id.trim()).filter(Boolean);
  if (profileIds.length === 0) {
    console.warn('[Buffer] BUFFER_PROFILE_IDS is empty — skipping.');
    return false;
  }

  // Truncate text to Twitter's 280 char limit (minus URL length ~23 chars)
  const safeText = text.length > 255 ? text.slice(0, 252) + '…' : text;

  const results = await Promise.allSettled(
    profileIds.map(profileId => _postToProfile(profileId, safeText, link, imageUrl, now))
  );

  const succeeded = results.filter(r => r.status === 'fulfilled' && r.value).length;
  const failed    = results.length - succeeded;

  if (succeeded > 0) {
    console.log(`[Buffer] ✅ Posted to ${succeeded}/${profileIds.length} profiles.`);
  }
  if (failed > 0) {
    console.warn(`[Buffer] ⚠️ Failed for ${failed}/${profileIds.length} profiles.`);
  }

  return succeeded > 0;
}

/**
 * Internal: post to a single Buffer profile.
 */
async function _postToProfile(profileId, text, link, imageUrl, now) {
  try {
    const endpoint = now
      ? `${BUFFER_API_BASE}/updates/create.json`
      : `${BUFFER_API_BASE}/updates/create.json`;

    const formData = new URLSearchParams();
    formData.append('access_token',    BUFFER_ACCESS_TOKEN);
    formData.append('profile_ids[]',   profileId);
    formData.append('text',            text);
    if (now) formData.append('now',    'true');

    // Attach article link and image as media
    if (link)     formData.append('media[link]',      link);
    if (imageUrl) formData.append('media[picture]',   imageUrl);
    if (imageUrl) formData.append('media[thumbnail]', imageUrl);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Buffer] API error for profile ${profileId} (${res.status}):`, errText);
      return false;
    }

    const data = await res.json();
    if (!data.success) {
      console.error(`[Buffer] Post rejected for profile ${profileId}:`, data);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`[Buffer] Network error for profile ${profileId}:`, err.message);
    return false;
  }
}

/**
 * Test the Buffer connection by fetching profiles.
 * Called by the /api/buffer/test endpoint in server.js
 */
async function testBufferConnection() {
  if (!isBufferConfigured()) {
    return {
      ok: false,
      configured: false,
      message: 'Buffer not configured. Set BUFFER_ACCESS_TOKEN and BUFFER_PROFILE_IDS in Railway env vars.',
    };
  }

  try {
    const profiles = await getBufferProfiles();
    const profileIds = BUFFER_PROFILE_IDS.split(',').map(id => id.trim()).filter(Boolean);

    return {
      ok: true,
      configured: true,
      profileCount: profiles.length,
      configuredIds: profileIds.length,
      profiles: profiles.map(p => ({
        id:       p.id,
        service:  p.service,
        handle:   p.service_username,
        paused:   p.paused,
        connected: profileIds.includes(p.id),
      })),
      message: `✅ Buffer connected — ${profiles.length} social profile(s) found.`,
    };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      message: `❌ Buffer token error: ${err.message}`,
    };
  }
}

module.exports = { postToBuffer, testBufferConnection, getBufferProfiles, isBufferConfigured };
