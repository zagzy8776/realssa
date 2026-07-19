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

const BUFFER_API_ENDPOINT = 'https://api.buffer.com';

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
  
  // Always include Instagram ID automatically
  const INSTAGRAM_ID = '6a5c8546e2638b94d7959a2c';
  if (!profileIds.includes(INSTAGRAM_ID)) {
    profileIds.push(INSTAGRAM_ID);
  }

  if (profileIds.length === 0) {
    console.warn('[Buffer] BUFFER_PROFILE_IDS is empty — skipping.');
    return false;
  }

  // Embed the link directly in the text (works on all platforms, avoids link asset incompatibility on X/Twitter)
  let fullText = text;
  if (link) {
    fullText = `${text}\n\nRead the full story: ${link}`;
  }

  // Truncate text to Twitter's 280 char limit (if posting to Twitter/X, it needs to be safe)
  // Let's keep a reasonable limit of 275 characters so it's always safe
  if (fullText.length > 275) {
    fullText = fullText.slice(0, 272) + '…';
  }

  const results = await Promise.allSettled(
    profileIds.map(profileId => _postToProfile(profileId, fullText, imageUrl, now))
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
async function _postToProfile(profileId, text, imageUrl, now) {
  try {
    const mode = now ? 'shareNow' : 'addToQueue';

    const input = {
      channelId: profileId,
      text: text,
      schedulingType: 'automatic',
      mode: mode,
      saveToDraft: false
    };

    // Attach image asset if provided
    if (imageUrl && imageUrl !== 'https://realssanews.com.ng/logo.png') {
      input.assets = [
        {
          image: {
            url: imageUrl
          }
        }
      ];
    }

    const mutation = {
      query: `
        mutation CreatePost($input: CreatePostInput!) {
          createPost(input: $input) {
            ... on PostActionSuccess {
              post {
                id
                dueAt
              }
            }
            ... on MutationError {
              message
            }
          }
        }
      `,
      variables: {
        input: input
      }
    };

    const res = await fetch(BUFFER_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BUFFER_ACCESS_TOKEN}`
      },
      body: JSON.stringify(mutation)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Buffer] API error for profile ${profileId} (${res.status}):`, errText);
      return false;
    }

    const data = await res.json();
    if (data.errors) {
      console.error(`[Buffer] GraphQL errors for profile ${profileId}:`, JSON.stringify(data.errors));
      return false;
    }

    const mutationResult = data?.data?.createPost;
    if (mutationResult?.message) {
      console.error(`[Buffer] Post rejected/error for profile ${profileId}:`, mutationResult.message);
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
