/**
 * Buffer Social Media Integration
 * Automates posting to Twitter, Facebook, etc.
 */

const BUFFER_ACCESS_TOKEN = process.env.BUFFER_S_TOKEN || process.env.BUFFER_ACCESS_TOKEN;
const BUFFER_PROFILE_IDS = process.env.BUFFER_FILE_IDS || process.env.BUFFER_PROFILE_IDS; // comma-separated if multiple

async function postToBuffer(text, link, imageUrl) {
  if (!BUFFER_ACCESS_TOKEN || !BUFFER_PROFILE_IDS) {
    console.log('Buffer not configured. Skipping social post.');
    return false;
  }

  const profileIds = BUFFER_PROFILE_IDS.split(',').map(id => id.trim());
  
  try {
    const formData = new URLSearchParams();
    formData.append('access_token', BUFFER_ACCESS_TOKEN);
    formData.append('text', text);
    
    // Add profiles
    profileIds.forEach(id => formData.append('profile_ids[]', id));
    
    // Add media links if provided
    if (link) formData.append('media[link]', link);
    if (imageUrl) formData.append('media[picture]', imageUrl);
    if (imageUrl) formData.append('media[thumbnail]', imageUrl);

    const response = await fetch('https://api.bufferapp.com/1/updates/create.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Buffer API Error:', err);
      return false;
    }

    console.log('✅ Successfully posted to Buffer!');
    return true;
  } catch (error) {
    console.error('Buffer request failed:', error.message);
    return false;
  }
}

module.exports = { postToBuffer };
