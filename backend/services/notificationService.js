const axios = require('axios');

const SITE_URL = 'https://realssanews.com.ng';
const LOGO_URL = `${SITE_URL}/logo.png`;

// Category → emoji mapping for breaking news
const CATEGORY_EMOJI = {
  'sports':        '⚽',
  'nigerian-news': '🇳🇬',
  'ghana':         '🇬🇭',
  'kenya':         '🇰🇪',
  'south-africa':  '🇿🇦',
  'uk':            '🇬🇧',
  'usa':           '🇺🇸',
  'crypto':        '₿',
  'culture':       '🎶',
  'entertainment': '🎬',
  'world':         '🌍',
  'jobs':          '💼',
};

class NotificationService {
  constructor() {
    this.appId = process.env.ONESIGNAL_APP_ID || "055b6596-a96c-48e2-8cda-ff4bb6d61009";
    this.apiKey = process.env.ONESIGNAL_API_KEY;

    if (!this.apiKey) {
      console.warn(
        '\n\n⚠️  ============================================================\n' +
        '   ONESIGNAL_API_KEY is NOT set in environment variables!\n' +
        '   Push notifications will NOT be sent to any users.\n' +
        '   → Go to: OneSignal Dashboard → Settings → Keys & IDs\n' +
        '   → Copy "REST API Key" → Add as ONESIGNAL_API_KEY env var\n' +
        '   ============================================================\n\n'
      );
    }
  }

  /**
   * Build the common OneSignal notification payload
   */
   _buildPayload({ title, body, url, category, priority, image }) {
    const articleUrl = url || SITE_URL;
    return {
      app_id: this.appId,
      headings: { en: title },
      contents: { en: body },
      url: articleUrl, // Targets both native mobile apps (Android/iOS) and web browsers
      web_url: articleUrl, // Fallback specifically for chrome/firefox web push
      chrome_web_icon: LOGO_URL,
      chrome_web_badge: LOGO_URL,
      large_icon: LOGO_URL,
      firefox_icon: LOGO_URL,
      android_accent_color: 'FFE63946',
      collapse_id: category || 'general',
      ...(priority !== undefined && { priority }),
      ...(image && {
        big_picture: image,
        ios_attachments: { "image1": image },
        chrome_web_image: image
      }),
    };
  }

  async sendToTopic(topic, payload) {
    try {
      if (!this.apiKey) {
        console.warn('ONESIGNAL_API_KEY is not set — skipping push notification to topic:', topic);
        return { success: false, message: 'Skipped — ONESIGNAL_API_KEY not configured' };
      }

      console.log(`📣 Sending OneSignal notification to topic: ${topic}`);

      // Map category to OneSignal segment tag filter.
      // Users who have never set a preference get ALL notifications (included_segments: ['All']).
      // Users who opted into specific categories only get their chosen ones.
      const CATEGORY_TAG_MAP = {
        'sports': 'sports',
        'nigerian-news': 'nigeria',
        'ghana': 'ghana',
        'kenya': 'kenya',
        'south-africa': 'south-africa',
        'crypto': 'crypto',
        'tech': 'tech',
        'business': 'business',
        'culture': 'culture',
        'entertainment': 'entertainment',
      };

      const categoryTag = CATEGORY_TAG_MAP[topic];

      // Build filters: target users who either (a) have this category tag = '1'
      // OR (b) have no category preferences set at all (tag 'has_prefs' != '1')
      let filters;
      if (categoryTag) {
        filters = [
          { field: 'tag', key: `cat_${categoryTag}`, relation: '=', value: '1' },
          { operator: 'OR' },
          { field: 'tag', key: 'has_prefs', relation: '!=', value: '1' },
        ];
      }

      const notifPayload = {
        ...this._buildPayload(payload),
        ...(filters ? { filters } : { included_segments: ['All'] }),
      };

      const response = await axios.post(
        'https://onesignal.com/api/v1/notifications',
        notifPayload,
        {
          headers: {
            Authorization: `Key ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('✅ OneSignal notification sent. ID:', response.data.id, '| Recipients:', response.data.recipients);
      return { success: true, messageId: response.data.id, recipients: response.data.recipients };
    } catch (error) {
      const errData = error.response?.data;
      console.error('❌ OneSignal push error:', errData || error.message);
      return { success: false, error: errData?.errors?.[0] || error.message };
    }
  }

  async sendBreakingNews(news) {
    const emoji = CATEGORY_EMOJI[news.category] || '📰';
    
    let readerUrl = `${SITE_URL}/`;
    if (news.externalLink) {
      readerUrl = `${SITE_URL}/read?url=${encodeURIComponent(news.externalLink)}&category=${encodeURIComponent(news.category || 'news')}&id=${encodeURIComponent(news.id || '')}`;
    } else if (news.id) {
      readerUrl = `${SITE_URL}/article/${news.id}`;
    }

    const rawTitle = (news.title || news.summary || 'New story available')
      .replace(/^\s*(Breaking|News|Alert|Update)\s*[:|-]\s*/i, '')
      .trim();

    // Title: score prefix + clean headline (max 90 chars)
    let titlePrefix = emoji;
    if (news.score >= 3) titlePrefix = '🚨';
    else if (news.score === 2) titlePrefix = '🗞️';
    const fullTitle = `${titlePrefix} ${rawTitle}`;
    const notifTitle = fullTitle.length > 90 ? `${fullTitle.slice(0, 87)}...` : fullTitle;

    // Body: source name + clean excerpt — no label padding, max 120 chars of real content
    const rawExcerpt = (news.excerpt || news.summary || '').replace(/<[^>]+>/g, '').trim();
    const sourceLine = news.source_name ? `${news.source_name} • RealSSA` : 'RealSSA News';
    const notifBody = rawExcerpt.length > 20
      ? `${sourceLine}\n${rawExcerpt.slice(0, 120).replace(/\s\S+$/, '')}…`
      : sourceLine;

    const payload = {
      title: notifTitle,
      body:  notifBody,
      url:   readerUrl,
      category: news.category || 'general',
      image: news.image || null,
      ...(news.score >= 3 && { priority: 10 }),
    };
    console.log(`🔔 Sending [score=${news.score}] push: "${payload.title.slice(0, 60)}"`);
    return await this.sendToTopic(news.category || 'general', payload);
  }

  async sendToUser(userIds, payload) {
    try {
      if (!this.apiKey) {
        console.warn('ONESIGNAL_API_KEY is not set — skipping push to user:', userIds);
        return { success: false, message: 'Skipped — ONESIGNAL_API_KEY not configured' };
      }

      const ids = Array.isArray(userIds) ? userIds.map(String) : [String(userIds)];
      if (ids.length === 0) return { success: true, message: 'No users to notify' };

      const notifPayload = {
        ...this._buildPayload(payload),
        include_external_user_ids: ids,
      };

      const response = await axios.post(
        'https://onesignal.com/api/v1/notifications',
        notifPayload,
        {
          headers: {
            Authorization: `Key ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('✅ OneSignal user notification sent. ID:', response.data.id, 'to', ids.length, 'devices');
      return { success: true, messageId: response.data.id };
    } catch (error) {
      const errData = error.response?.data;
      console.error('❌ OneSignal sendToUser error:', errData || error.message);
      return { success: false, error: errData?.errors?.[0] || error.message };
    }
  }

  // Alias for sportsBot compatibility
  async sendPushNotification(payload, deviceIds) {
    return this.sendToUser(deviceIds, payload);
  }

  // Compatibility stubs (kept for route compatibility)
  async subscribeToTopic(token, topic) {
    return { success: true };
  }

  async unsubscribeFromTopic(token, topic) {
    return { success: true };
  }
}

module.exports = new NotificationService();

