/**
 * TVmaze Service
 * Free API - no key required.
 * Used as a TV show search fallback when TMDB returns thin results.
 */
const axios = require('axios');

const tvmazeClient = axios.create({
  baseURL: 'https://api.tvmaze.com',
  timeout: 8000,
});

/**
 * Strip HTML tags from TVmaze summaries
 */
function stripHtml(html = '') {
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Normalize a TVmaze show into our standard MovieOrShow shape
 */
function normalizeTVmazeShow(entry) {
  // Search results wrap the show in { score, show }
  const show = entry.show || entry;
  return {
    id: show.id,
    name: show.name,
    overview: stripHtml(show.summary || ''),
    poster_path: null,
    backdrop_path: null,
    r2_poster_url: show.image?.medium || null,
    r2_backdrop_url: show.image?.original || null,
    release_date: null,
    first_air_date: show.premiered || null,
    vote_average: show.rating?.average || 0,
    media_type: 'tv',
    genre_ids: [],
    _source: 'tvmaze',
    _tvmaze_id: show.id,
  };
}

/**
 * Search TVmaze for shows matching a query.
 * Returns normalized results in our MovieOrShow format.
 */
async function searchShows(query) {
  try {
    const response = await tvmazeClient.get('/search/shows', {
      params: { q: query }
    });
    const results = response.data || [];
    return results
      .filter(entry => entry.show && (entry.show.image || entry.show.summary))
      .map(normalizeTVmazeShow);
  } catch (err) {
    console.error('❌ [TVmaze Search Error]:', err.message);
    return [];
  }
}

/**
 * Get episodes for a TVmaze show by its TVmaze ID.
 */
async function getEpisodes(tvmazeId) {
  try {
    const response = await tvmazeClient.get(`/shows/${tvmazeId}/episodes`);
    const episodes = response.data || [];
    return episodes.map(ep => ({
      id: ep.id,
      episode_number: ep.number,
      season_number: ep.season,
      name: ep.name,
      overview: stripHtml(ep.summary || ''),
      air_date: ep.airdate,
      r2_still_url: ep.image?.medium || null,
    }));
  } catch (err) {
    console.error('❌ [TVmaze Episodes Error]:', err.message);
    return [];
  }
}

/**
 * Get seasons for a TVmaze show.
 */
async function getSeasons(tvmazeId) {
  try {
    const response = await tvmazeClient.get(`/shows/${tvmazeId}/seasons`);
    return (response.data || []).map(s => ({
      id: s.id,
      season_number: s.number,
      name: `Season ${s.number}`,
      episode_count: s.episodeCount,
    }));
  } catch (err) {
    console.error('❌ [TVmaze Seasons Error]:', err.message);
    return [];
  }
}

module.exports = { searchShows, getEpisodes, getSeasons, normalizeTVmazeShow };
