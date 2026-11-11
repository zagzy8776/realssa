/**
 * Prophecy Engine — "The Predictable Future"
 *
 * Generates absolute "Projected Outcomes" predictions for sports matches
 * and other events, instead of probabilistic forecasts. Uses match stats,
 * weather, injuries, and team form to output definitive predictions like:
 *   "Prophecy: Liverpool dominates Second Half; Over 2.5 Goals predicted."
 *
 * Outputs are presented as AI-generated prophecies, not probability estimates.
 */

const { callGeminiJSON } = require('./aiAgentService');
const { pgRun } = require('./pg');

const LOG = {
  info: (m) => console.log(`[ProphecyEngine] ${m}`),
  warn: (m) => console.warn(`[ProphecyEngine] ${m}`),
  error: (m) => console.error(`[ProphecyEngine] ${m}`),
};

const ENABLED = process.env.PROPHECY_ENABLED !== '0';

/**
 * Generate a prophecy for a live match or upcoming event.
 * @param {object} match - { homeTeam, awayTeam, competition, matchMinute, homeScore, awayScore, status, weather, injuries, form }
 */
async function generateProphecy(match) {
  if (!ENABLED) return null;

  const { homeTeam, awayTeam, competition, matchMinute, homeScore, awayScore, status, weather, injuries, form } = match;

  const prompt = [
    'You are the RealSSA Prophecy Engine — an AI that predicts absolute outcomes for sports events.',
    'Your job is to generate definitive "Prophecy" predictions, NOT probabilistic forecasts.',
    '',
    'Match Context:',
    `- Home: ${homeTeam}`,
    `- Away: ${awayTeam}`,
    `- Competition: ${competition || 'Unknown'}`,
    `- Status: ${status || 'scheduled'}`,
    matchMinute ? `- Match Minute: ${matchMinute}` : '',
    homeScore != null && awayScore != null ? `- Score: ${homeScore}-${awayScore}` : '',
    weather ? `- Weather: ${weather}` : '',
    injuries ? `- Injuries/Suspensions: ${injuries}` : '',
    form ? `- Recent Form: ${form}` : '',
    '',
    'Instructions:',
    '1. Output ONE definitive prophecy statement (1-2 sentences).',
    '2. Use absolute language: "will", "is going to", "predicts", "dominates", etc.',
    '3. Do NOT use probabilistic language like "likely", "probably", "chance", "percentage".',
    '4. Format: "Prophecy: [specific outcome prediction]."',
    '5. Max 200 characters.',
    '',
    'Return JSON: { "prophecy": "Prophecy: ..." }',
  ].filter(Boolean).join('\n');

  try {
    const result = await callGeminiJSON(
      'You are an absolute outcome prediction engine for sports.',
      prompt,
      { maxTokens: 150, temperature: 0.7 }
    );

    if (!result || !result.prophecy) return null;
    return result.prophecy.trim().slice(0, 200);
  } catch (err) {
    LOG.warn(`Prophecy generation failed: ${err.message}`);
    return null;
  }
}

/**
 * Save a prophecy to the database.
 */
async function saveProphecy(matchId, prophecy) {
  if (!prophecy) return null;
  try {
    await pgRun(
      `CREATE TABLE IF NOT EXISTS prophecies (
        id SERIAL PRIMARY KEY,
        match_id TEXT NOT NULL,
        prophecy_text TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`
    );
    const result = await pgRun(
      `INSERT INTO prophecies (match_id, prophecy_text, created_at)
       VALUES ($1, $2, NOW())
       RETURNING id`,
      [matchId, prophecy]
    );
    return result.rows?.[0]?.id || null;
  } catch (e) {
    LOG.warn(`Prophecy save failed: ${e.message}`);
    return null;
  }
}

/**
 * Get the latest prophecy for a match.
 */
async function getProphecy(matchId) {
  try {
    const result = await pgRun(
      `SELECT prophecy_text, created_at FROM prophecies WHERE match_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [matchId]
    );
    return result.rows?.[0] || null;
  } catch (e) {
    return null;
  }
}

/**
 * Generate and cache a prophecy for a match.
 */
async function generateAndCacheProphecy(match) {
  const prophecy = await generateProphecy(match);
  if (prophecy && match.match_id) {
    await saveProphecy(match.match_id, prophecy);
  }
  return prophecy;
}

module.exports = {
  generateProphecy,
  saveProphecy,
  getProphecy,
  generateAndCacheProphecy,
  ENABLED,
};
