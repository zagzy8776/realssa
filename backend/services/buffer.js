/**
 * Buffer Social Media Integration (GraphQL API)
 * Auto-posts new RealSSA articles to Twitter/Facebook/Instagram via Buffer API
 *
 * Setup:
 *  1. Go to https://publish.buffer.com/settings/api?tab=personal-keys → Create Personal Key
 *  2. Get profile/channel IDs: Run the test endpoint GET /api/cron/ingest or /api/buffer/test
 *  3. Set BUFFER_ACCESS_TOKEN and BUFFER_PROFILE_IDS in Fly.io secrets (fly secrets set KEY=VALUE)
 */

const BUFFER_ACCESS_TOKEN = process.env.BUFFER_ACCESS_TOKEN || process.env.BUFFER_S_TOKEN;
const BUFFER_PROFILE_IDS  = process.env.BUFFER_PROFILE_IDS  || process.env.BUFFER_FILE_IDS;

const BUFFER_API_ENDPOINT = 'https://api.buffer.com/graphql';

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

  // Step 1: Get Organizations
  const orgQuery = {
    query: `
      query GetOrganizations {
        account {
          organizations {
            id
            name
          }
        }
      }
    `
  };

  const orgRes = await fetch(BUFFER_API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${BUFFER_ACCESS_TOKEN}`
    },
    body: JSON.stringify(orgQuery)
  });

  if (!orgRes.ok) {
    const err = await orgRes.text();
    throw new Error(`Buffer API error fetching organizations (${orgRes.status}): ${err}`);
  }

  const orgData = await orgRes.json();
  if (orgData.errors) {
    throw new Error(`Buffer GraphQL error fetching organizations: ${orgData.errors[0].message}`);
  }

  const orgs = orgData?.data?.account?.organizations || [];
  if (orgs.length === 0) {
    return [];
  }

  const allChannels = [];

  // Step 2: Fetch channels for all organizations
  for (const org of orgs) {
    const channelsQuery = {
      query: `
        query GetChannels($orgId: OrganizationId!) {
          channels(input: { organizationId: $orgId }) {
            id
            name
            service
          }
        }
      `,
      variables: {
        orgId: org.id
      }
    };

    const chanRes = await fetch(BUFFER_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BUFFER_ACCESS_TOKEN}`
      },
      body: JSON.stringify(channelsQuery)
    });

    if (chanRes.ok) {
      const chanData = await chanRes.json();
      if (chanData.data && chanData.data.channels) {
        allChannels.push(...chanData.data.channels);
      }
    }
  }

  return allChannels;
}

/**
 * Post a social media update to all configured Buffer profiles.
 * Sends platform-specific text to each channel.
 *
 * @param {object} hooks      - { twitter, instagram, facebook } platform texts
 * @param {string} link       - Article URL (appended to twitter/facebook only)
 * @param {string} [imageUrl] - Optional thumbnail image URL
 * @param {boolean} [now]     - If true, post immediately; if false, add to Buffer queue
 * @returns {Promise<boolean>} true on success
 */
async function postToBuffer(hooks, link, imageUrl, now = false) {
  if (!isBufferConfigured()) {
    console.log('[Buffer] Not configured — skipping social post.');
    return false;
  }

  // Support legacy callers that pass a plain string
  if (typeof hooks === 'string') {
    hooks = { twitter: hooks, instagram: hooks, facebook: hooks };
  }

  const profileIds = BUFFER_PROFILE_IDS.split(',').map(id => id.trim()).filter(Boolean);

  // Ensure Instagram ID is always included
  const INSTAGRAM_ID = '6a5c8546e2638b94d7959a2c';
  if (!profileIds.includes(INSTAGRAM_ID)) profileIds.push(INSTAGRAM_ID);

  if (profileIds.length === 0) {
    console.warn('[Buffer] BUFFER_PROFILE_IDS is empty — skipping.');
    return false;
  }

  console.log(`[Buffer] Posting to ${profileIds.length} profiles: ${profileIds.join(', ')}`);

  const results = await Promise.allSettled(
    profileIds.map(profileId => _postToProfile(profileId, hooks, link, imageUrl, now))
  );

  const succeeded = results.filter(r => r.status === 'fulfilled' && r.value).length;
  const failed    = results.length - succeeded;

  if (succeeded > 0) console.log(`[Buffer] ✅ Posted to ${succeeded}/${profileIds.length} profiles.`);
  if (failed > 0)    console.warn(`[Buffer] ⚠️ Failed for ${failed}/${profileIds.length} profiles.`);

  return succeeded > 0;
}

/**
 * Internal: post to a single Buffer profile with platform-aware text.
 */
async function _postToProfile(profileId, hooks, link, imageUrl, now) {
  try {
    const mode = now ? 'shareNow' : 'addToQueue';
    const INSTAGRAM_ID = '6a5c8546e2638b94d7959a2c';
    const isInstagram = profileId === INSTAGRAM_ID;

    // Instagram always needs an image — use logo as fallback rather than skipping
    const LOGO = 'https://realssanews.com.ng/logo.png';
    const effectiveImage = (imageUrl && imageUrl !== LOGO) ? imageUrl : LOGO;

    // Pick the right text per platform
    // Instagram: no link in caption (links don\'t work), use instagram-specific text
    // Twitter/X: append link, enforce 280 char hard limit
    // Facebook:  append link as attachment, use facebook text
    let text;
    if (isInstagram) {
      // Instagram: no URL in caption, just the caption + hashtags
      text = hooks.instagram || hooks.twitter;
      // Strip any accidental URLs from IG caption
      text = text.replace(/https?:\/\/\S+/g, '').trim();
      // IG caption max 2200 chars but keep it punchy
      if (text.length > 2200) text = text.slice(0, 2197) + '…';
    } else {
      // Twitter/X and Facebook: append the article link
      const isTwitter = !isInstagram; // treat all non-IG as needing link
      const baseText = isTwitter ? (hooks.twitter || hooks.facebook) : (hooks.facebook || hooks.twitter);
      text = link ? `${baseText}\n\n${link}` : baseText;
      // Twitter hard limit: 280 chars. Link = ~23 chars + newlines = 25 reserved.
      // So cap total at 280.
      if (text.length > 280) text = text.slice(0, 277) + '…';
    }

    const input = {
      channelId: profileId,
      text,
      schedulingType: 'automatic',
      mode,
      saveToDraft: false,
    };

    // Instagram type field removed — not supported by CreatePostInput

    // Attach image — Instagram always gets one (logo fallback if needed), others only if real image
    if (isInstagram || (effectiveImage && effectiveImage !== LOGO)) {
      input.assets = [{ image: { url: effectiveImage } }];
    }

    const mutation = {
      query: `
        mutation CreatePost($input: CreatePostInput!) {
          createPost(input: $input) {
            ... on PostActionSuccess { post { id dueAt } }
            ... on MutationError { message }
          }
        }
      `,
      variables: { input }
    };

    const res = await fetch(BUFFER_API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${BUFFER_ACCESS_TOKEN}` },
      body: JSON.stringify(mutation)
    });

    if (!res.ok) {
      console.error(`[Buffer] API error for profile ${profileId} (${res.status}):`, await res.text());
      return false;
    }

    const data = await res.json();
    if (data.errors) { console.error(`[Buffer] GraphQL errors for ${profileId}:`, JSON.stringify(data.errors)); return false; }
    if (data?.data?.createPost?.message) { console.error(`[Buffer] Post rejected for ${profileId}:`, data.data.createPost.message); return false; }

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
      message: 'Buffer not configured. Set BUFFER_ACCESS_TOKEN and BUFFER_PROFILE_IDS in Fly.io secrets (fly secrets set KEY=VALUE).',
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
        handle:   p.name,
        paused:   false,
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
