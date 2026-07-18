// matchMapper.js
const fetch = require('node-fetch');

/**
 * Maps stream titles to existing match fixtures from the Railway Scores API.
 * Uses a basic fuzzy matching algorithm.
 */

// Simple Levenshtein distance for fuzzy matching
function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
      }
    }
  }

  return matrix[b.length][a.length];
}

async function fetchLiveScores() {
  try {
    const response = await fetch('https://realssasportsapi-production.up.railway.app/scores');
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error('Error fetching live scores for match mapping:', error);
    return [];
  }
}

/**
 * Attempts to map a stream title (e.g., "Arsenal vs Chelsea") to a match ID.
 * @param {string} streamTitle 
 * @returns {Object|null} Match data if found
 */
async function mapStreamToMatch(streamTitle, scores) {
  const activeScores = scores || await fetchLiveScores();
  if (!activeScores || activeScores.length === 0) return null;

  const titleLower = streamTitle.toLowerCase();
  
  let bestMatch = null;
  let bestScore = Infinity;

  for (const match of activeScores) {
    // Expected format from the railway API
    const homeTeam = (match.home_team || '').toLowerCase();
    const awayTeam = (match.away_team || '').toLowerCase();
    
    // Check direct includes
    if (titleLower.includes(homeTeam) && titleLower.includes(awayTeam)) {
      return {
        match_id: match.match_id || match.id,
        home_team: match.home_team,
        away_team: match.away_team,
        league: match.league || 'Unknown',
        match_start_time: match.date || new Date().toISOString()
      };
    }
    
    // Fuzzy matching fallback
    const targetString = `${homeTeam} vs ${awayTeam}`;
    const distance = levenshtein(titleLower, targetString);
    
    // Threshold for acceptable match
    if (distance < bestScore && distance < 10) {
      bestScore = distance;
      bestMatch = match;
    }
  }

  if (bestMatch) {
    return {
        match_id: bestMatch.match_id || bestMatch.id,
        home_team: bestMatch.home_team,
        away_team: bestMatch.away_team,
        league: bestMatch.league || 'Unknown',
        match_start_time: bestMatch.date || new Date().toISOString()
    };
  }

  return null;
}

module.exports = {
  mapStreamToMatch
};
