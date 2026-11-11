/**
 * Logs user interaction with a specific news category to build a local recommendation profile.
 * Categories with higher interaction weights are automatically promoted in the feed.
 */
export async function logCategoryPreference(category: string, weight = 1) {
  if (!category) return;
  try {
    const prefs = JSON.parse(localStorage.getItem('realssa_preferences') || '{}');
    const counts = prefs.counts || {};
    
    // Increment the category score by weight
    counts[category] = (counts[category] || 0) + weight;
    
    // Find the category with the highest interaction score
    let topCategory = prefs.topCategory || category;
    let maxCount = counts[topCategory] || 0;
    for (const cat in counts) {
      if (counts[cat] > maxCount) {
        maxCount = counts[cat];
        topCategory = cat;
      }
    }
    
    localStorage.setItem('realssa_preferences', JSON.stringify({
      ...prefs,
      counts,
      topCategory
    }));

    // Trigger background sync to Neon DB
    const deviceId = localStorage.getItem('realssa_device_uuid');
    if (deviceId) {
      const { apiUrl } = await import('./api-base');
      fetch(apiUrl('/api/profile/sync'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, counts })
      }).catch(() => {});
    }
  } catch (e) {
    console.error('Failed to log category preference:', e);
  }
}

/**
 * Returns the user's currently preferred categories sorted by interaction count.
 */
export function getPreferredCategories(): string[] {
  try {
    const prefs = JSON.parse(localStorage.getItem('realssa_preferences') || '{}');
    const counts = prefs.counts || {};
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  } catch {
    return [];
  }
}
