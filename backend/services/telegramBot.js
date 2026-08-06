/**
 * Telegram Bot Service (@RealSSABot)
 * Exposes the RealSSA OS news database directly inside Telegram via commands and inline query sharing.
 * Uses a lightweight, zero-dependency Axios polling loop.
 */

const axios = require('axios');
const { queryMultiDb } = require('../config/multiDb');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8665569162:AAEzdeHzrbJZr9DxM_hWU87P_nzUNotItYA';
const API_URL = `https://api.telegram.org/bot${TOKEN}`;
const SITE_URL = 'https://www.realssanews.com.ng';

let lastUpdateId = 0;
let isPolling = false;

/**
 * Initialize and start the Telegram Bot polling loop
 */
function startTelegramBot() {
  if (isPolling) return;
  if (!TOKEN) {
    console.warn('[TelegramBot] No bot token found in environment. Skipping bot initialization.');
    return;
  }

  isPolling = true;
  console.log('🤖 Telegram Bot service initialized (@RealSSABot). Starting poll loop...');
  pollUpdates();
}

/**
 * Fetch and process updates from Telegram API
 */
async function pollUpdates() {
  while (isPolling) {
    try {
      const response = await axios.get(`${API_URL}/getUpdates`, {
        params: {
          offset: lastUpdateId + 1,
          timeout: 30, // 30-second long poll
        },
        timeout: 35000, // Client-side timeout slightly higher than Telegram poll timeout
      });

      if (response.data && response.data.ok) {
        const updates = response.data.result;
        for (const update of updates) {
          lastUpdateId = update.update_id;
          await handleUpdate(update);
        }
      }
    } catch (err) {
      // Sleep briefly on network failure to avoid spamming requests
      if (err.code !== 'ECONNABORTED') {
        console.warn('[TelegramBot Poll Warning]:', err.message);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
}

/**
 * Stop the polling loop
 */
function stopTelegramBot() {
  isPolling = false;
  console.log('🤖 Telegram Bot service stopped.');
}

/**
 * Dispatch Telegram updates to the correct handler
 */
async function handleUpdate(update) {
  try {
    if (update.message) {
      await handleMessage(update.message);
    } else if (update.inline_query) {
      await handleInlineQuery(update.inline_query);
    }
  } catch (err) {
    console.error('[TelegramBot Update Handling Error]:', err.message);
  }
}

/**
 * Handle direct chat messages and commands
 */
async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = (message.text || '').trim();

  if (!text) return;

  if (text.startsWith('/start')) {
    const welcomeText = 
      `📰 *Welcome to RealSSA News Intelligence*\n\n` +
      `I am your conversational news assistant. I can query our database, fetch daily briefs, and share rich summaries inside any chat.\n\n` +
      `*Available Commands:*\n` +
      `⚡ /brief - Get the daily brief (top 3 high-importance stories)\n` +
      `🔍 /query [term] - Search the database for any topic (e.g. \`/query fuel prices\`)\n\n` +
      `*Group Search:*\n` +
      `Type \`@RealSSABot [topic]\` in *any* group or private chat to instantly preview and share news cards with your friends.`;

    await sendMessage(chatId, welcomeText);
  } else if (text.startsWith('/brief')) {
    await handleBriefCommand(chatId);
  } else if (text.startsWith('/query')) {
    const queryTerm = text.replace('/query', '').trim();
    if (!queryTerm) {
      await sendMessage(chatId, '🔍 Please specify a topic to search. Example: \`/query sports\`');
      return;
    }
    await handleQueryCommand(chatId, queryTerm);
  }
}

/**
 * Handle /brief command: return top 3 breaking stories
 */
async function handleBriefCommand(chatId) {
  try {
    const queryStr = `
      SELECT id, title, COALESCE(ai_summary, original_excerpt) AS excerpt, source_name, published_at
      FROM rss_articles
      ORDER BY published_at DESC
      LIMIT 3
    `;
    const res = await queryMultiDb(queryStr);
    
    if (!res.rows || res.rows.length === 0) {
      await sendMessage(chatId, '📰 No fresh articles found. Check back in a few minutes!');
      return;
    }

    let briefText = `⚡ *RealSSA Morning Briefing:*\n\n`;
    res.rows.forEach((row, i) => {
      const cleanTitle = (row.title || '').replace(/<[^>]*>/g, '').trim();
      const cleanExcerpt = (row.excerpt || '').replace(/<[^>]*>/g, '').trim();
      const dateStr = new Date(row.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      briefText += 
        `${i + 1}. *${cleanTitle}*\n` +
        `⏱️ _${dateStr} | ${row.source_name || 'RealSSA'}_\n` +
        `👉 ${cleanExcerpt ? cleanExcerpt.slice(0, 180) + '...' : 'Read summary on the site.'}\n` +
        `🔗 [Read Full Coverage](${SITE_URL}/article/rss-${row.id})\n\n`;
    });

    await sendMessage(chatId, briefText);
  } catch (err) {
    console.error('[TelegramBot Brief Error]:', err.message);
    await sendMessage(chatId, '⚠️ Failed to fetch briefing. Please try again in a moment.');
  }
}

/**
 * Handle /query [term] command: search articles
 */
async function handleQueryCommand(chatId, term) {
  try {
    const queryStr = `
      SELECT id, title, COALESCE(ai_summary, original_excerpt) AS excerpt, source_name, published_at
      FROM rss_articles
      WHERE title ILIKE $1 OR original_excerpt ILIKE $1 OR ai_summary ILIKE $1
      ORDER BY published_at DESC
      LIMIT 3
    `;
    const res = await queryMultiDb(queryStr, [`%${term}%`]);

    if (!res.rows || res.rows.length === 0) {
      await sendMessage(chatId, `🔍 No articles found matching "${term}". Try searching for another topic like "fuel", "football", or "elections".`);
      return;
    }

    let resultText = `🔍 *Search results for "${term}":*\n\n`;
    res.rows.forEach((row, i) => {
      const cleanTitle = (row.title || '').replace(/<[^>]*>/g, '').trim();
      const cleanExcerpt = (row.excerpt || '').replace(/<[^>]*>/g, '').trim();
      const dateStr = new Date(row.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      resultText += 
        `${i + 1}. *${cleanTitle}*\n` +
        `⏱️ _${dateStr} | ${row.source_name || 'RealSSA'}_\n` +
        `👉 ${cleanExcerpt ? cleanExcerpt.slice(0, 180) + '...' : 'Read full coverage.'}\n` +
        `🔗 [View on RealSSA](${SITE_URL}/article/rss-${row.id})\n\n`;
    });

    await sendMessage(chatId, resultText);
  } catch (err) {
    console.error('[TelegramBot Query Error]:', err.message);
    await sendMessage(chatId, '⚠️ Failed to process search query. Please try again.');
  }
}

/**
 * Handle inline queries: return search results dynamically
 */
async function handleInlineQuery(inlineQuery) {
  const queryId = inlineQuery.id;
  const term = (inlineQuery.query || '').trim();

  if (!term) return; // Do not search empty queries

  try {
    // Search latest matching articles in database
    const queryStr = `
      SELECT id, title, COALESCE(ai_summary, original_excerpt) AS excerpt, source_name, image, published_at
      FROM rss_articles
      WHERE title ILIKE $1 OR original_excerpt ILIKE $1 OR ai_summary ILIKE $1
      ORDER BY published_at DESC
      LIMIT 10
    `;
    const res = await queryMultiDb(queryStr, [`%${term}%`]);
    
    const results = (res.rows || []).map((row) => {
      const cleanTitle = (row.title || '').replace(/<[^>]*>/g, '').trim();
      const cleanExcerpt = (row.excerpt || '').replace(/<[^>]*>/g, '').trim();
      const dateStr = new Date(row.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const articleUrl = `${SITE_URL}/article/rss-${row.id}`;
      
      // Inline Markdown message block
      const messageText = 
        `📰 *${cleanTitle}*\n\n` +
        `📝 *Summary:*\n${cleanExcerpt ? cleanExcerpt.slice(0, 280) + '...' : 'Read full summary on the site.'}\n\n` +
        `🏷️ _Source: ${row.source_name || 'RealSSA'} | ${dateStr}_`;

      const result = {
        type: 'article',
        id: `rss-${row.id}`,
        title: cleanTitle,
        description: cleanExcerpt ? cleanExcerpt.slice(0, 100) + '...' : `News from ${row.source_name}`,
        input_message_content: {
          message_text: messageText,
          parse_mode: 'Markdown',
          disable_web_page_preview: false,
        },
        reply_markup: {
          inline_keyboard: [
            [
              { text: '👉 Read Full Article on RealSSA', url: articleUrl }
            ]
          ]
        }
      };


      // Ingest image preview if valid URL exists
      if (row.image && row.image.startsWith('http')) {
        result.thumb_url = row.image;
      }

      return result;
    });

    // Answer Telegram inline query with cached results
    await axios.post(`${API_URL}/answerInlineQuery`, {
      inline_query_id: queryId,
      results: results,
      cache_time: 300, // Cache results for 5 minutes to optimize performance
    });

  } catch (err) {
    console.error('[TelegramBot InlineQuery Error]:', err.message);
  }
}

/**
 * Helper to send a simple Telegram text message
 */
async function sendMessage(chatId, text) {
  try {
    await axios.post(`${API_URL}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
      disable_web_page_preview: false,
    });
  } catch (err) {
    console.error(`[TelegramBot sendMessage Error to ${chatId}]:`, err.message);
  }
}

module.exports = {
  startTelegramBot,
  stopTelegramBot,
};
