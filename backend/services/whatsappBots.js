/**
 * WhatsApp Channel Bot Service — powered by whatsapp-web.js
 *
 * Uses a real WhatsApp Web browser session (Puppeteer) so it can post
 * directly to your channel as the owner — exactly like a human would.
 *
 * FIRST RUN: scan the QR code printed in the server logs once.
 * After that the session is saved to ./wa_session/ and auto-reconnects.
 *
 * Bot 1 — News Publisher   : AI-summarized article + image every 30 min
 * Bot 2 — Sports Notifier  : kickoff alerts, half-time check-ins, full-time scores
 * Bot 3 — Trending Videos  : trending YouTube/sports clips every 2 hours
 *
 * Required env vars:
 *   WA_CHANNEL_ID   — your channel JID (auto-detected on first run if not set)
 *   GROQ_API_KEY    — for AI summaries (falls back to raw excerpt)
 *   YOUTUBE_API_KEY — for Bot 3 trending videos (optional)
 */

const path = require('path');
const axios = require('axios');

let Client, LocalAuth, MessageMedia;
try {
  const wwebjs = require('whatsapp-web.js');
  Client = wwebjs.Client;
  LocalAuth = wwebjs.LocalAuth;
  MessageMedia = wwebjs.MessageMedia;
} catch (e) {
  console.warn('[WA Bots] whatsapp-web.js not installed yet — bots disabled until next deploy');
}

const CHANNEL_INVITE = '0029VbDetsPGufIx3Totk938'; // from your invite link
const SESSION_DIR = path.join(__dirname, '..', 'wa_session');
const GROQ_KEY = process.env.GROQ_WA_KEY || process.env.GROQ_API_KEY?.split(',').pop()?.trim();

let waClient = null;
let channelJid = process.env.WA_CHANNEL_ID || null;
let clientReady = false;

// ─── Groq summarizer ──────────────────────────────────────────────────────────
async function groqSummarize(title, excerpt) {
  if (!GROQ_KEY) return excerpt?.slice(0, 200) || title;
  try {
    const r = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are a WhatsApp news editor for RealSSA News — Africa's top news platform.
Write a punchy 2-3 sentence WhatsApp summary. Sound like a smart human friend sharing breaking news.
Use 1-2 relevant emojis naturally. End with a hook. Max 200 characters total.`
          },
          { role: 'user', content: `Title: ${title}\n\nExcerpt: ${excerpt || ''}` }
        ],
        max_tokens: 120,
        temperature: 0.75
      },
      { headers: { Authorization: `Bearer ${GROQ_KEY}` }, timeout: 8000 }
    );
    return r.data.choices?.[0]?.message?.content?.trim() || excerpt?.slice(0, 200);
  } catch (e) {
    return excerpt?.slice(0, 200) || title;
  }
}

// ─── Send text to channel ─────────────────────────────────────────────────────
async function sendToChannel(text) {
  if (!clientReady || !waClient || !channelJid) {
    console.warn('[WA Bots] Client not ready or channel JID unknown — skipping send');
    return false;
  }
  try {
    await waClient.sendMessage(channelJid, text);
    return true;
  } catch (e) {
    console.error('[WA Bots] sendToChannel failed:', e.message);
    return false;
  }
}

// ─── Send image + caption to channel ─────────────────────────────────────────
async function sendImageToChannel(imageUrl, caption) {
  if (!clientReady || !waClient || !channelJid) return false;
  try {
    const media = await MessageMedia.fromUrl(imageUrl, { unsafeMime: true });
    await waClient.sendMessage(channelJid, media, { caption });
    return true;
  } catch (e) {
    console.warn('[WA Bots] Image send failed, falling back to text:', e.message);
    return sendToChannel(caption);
  }
}

// ─── BOT 1: News Publisher (every 30 min) ────────────────────────────────────
const postedArticleIds = new Set();

async function runNewsPublisherBot(pool) {
  if (!clientReady || !pool) return;
  try {
    const result = await pool.query(`
      SELECT id, title, original_excerpt, ai_summary, image, external_link, category, source_name
      FROM rss_articles
      WHERE image IS NOT NULL AND image != ''
        AND published_at > NOW() - INTERVAL '2 hours'
      ORDER BY published_at DESC
      LIMIT 20
    `);

    const article = result.rows.find(r => !postedArticleIds.has(String(r.id)));
    if (!article) { console.log('[WA NewsBot] No new articles'); return; }

    postedArticleIds.add(String(article.id));

    const summary = await groqSummarize(article.title, article.ai_summary || article.original_excerpt);
    const articleUrl = `https://www.realssanews.com.ng/article/rss-${article.id}`;
    const category = (article.category || 'News').toUpperCase().replace(/[^A-Z0-9]/gi, '');

    const caption =
      `📰 *${article.title}*\n\n` +
      `${summary}\n\n` +
      `🏷️ #${category}\n` +
      `👉 ${articleUrl}\n\n` +
      `📲 Follow: https://whatsapp.com/channel/0029VbDetsPGufIx3Totk938`;

    const sent = await sendImageToChannel(article.image, caption);
    console.log(`[WA NewsBot] ${sent ? '✅' : '❌'} "${article.title.slice(0, 50)}"`);
  } catch (e) {
    console.error('[WA NewsBot] Error:', e.message);
  }
}

// ─── BOT 2: Sports Notifier (every 5 min) ────────────────────────────────────
const notifiedMatches = new Map();

async function runSportsNotifierBot(pool) {
  if (!clientReady || !pool) return;
  try {
    const result = await pool.query(`
      SELECT provider_match_id, competition_name,
             home_team_name, away_team_name,
             home_score, away_score, status, minute, kickoff_at
      FROM matches
      WHERE kickoff_at > NOW() - INTERVAL '3 hours'
        AND kickoff_at < NOW() + INTERVAL '20 minutes'
      ORDER BY kickoff_at ASC LIMIT 10
    `);

    const now = Date.now();
    for (const match of result.rows) {
      const id = match.provider_match_id;
      if (!notifiedMatches.has(id)) notifiedMatches.set(id, {});
      const state = notifiedMatches.get(id);
      const kickoffMs = new Date(match.kickoff_at).getTime();
      const minsToKickoff = (kickoffMs - now) / 60000;
      const minuteInGame = parseInt(match.minute) || 0;

      if (!state.kickoff && minsToKickoff > 0 && minsToKickoff <= 20) {
        state.kickoff = true;
        await sendToChannel(
          `⚽ *MATCH STARTING SOON!*\n\n` +
          `🏆 ${match.competition_name}\n` +
          `🆚 *${match.home_team_name}* vs *${match.away_team_name}*\n` +
          `⏰ Kicks off in ~${Math.round(minsToKickoff)} minutes!\n\n` +
          `Who are you backing? Drop your prediction 👇\n\n` +
          `📲 https://whatsapp.com/channel/0029VbDetsPGufIx3Totk938`
        );
        console.log(`[WA SportsBot] ✅ Pre-match: ${match.home_team_name} vs ${match.away_team_name}`);
      }

      if (!state.halftime && match.status === 'live' && minuteInGame >= 44 && minuteInGame <= 50) {
        state.halftime = true;
        const score = `${match.home_score ?? 0} - ${match.away_score ?? 0}`;
        await sendToChannel(
          `🔔 *HALF TIME!*\n\n` +
          `⚽ ${match.home_team_name} *${score}* ${match.away_team_name}\n` +
          `🏆 ${match.competition_name}\n\n` +
          `What do you think? Who scores next? 👇\n\n` +
          `📲 https://whatsapp.com/channel/0029VbDetsPGufIx3Totk938`
        );
      }

      if (!state.fulltime && match.status === 'finished') {
        state.fulltime = true;
        const score = `${match.home_score ?? 0} - ${match.away_score ?? 0}`;
        const winner = match.home_score > match.away_score ? match.home_team_name
          : match.away_score > match.home_score ? match.away_team_name : null;
        await sendToChannel(
          `🔔 *FULL TIME!*\n\n` +
          `⚽ *${match.home_team_name} ${score} ${match.away_team_name}*\n` +
          `🏆 ${match.competition_name}\n` +
          `${winner ? `🏆 ${winner} wins!` : `🤝 It's a draw!`}\n\n` +
          `React with your thoughts 👇\n\n` +
          `📲 https://whatsapp.com/channel/0029VbDetsPGufIx3Totk938`
        );
      }
    }
  } catch (e) {
    console.error('[WA SportsBot] Error:', e.message);
  }
}

// ─── BOT 3: Trending Videos (every 2 hours) ──────────────────────────────────
const postedVideoIds = new Set();

async function runTrendingVideosBot() {
  if (!clientReady) return;
  const ytKey = process.env.YOUTUBE_API_KEY;
  if (!ytKey) return;
  try {
    const queries = ['Nigeria news today', 'Africa football highlights', 'Afrobeats trending'];
    const query = queries[Math.floor(Date.now() / (2 * 3600000)) % queries.length];

    const searchRes = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet', q: query, type: 'video', order: 'viewCount',
        publishedAfter: new Date(Date.now() - 6 * 3600000).toISOString(),
        maxResults: 5, key: ytKey
      },
      timeout: 8000
    });

    const videos = (searchRes.data.items || []).filter(v => !postedVideoIds.has(v.id.videoId));
    if (!videos.length) return;

    const video = videos[0];
    postedVideoIds.add(video.id.videoId);

    const title = video.snippet.title;
    const videoUrl = `https://youtu.be/${video.id.videoId}`;
    const thumb = video.snippet.thumbnails?.high?.url;

    let hook = `🎬 Trending now: ${title}`;
    if (GROQ_KEY) {
      try {
        const r = await axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: 'Write a 1-sentence excited human WhatsApp hook for this trending video. Max 80 chars.' },
              { role: 'user', content: `Video: ${title}` }
            ],
            max_tokens: 60, temperature: 0.8
          },
          { headers: { Authorization: `Bearer ${GROQ_KEY}` }, timeout: 6000 }
        );
        hook = r.data.choices?.[0]?.message?.content?.trim() || hook;
      } catch (_) {}
    }

    const caption =
      `🎬 *${hook}*\n\n` +
      `▶️ ${videoUrl}\n\n` +
      `📲 https://whatsapp.com/channel/0029VbDetsPGufIx3Totk938`;

    const sent = thumb ? await sendImageToChannel(thumb, caption) : await sendToChannel(caption);
    console.log(`[WA VideoBot] ${sent ? '✅' : '❌'} "${title.slice(0, 50)}"`);
  } catch (e) {
    console.error('[WA VideoBot] Error:', e.message);
  }
}

// ─── Initialize WhatsApp client + start bots ─────────────────────────────────
function initWhatsAppBots(pool) {
  if (!Client) {
    console.log('[WA Bots] whatsapp-web.js not available — skipping');
    return;
  }

  console.log('📲 [WA Bots] Initializing WhatsApp Web client...');

  waClient = new Client({
    authStrategy: new LocalAuth({ dataPath: SESSION_DIR }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    }
  });

  // Print QR to terminal on first run
  waClient.on('qr', (qr) => {
    console.log('\n📲 [WA Bots] Scan this QR code with the RealSSA WhatsApp number:\n');
    try {
      const qrcode = require('qrcode-terminal');
      qrcode.generate(qr, { small: true });
    } catch (_) {
      console.log('QR:', qr);
    }
  });

  waClient.on('authenticated', () => {
    console.log('✅ [WA Bots] WhatsApp authenticated');
  });

  waClient.on('ready', async () => {
    console.log('✅ [WA Bots] WhatsApp client ready');
    clientReady = true;

    // Auto-detect channel JID if not set
    if (!channelJid) {
      try {
        const chats = await waClient.getChats();
        const channel = chats.find(c =>
          c.id?.server === 'newsletter' ||
          (c.id?._serialized || '').includes('@newsletter')
        );
        if (channel) {
          channelJid = channel.id._serialized;
          console.log(`✅ [WA Bots] Channel JID detected: ${channelJid}`);
        } else {
          // Use invite code directly as JID
          channelJid = `${CHANNEL_INVITE}@newsletter`;
          console.log(`[WA Bots] Using invite-based JID: ${channelJid}`);
        }
      } catch (e) {
        channelJid = `${CHANNEL_INVITE}@newsletter`;
      }
    }

    // Start bots
    runNewsPublisherBot(pool);
    setInterval(() => runNewsPublisherBot(pool), 30 * 60 * 1000);

    runSportsNotifierBot(pool);
    setInterval(() => runSportsNotifierBot(pool), 5 * 60 * 1000);

    runTrendingVideosBot();
    setInterval(() => runTrendingVideosBot, 2 * 60 * 60 * 1000);

    console.log('📲 [WA Bots] All 3 bots running');
  });

  waClient.on('disconnected', (reason) => {
    console.warn('[WA Bots] Disconnected:', reason);
    clientReady = false;
    // Reconnect after 30 seconds
    setTimeout(() => {
      console.log('[WA Bots] Reconnecting...');
      waClient.initialize().catch(e => console.error('[WA Bots] Reconnect failed:', e.message));
    }, 30000);
  });

  waClient.initialize().catch(e => {
    console.error('[WA Bots] Failed to initialize:', e.message);
  });
}

module.exports = { initWhatsAppBots, runNewsPublisherBot, runSportsNotifierBot, runTrendingVideosBot };
