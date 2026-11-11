const { executeAiTaskWithFailover } = require('./recovery.service');
const { execute } = require('./sqliteMultiEngine');

/**
 * RealSSA Insight: AI Editor & Publishing Health Evaluator
 * Scores headlines across 7 metrics, outputs Publishing Health Score (0-100) & AI Confidence %
 */
class InsightService {
  static async evaluateHeadlineAndContent(headline, excerpt = '', category = 'General') {
    const prompt = `
Analyze this news headline and excerpt for RealSSA News:
Headline: "${headline}"
Excerpt: "${excerpt}"
Category: "${category}"

Evaluate 7 dimensions (0-100):
1. Length (Optimal: 40-70 chars)
2. Keyword Relevance
3. Curiosity Impact
4. Emotional Trigger
5. Clarity
6. SEO Richness
7. Competition Uniqueness

Return valid JSON with:
{
  "health_score": 87,
  "confidence_percent": 96,
  "suggested_headlines": [
    "5 Candidate Headlines here..."
  ],
  "optimized_meta": "Meta description (150-160 chars)",
  "tags": ["Tag1", "Tag2"],
  "improvements": ["Actionable improvement 1", "Actionable improvement 2"]
}
`;

    const systemInstruction = "You are RealSSA Insight AI Editor. Provide objective mathematical scoring and 5 improved headline candidates without hallucination.";

    const result = await executeAiTaskWithFailover('RealSSA_Insight', prompt, systemInstruction, true);

    // Save prediction in intelligence.db
    if (result && result.health_score) {
      try {
        await execute('intelligence', `
          INSERT OR REPLACE INTO article_predictions
          (article_id, predicted_ctr, health_score, confidence_percent, prompt_version, model_version)
          VALUES (?, ?, ?, ?, 'v1.0', 'gemini-2.5-flash')
        `, [`headline-${Date.now()}`, (result.health_score * 0.05).toFixed(1), result.health_score, result.confidence_percent || 95]);
      } catch (dbErr) {
        console.warn('⚠️ [RealSSA Insight] Failed to log prediction:', dbErr.message);
      }
    }

    return result;
  }
}

module.exports = InsightService;
