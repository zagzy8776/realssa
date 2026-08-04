const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
});

const usersDbUrl = process.env.USERS_DATABASE_URL || process.env.DATABASE_URL;
const usersPool = new Pool({
  connectionString: usersDbUrl,
  ssl: usersDbUrl ? { rejectUnauthorized: false } : undefined
});

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent';

// 50 realistic personas
const BOT_PERSONAS = [
  "Abiodun K.", "Chinedu_Dev", "Aisha_Abuja", "Tunde_Lagos", "Fatima_Mustapha",
  "Ngozi_E", "Emeka_Crypto", "Bola_T", "Yusuf_M", "Kemi_O", "Olumide_A",
  "Blessing_N", "Ibrahim_J", "Chioma_P", "Damilola_S", "Uche_UX", "Amara_G",
  "Temitope_O", "Zainab_H", "Musa_K", "Seyi_A", "Grace_E", "Efe_Warri",
  "Halima_D", "Chidi_O", "Funmi_L", "Kabir_U", "Nkechi_M", "Tosin_B",
  "Jude_K", "Rukayat_A", "Eze_N", "Oluwaseun_P", "Bose_F", "Aminu_S",
  "Linda_O", "Paul_E", "Joy_O", "Sadiq_M", "Toyin_S", "Umar_D",
  "Nonso_A", "Funsho_K", "Anita_E", "Usman_G", "Rita_P", "Kelechi_J",
  "Abubakar_Y", "Tari_PortHarcourt", "Gozie_O"
];

// Topic-specific fallback comments if Gemini is rate-limited or fails
const CONTEXT_COMMENTS = {
  sports: [
    "What a match! Totally deserved outcome.",
    "The coach needs to change tactics, this styling won't work.",
    "Unbelievable performance. We move!",
    "Is this squad ready for the next championship? I doubt it.",
    "Pure class. This player is in top form right now."
  ],
  politics: [
    "This policy needs serious debate, the timing is critical.",
    "Let's hope they actually deliver on these promises.",
    "We have heard similar promises before. Let's watch and see.",
    "A very welcome development for national progress.",
    "Interesting analysis. There are multiple sides to this issue."
  ],
  crypto: [
    "Bullish on this update! 🚀",
    "Regulations are slowing down local adoption, sad.",
    "Time to buy the dip before the next pump.",
    "Is this secure? Always double-check contract audits.",
    "This project has a strong community behind it."
  ],
  tech: [
    "Incredible innovation. Nigerian startups are really rising.",
    "Fintech is leading, but we need more infrastructure projects.",
    "Excellent tech stack choice. Scale is everything.",
    "This will simplify workflow for local devs.",
    "Great execution by the product team."
  ],
  general: [
    "This is a very interesting development. Let's see how it plays out.",
    "I disagree with this approach. We need better options.",
    "Finally! Glad this is getting media coverage.",
    "Are we sure this is fully verified? Seems a bit fast.",
    "Thanks for sharing this update, keeping close tabs on this."
  ]
};

const REPLY_TEMPLATES = [
  "Are you sure? I think you're missing the bigger picture here.",
  "Exactly! Glad someone else pointed this out.",
  "I don't think it's that simple. Let's look at the data.",
  "True, but that is only one part of the problem.",
  "Totally agree with your point."
];

/**
 * Call Gemini API using key rotation
 */
async function callGemini(promptText) {
  const keys = (process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
  const key = keys.length > 0 ? keys[Math.floor(Math.random() * keys.length)] : null;
  if (!key) return null;

  try {
    const res = await fetch(`${GEMINI_URL}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          maxOutputTokens: 120,
          temperature: 0.7
        }
      }),
      signal: AbortSignal.timeout(8000)
    });

    if (res.ok) {
      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    }
  } catch (err) {
    console.error('[Discussion Bot] Gemini API request failed:', err.message);
  }
  return null;
}

/**
 * Inserts a single comment row safely
 */
async function insertComment(articleId, authorName, content, parentId = null) {
  const deviceId = 'simulated-bot-' + Math.floor(Math.random() * 100);
  const likes = Math.floor(Math.random() * 8);
  try {
    const res = await usersPool.query(
      `INSERT INTO comments (article_id, parent_id, author_name, device_id, content, likes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [articleId, parentId, authorName, deviceId, content, likes]
    );
    return res.rows[0];
  } catch (err) {
    console.error(`[Discussion Bot] Insert failed for article ${articleId}:`, err.message);
    return null;
  }
}

/**
 * Simulates a full AI-powered nested conversation on an article
 */
async function buildDiscussionThread(articleId, title, excerpt, category) {
  // Pick random participants
  const participants = [...BOT_PERSONAS].sort(() => 0.5 - Math.random());
  const catKey = category && CONTEXT_COMMENTS[category.toLowerCase()] ? category.toLowerCase() : 'general';

  // 1. Generate First Comment
  const delay1 = Math.floor(Math.random() * 5000) + 1000; // 1-6 seconds
  setTimeout(async () => {
    const mainPrompt = `You are a Nigerian reader commenting on a news article. Write a short, natural comment (1-2 sentences) expressing a realistic opinion on this article.
    Title: "${title}"
    Excerpt: "${excerpt || ''}"
    Category: "${category || 'news'}"
    Keep it informal and realistic, using standard Nigerian English or light slang if appropriate. Do not use hashtags or emojis. Return only the raw comment text.`;
    
    let commentText = await callGemini(mainPrompt);
    if (!commentText) {
      const templates = CONTEXT_COMMENTS[catKey];
      commentText = templates[Math.floor(Math.random() * templates.length)];
    }

    const mainComment = await insertComment(articleId, participants[0], commentText);
    if (!mainComment) return;

    // 2. Generate Second Comment (Independent opinion)
    const delay2 = Math.floor(Math.random() * 15000) + 10000; // 10-25 seconds
    setTimeout(async () => {
      const secondPrompt = `You are another Nigerian reader sharing a different perspective on this news article. Write a short, natural comment (1-2 sentences).
      Title: "${title}"
      Category: "${category || 'news'}"
      Keep it informal and realistic, using standard Nigerian English. Do not use hashtags or emojis. Return only the raw comment text.`;

      let secondCommentText = await callGemini(secondPrompt);
      if (!secondCommentText) {
        const templates = CONTEXT_COMMENTS[catKey];
        secondCommentText = templates[Math.min(2, Math.floor(Math.random() * templates.length))];
      }

      await insertComment(articleId, participants[1], secondCommentText);
    }, delay2);

    // 3. Generate Reply/Debate (Replying to the first comment)
    const delay3 = Math.floor(Math.random() * 30000) + 20000; // 20-50 seconds
    setTimeout(async () => {
      const replyPrompt = `You are a Nigerian reader replying to another user's comment in the comment section of a news article.
      Article Title: "${title}"
      Previous Comment by ${participants[0]}: "${commentText}"
      Write a short, natural, conversational reply (1-2 sentences) either agreeing, disagreeing, or arguing. Keep it informal. Do not use hashtags or emojis. Return only the raw reply text.`;

      let replyText = await callGemini(replyPrompt);
      if (!replyText) {
        replyText = REPLY_TEMPLATES[Math.floor(Math.random() * REPLY_TEMPLATES.length)];
      }

      await insertComment(articleId, participants[2], replyText, mainComment.id);
    }, delay3);

  }, delay1);
}

/**
 * Checks for recent articles and starts AI discussion threads
 */
async function monitorAndSimulate() {
  try {
    console.log('[Discussion Bot] Checking for new articles to stimulate...');
    
    // Fetch articles published in the last 15 minutes
    const articlesRes = await pool.query(`
      SELECT 'rss-' || id as id, title, original_excerpt as excerpt, category 
      FROM rss_articles 
      WHERE published_at >= NOW() - INTERVAL '15 minutes'
      ORDER BY published_at DESC 
      LIMIT 10
    `);

    for (const article of articlesRes.rows) {
      // Check if this article already has comments
      const commentCheck = await usersPool.query(
        'SELECT 1 FROM comments WHERE article_id = $1 LIMIT 1',
        [article.id]
      );

      if (commentCheck.rows.length === 0) {
        console.log(`[Discussion Bot] Initiating AI debate on article: ${article.id} ("${article.title}")`);
        await buildDiscussionThread(article.id, article.title, article.excerpt, article.category);
      }
    }
  } catch (err) {
    console.error('[Discussion Bot] Monitoring cycle failed:', err.message);
  }
}

/**
 * Starts the bot interval loop
 */
function initDiscussionBot() {
  console.log('📢 AI Discussion Bot initialized.');
  monitorAndSimulate().catch(() => {});
  setInterval(() => {
    monitorAndSimulate().catch(() => {});
  }, 5 * 60 * 1000);
}

module.exports = { initDiscussionBot };
