/**
 * Gemini AI Summariser, Translator, Entity Extractor & Embedder
 * Uses Google Gemini (free tier) for all structured AI features.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
const GEMINI_EMBED_URL = 'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent';

/**
 * A generic helper to call the Gemini API.
 */
async function callGemini(prompt, { maxOutputTokens, temperature, timeout, responseMimeType }) {
  if (!GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY is not set. Skipping generation.');
    return null;
  }

  try {
    const config = { maxOutputTokens, temperature, topP: 0.9 };
    if (responseMimeType) {
      config.responseMimeType = responseMimeType;
    }

    const response = await fetch(`${GEMINI_BASE_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: config,
      }),
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`Gemini API error: ${response.status} ${response.statusText} - Details: ${errText}`);
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
 * Generate a 768-dimension vector embedding for a given text.
 * Uses gemini-embedding-001 model.
 * @param {string} text - The text to embed.
 * @returns {Promise<Array<number>|null>} Array of floats.
 */
async function generateEmbedding(text) {
  if (!GEMINI_API_KEY) return null;
  if (!text || text.trim().length === 0) return null;

  try {
    const response = await fetch(`${GEMINI_EMBED_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: {
          parts: [{ text: text.substring(0, 2000) }] // Cap characters to avoid API limits
        }
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`Gemini Embedding API error: ${response.status} - Details: ${errText}`);
      return null;
    }

    const data = await response.json();
    return data?.embedding?.values || null;
  } catch (err) {
    console.warn(`Gemini Embedding failed: ${err.message}`);
    return null;
  }
}

/**
 * Perform complete structured AI analysis on an article (Summary, Entity Extraction, Translations).
 * Performs a single API call to save rate limits and resources.
 */
async function generateAIAnalysis(title, excerpt) {
  const cleanText = (excerpt || title || '').replace(/<[^>]+>/g, '').slice(0, 600);

  const prompt = [
    'You are the lead editor for RealSSA News, Africa\'s leading digital news platform.',
    'Analyze the following news article and output a structured JSON object.',
    '',
    'Strict requirements for the JSON schema:',
    '{',
    '  "summary": "2-sentence summary. First sentence states key fact directly. Second sentence explains why it matters for Africa or everyday people.",',
    '  "entities": [',
    '    {',
    '      "name": "Normalized canonical standard full name. Use full names (e.g. \'Bola Tinubu\' instead of \'Tinubu\' or \'President Tinubu\', \'Central Bank of Nigeria\' instead of \'CBN\', \'Super Eagles\' instead of \'Nigeria national team\').",',
    '      "type": "Must be one of: \'person\', \'organization\', \'location\', \'sports_team\'"',
    '    }',
    '  ],',
    '  "translations": {',
    '    "pidgin": {',
    '      "title": "Translate the article headline into Wazobia Pidgin English.",',
    '      "summary": "Translate the 2-sentence summary into Wazobia Pidgin English."',
    '    },',
    '    "yoruba": {',
    '      "title": "Translate the article headline into Yoruba.",',
    '      "summary": "Translate the 2-sentence summary into Yoruba."',
    '    },',
    '    "hausa": {',
    '      "title": "Translate the article headline into Hausa.",',
    '      "summary": "Translate the 2-sentence summary into Hausa."',
    '    },',
    '    "igbo": {',
    '      "title": "Translate the article headline into Igbo.",',
    '      "summary": "Translate the 2-sentence summary into Igbo."',
    '    }',
    '  }',
    '}',
    '',
    `Article Title: "${title}"`,
    `Article Text: "${cleanText}"`,
    '',
    'Return ONLY the raw JSON block. No markdown formatting, no ```json wrappers.'
  ].join('\n');

  const jsonText = await callGemini(prompt, {
    maxOutputTokens: 800,
    temperature: 0.2, // Low temperature for high accuracy and valid JSON structure
    timeout: 12000,
    responseMimeType: 'application/json'
  });

  if (!jsonText) return null;

  try {
    return JSON.parse(jsonText);
  } catch (err) {
    console.error('Failed to parse Gemini AI Analysis JSON:', err.message, 'Raw response:', jsonText);
    return null;
  }
}

/**
 * Backwards compatibility wrapper for generating summaries.
 */
async function generateSummary(title, excerpt) {
  const analysis = await generateAIAnalysis(title, excerpt);
  return analysis?.summary || null;
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
    timeout: 12000,
  });

  return result && result.length > 50 ? result : null;
}

module.exports = { 
  generateSummary, 
  generateSocialHook, 
  rewriteArticle, 
  generateAIAnalysis, 
  generateEmbedding 
};
