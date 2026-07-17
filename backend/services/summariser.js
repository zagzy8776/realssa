/**
 * Gemini AI Summariser
 * Generates unique 2-sentence RealSSA-branded summaries for RSS articles.
 * Uses Google Gemini 2.0 Flash Lite (free: 1,500 req/day, 15 req/min).
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

/**
 * A generic helper to call the Gemini API.
 * @param {string} prompt - The full prompt to send to the model.
 * @param {object} config - Generation config and timeout settings.
 * @param {number} config.maxOutputTokens - Max tokens for the response.
 * @param {number} config.temperature - The creativity temperature.
 * @param {number} config.timeout - Request timeout in milliseconds.
 * @returns {Promise<string|null>} The generated text or null on failure.
 */
async function callGemini(prompt, { maxOutputTokens, temperature, timeout }) {
  if (!GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY is not set. Skipping generation.');
    return null;
  }

  try {
    const response = await fetch(GEMINI_BASE_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens, temperature, topP: 0.9 },
      }),
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
      console.warn(`Gemini API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch (err) {
    console.warn(`Gemini call failed: ${err.message}`);
    return null;
  }
}

/**
 * Generate a 2-sentence RealSSA-voiced summary of an article.
 * Returns null if Gemini is unavailable or rate-limited.
 */
async function generateSummary(title, excerpt) {
  const cleanText = (excerpt || title || '').replace(/<[^>]+>/g, '').slice(0, 600);

  const prompt = [
    'You are an editor for RealSSA News, Africa\'s leading digital news platform.',
    'Write a 2-sentence summary of this news article in a clear, engaging voice aimed at an African audience.',
    'First sentence: state the key fact directly. Second sentence: explain why it matters for Africa or everyday people.',
    `Article title: "${title}"`,
    `Article text: "${cleanText}"`,
    'Return ONLY the 2-sentence summary. No intro, no labels, no quotes around the sentences.'
  ].join('\n');

  const text = await callGemini(prompt, {
    maxOutputTokens: 120,
    temperature: 0.6,
    timeout: 8000,
  });

  return text && text.length > 20 ? text : null;
}

/**
 * Generate a catchy Twitter/Social Media hook for an article.
 */
async function generateSocialHook(title, excerpt) {
  const cleanText = (excerpt || title || '').replace(/<[^>]+>/g, '').slice(0, 600);
  const prompt = [
    'You are an expert Social Media Manager for RealSSA News.',
    'Write a catchy, engaging 2-sentence social media post for this article.',
    'Make it sound urgent, use 1 or 2 relevant emojis, and add 3 hashtags.',
    'End with "Read the full story below 👇".',
    `Article title: "${title}"`,
    `Article text: "${cleanText}"`,
    'Return ONLY the post text. No intro, no quotes.'
  ].join('\n');

  const text = await callGemini(prompt, {
    maxOutputTokens: 100,
    temperature: 0.7,
    timeout: 8000,
  });

  return text && text.length > 20 ? text : null;
}

/**
 * Rewrite an entire extracted article into original RealSSA reporting.
 */
async function rewriteArticle(title, text) {
  // Grab up to ~10,000 characters of the raw text so we get the full story
  const cleanText = (text || '').replace(/<[^>]+>/g, '').slice(0, 10000);

  const prompt = [
    'You are a professional journalist for the "RealSSA News Desk".',
    'Your task is to take the raw text of a news article and completely rewrite it as an original, exclusive news report.',
    'Follow these rules STRICTLY:',
    '1. Write 3 to 5 concise paragraphs.',
    '2. Use a highly engaging, professional news reporting tone (like BBC or Al Jazeera, but for an African audience).',
    '3. Do NOT mention that you are an AI, a bot, or that this is a summary.',
    '4. Do NOT say "Here is a rewrite" or any conversational filler. Output ONLY the article text.',
    '5. Wrap each paragraph in <p> tags so it is valid HTML. Example: <p>Paragraph 1...</p><p>Paragraph 2...</p>',
    `Original Title: "${title}"`,
    `Original Text: "${cleanText}"`
  ].join('\n');

  const result = await callGemini(prompt, {
    maxOutputTokens: 800,
    temperature: 0.7,
    timeout: 12000, // allow up to 12s for full rewrite
  });

  return result && result.length > 50 ? result : null;
}

module.exports = { generateSummary, generateSocialHook, rewriteArticle };
