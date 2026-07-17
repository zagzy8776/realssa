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

      console.log(`📣 Sending OneSignal notification to segment/topic: ${topic}`);

      // For general breaking news, just use the standard subscribed segment.
      // Do NOT include custom segments alongside 'Subscribed Users' — OneSignal will
      // double-deliver to users who belong to both, since 'Subscribed Users' is a
      // built-in catch-all that bypasses custom segment deduplication.
      const included_segments = ['All'];

      const notifPayload = {
        ...this._buildPayload(payload),
        included_segments,
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
    
    // Always use /read?url= for RSS articles (externalLink) to avoid 404s.
    // Never strip the rss- prefix from IDs — the DB stores them with it.
    let readerUrl = `${SITE_URL}/`;
    if (news.externalLink) {
      readerUrl = `${SITE_URL}/read?url=${encodeURIComponent(news.externalLink)}&category=${encodeURIComponent(news.category || 'news')}&id=${encodeURIComponent(news.id || '')}`;
    } else if (news.id) {
      readerUrl = `${SITE_URL}/article/${news.id}`;
    }
    
    // Clean source names from notification title if they are prepended
    const cleanNotifTitle = (rawTitle) => {
      if (!rawTitle) return 'New story available';
      return rawTitle
        .replace(/^\s*(Breaking|News|Alert|Update)\s*[:|-]\s*/i, '')
        .trim();
    };

    const rawTitle = news.title || news.summary || 'New story available';
    const cleanTitle = cleanNotifTitle(rawTitle);

    // Dynamic professional labeling
    const categoryLabel = news.category 
      ? news.category.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase()) 
      : 'News';
      
    let label = `RealSSA • ${categoryLabel}`;
    if (news.score >= 3) {
      label = `🚨 LIVE UPDATE • ${categoryLabel.toUpperCase()}`;
    } else if (news.score === 2) {
      label = `🗞️ JUST IN • ${categoryLabel.toUpperCase()}`;
    } else {
      label = `${emoji} ${categoryLabel} • RealSSA`;
    }

    // Build notification body: show excerpt if available so users know
    // what the article is about before tapping. Fall back to label + source.
    const rawExcerpt = news.excerpt || news.summary || '';
    const notifBody = rawExcerpt.length > 25
      ? `${label}\n\n${rawExcerpt.slice(0, 110).replace(/\s\w+$/, '')}...`
      : `${label} • ${news.source_name || 'News Source'}`;

    const payload = {
      // Headline is the Title (max 90 chars formatted elegantly)
      title: cleanTitle.length > 90 ? `${cleanTitle.slice(0, 87)}...` : cleanTitle,
      // Excerpt in the body — gives users a real reason to tap
      body:  notifBody,
      url:   readerUrl,
      category: news.category || 'general',
      image: news.image || null, // Passes the image to _buildPayload for rich notifications
      // Score-3 front-loaded hard alerts get max OneSignal priority
      ...(news.score >= 3 && { priority: 10 }),
    };
    console.log(`🔔 Sending [score=${news.score}] push: "${payload.title.slice(0, 50)}..." | Body: "${payload.body}"`);
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

