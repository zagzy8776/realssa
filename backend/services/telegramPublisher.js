/**
 * Telegram Channel Publisher Service
 * Automatically broadcasts published articles to the RealSSA Telegram Channel (@realssanews)
 */

const axios = require('axios');

/**
 * Post an article to the RealSSA Telegram Channel
 * @param {Object} article 
 */
async function postToTelegramChannel(article) {
  const token = process.env.TELEGRAM_BOT_TOKEN || '8665569162:AAEzdeHzrbJZr9DxM_hWU87P_nzUNotItYA';
  const channelId = process.env.TELEGRAM_CHANNEL_ID || '@realssanews';

  if (!token || !channelId) {
    console.warn('[TelegramPublisher] Missing Telegram token or channel ID. Skipping auto-post.');
    return false;
  }

  const title = article.title || 'Breaking News';
  const rawSummary = (Array.isArray(article.ai_summary) ? article.ai_summary.join(' ') : article.ai_summary) || article.excerpt || '';
  const summary = rawSummary.slice(0, 300);
  const category = (article.category || 'News').toUpperCase();
  const readTime = article.readTime || '2 min read';
  const articleUrl = `https://www.realssanews.com.ng/article/${article.id}`;
  const whatsappChannel = process.env.WHATSAPP_CHANNEL_URL || 'https://whatsapp.com/channel/0029VbDetsPGufIx3Totk938';

  // Construct Markdown message
  const caption = 
    `📰 *${title.trim()}*\n\n` +
    `⚡ *AI Summary:*\n${summary.trim()}\n\n` +
    `🏷️ *Category:* #${category.replace(/[^A-Z0-9]/gi, '')} | ⏱️ ${readTime}\n\n` +
    `👉 [Read Full Article on RealSSA](${articleUrl})\n` +
    `📲 [Join WhatsApp Channel](${whatsappChannel})`;

  try {
    // If article has a valid image URL, try sending as Photo
    if (article.image && article.image.startsWith('http') && !article.image.includes('placeholder')) {
      try {
        await axios.post(`https://api.telegram.org/bot${token}/sendPhoto`, {
          chat_id: channelId,
          photo: article.image,
          caption: caption,
          parse_mode: 'Markdown',
        }, { timeout: 10000 });
        console.log(`[TelegramPublisher] ✅ Successfully posted photo article "${title.slice(0, 30)}..." to Telegram ${channelId}`);
        return true;
      } catch (photoErr) {
        console.warn(`[TelegramPublisher] Photo send failed (${photoErr.message}), falling back to text message.`);
      }
    }

    // Text message fallback
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: channelId,
      text: caption,
      parse_mode: 'Markdown',
      disable_web_page_preview: false,
    }, { timeout: 10000 });

    console.log(`[TelegramPublisher] ✅ Successfully posted text article "${title.slice(0, 30)}..." to Telegram ${channelId}`);
    return true;
  } catch (err) {
    console.error(`[TelegramPublisher] ❌ Failed to post to Telegram: ${err.response?.data?.description || err.message}`);
    return false;
  }
}

module.exports = {
  postToTelegramChannel,
};
