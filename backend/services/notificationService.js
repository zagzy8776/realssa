const axios = require('axios');

const SITE_URL = 'https://www.realssanews.com.ng';
const LOGO_URL = `${SITE_URL}/logo.png`;

const CATEGORY_EMOJI = {
  sports: '⚽',
  'nigerian-news': '🇳🇬',
  ghana: '🇬🇭',
  kenya: '🇰🇪',
  'south-africa': '🇿🇦',
  uk: '🇬🇧',
  usa: '🇺🇸',
  crypto: '₿',
  culture: '🎶',
  entertainment: '🎬',
  world: '🌍',
  jobs: '💼',
  tech: '💻',
  business: '📈',
  science: '🔬',
  lifestyle: '✨',
};

function decodeHtmlEntities(str) {
  if (!str) return '';
  return String(str)
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

class NotificationService {
  constructor() {
    this.appId = process.env.ONESIGNAL_APP_ID || '055b6596-a96c-48e2-8cda-ff4bb6d61009';
    this.apiKey = process.env.ONESIGNAL_API_KEY;

    if (!this.apiKey) {
      console.warn('[OneSignal] ONESIGNAL_API_KEY is not configured; push delivery is disabled.');
    }
  }

  _buildPayload({ title, body, url, image, priority }) {
    return {
      app_id: this.appId,
      target_channel: 'push',
      headings: { en: title },
      contents: { en: body },
      url: url || SITE_URL,
      chrome_web_icon: LOGO_URL,
      chrome_web_badge: LOGO_URL,
      large_icon: LOGO_URL,
      firefox_icon: LOGO_URL,
      ...(priority !== undefined ? { priority } : {}),
      ...(image ? {
        big_picture: image,
        chrome_web_image: image,
        ios_attachments: { image1: image },
      } : {}),
    };
  }

  async sendToTopic(topic, payload) {
    if (!this.apiKey) {
      return { success: false, message: 'ONESIGNAL_API_KEY not configured' };
    }

    try {
      console.log(`[OneSignal] Sending push to subscribed users: ${topic}`);

      // OneSignal's current API uses the "Subscribed Users" segment for the
      // active push audience. The old "All" segment can resolve to no users.
      const notifPayload = {
        ...this._buildPayload(payload),
        included_segments: ['Subscribed Users'],
      };

      const response = await axios.post(
        'https://api.onesignal.com/notifications?c=push',
        notifPayload,
        {
          timeout: 10000,
          headers: {
            Authorization: `Key ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const id = response.data?.id;
      const recipients = Number(response.data?.recipients || 0);
      console.log(`[OneSignal] Push accepted. id=${id || 'none'} recipients=${recipients}`);

      return { success: true, messageId: id, recipients };
    } catch (error) {
      const errData = error.response?.data;
      console.error('[OneSignal] Push error:', errData || error.message);
      return {
        success: false,
        error: errData?.errors?.[0] || errData?.errors || error.message,
        status: error.response?.status,
      };
    }
  }

  async sendBreakingNews(news) {
    const emoji = CATEGORY_EMOJI[news.category] || '📰';
    let readerUrl = `${SITE_URL}/`;

    if (news.externalLink) {
      readerUrl = `${SITE_URL}/read?url=${encodeURIComponent(news.externalLink)}&category=${encodeURIComponent(news.category || 'news')}&id=${encodeURIComponent(news.id || '')}`;
    } else if (news.id) {
      readerUrl = `${SITE_URL}/article/${encodeURIComponent(news.id)}`;
    }

    const rawTitle = decodeHtmlEntities(news.title || news.summary || 'New story available')
      .replace(/^\s*(Breaking|News|Alert|Update)\s*[:|-]\s*/i, '')
      .trim();

    let titlePrefix = emoji;
    if (Number(news.score) >= 3) titlePrefix = '🚨';
    else if (Number(news.score) === 2) titlePrefix = '🗞️';

    const fullTitle = `${titlePrefix} ${rawTitle}`;
    const notifTitle = fullTitle.length > 90 ? `${fullTitle.slice(0, 87)}...` : fullTitle;

    const rawExcerpt = decodeHtmlEntities(
      String(news.excerpt || news.summary || '').replace(/<[^>]+>/g, '')
    ).trim();
    const notifBody = rawExcerpt.length > 15
      ? (rawExcerpt.length > 135 ? `${rawExcerpt.slice(0, 135).replace(/\s\S+$/, '')}…` : rawExcerpt)
      : 'Tap to read the latest story on RealSSA News.';

    return this.sendToTopic(news.category || 'general', {
      title: notifTitle,
      body: notifBody,
      url: readerUrl,
      image: news.image || null,
      ...(Number(news.score) >= 3 ? { priority: 10 } : {}),
    });
  }

  async sendToUser(userIds, payload) {
    if (!this.apiKey) {
      return { success: false, message: 'ONESIGNAL_API_KEY not configured' };
    }

    const ids = Array.isArray(userIds) ? userIds.map(String).filter(Boolean) : [String(userIds)].filter(Boolean);
    if (!ids.length) return { success: true, message: 'No users to notify' };

    try {
      const response = await axios.post(
        'https://api.onesignal.com/notifications?c=push',
        {
          ...this._buildPayload(payload),
          include_aliases: { external_id: ids },
          target_channel: 'push',
        },
        {
          timeout: 10000,
          headers: {
            Authorization: `Key ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return { success: true, messageId: response.data?.id };
    } catch (error) {
      const errData = error.response?.data;
      console.error('[OneSignal] User push error:', errData || error.message);
      return { success: false, error: errData?.errors || error.message, status: error.response?.status };
    }
  }

  async sendPushNotification(payload, deviceIds) {
    return this.sendToUser(deviceIds, payload);
  }

  // Kept for compatibility with older callers. Subscription state is now
  // managed by the Web SDK / OneSignal User model.
  async subscribeToTopic() {
    return { success: true };
  }

  async unsubscribeFromTopic() {
    return { success: true };
  }
}

module.exports = new NotificationService();
