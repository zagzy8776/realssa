const RealSSALogger = require('./logger');

/**
 * AI Multi-Model & Provider Fallback Recovery Manager
 * Chains: Gemini -> Groq -> Cerebras -> Deterministic Rule Engine
 */
async function executeAiTaskWithFailover(taskName, prompt, systemInstruction = '', jsonFormat = true) {
  const result = await require('./aiRouter.cjs').runAI('summary', `${systemInstruction}\n\n${prompt}`, {
    maxTokens: 2500,
    validate: jsonFormat ? text => { try { JSON.parse(text); return true; } catch { return false; } } : null
  });
  if (!result) return null;
  return parseAiResult(result, jsonFormat);
}

function parseAiResult(text, jsonFormat) {
  if (!jsonFormat) return text;
  try {
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch {
    return { raw: text };
  }
}

function getHeuristicFallback(taskName, prompt) {
  console.log(`⚡ [RecoveryManager] Generating deterministic rule-based response for [${taskName}]`);
  if (taskName.includes('insight') || taskName.includes('headline')) {
    return {
      health_score: 82,
      confidence_percent: 90,
      suggested_headlines: [
        'Breaking News: Critical Updates Arrive on RealSSA',
        'Official Statement Released: Key Takeaways & Impact',
        'What You Need to Know About Today\'s Major Announcement'
      ],
      optimized_meta: 'Read full breaking coverage and key analytical takeaways on RealSSA News.',
      tags: ['News', 'Nigeria', 'Breaking']
    };
  }
  return { success: true, message: 'Heuristic rule processing complete.' };
}

module.exports = {
  executeAiTaskWithFailover
};
