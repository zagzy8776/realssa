// Live test: NVIDIA key routing through aiAgentService (JSON mode)
process.env.GEMINI_API_KEY = process.env.TEST_NVIDIA_KEY;
const { callGeminiJSON, callGemini } = require('./services/aiAgentService');

async function main() {
  const json = await callGeminiJSON('You are a JSON API.', 'Return this JSON object: {"status":"ok","provider":"nvidia"}');
  console.log('JSON RESULT:', JSON.stringify(json));
  if (!json || json.status !== 'ok') { console.error('JSON test FAILED'); process.exit(1); }

  const text = await callGemini('You are a test assistant.', 'Reply with exactly: routing verified', { maxTokens: 200 });
  console.log('TEXT RESULT:', text);
  if (!text) { console.error('TEXT test FAILED'); process.exit(1); }

  console.log('ALL TESTS PASSED');
  process.exit(0);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
