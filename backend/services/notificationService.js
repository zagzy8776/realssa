const admin = require('../config/firebase');
const webpush = require('web-push');

class NotificationService {
  constructor() {
    this.vapidKeys = {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY
    };
    
    webpush.setVapidDetails(
      'mailto:admin@realssa.com',
      this.vapidKeys.publicKey,
      this.vapidKeys.privateKey
    );
  }

  async sendToUser(userId, payload) {
    try {
      const UserSubscription = require('../models/userSubscriptions');
      const subscriptions = await UserSubscription.find({ userId, isActive: true });
      
      const promises = subscriptions.map(subscription => 
        webpush.sendNotification(subscription, JSON.stringify(payload))
      );
      
      await Promise.all(promises);
      return { success: true, sent: subscriptions.length };
    } catch (error) {
      console.error('Notification error:', error);
      return { success: false, error: error.message };
    }
  }

  async sendToTopic(topic, payload) {
    try {
      const message = {
        topic: topic,
        notification: {
          title: payload.title,
          body: payload.body,
          icon: '/favicon.ico',
          click_action: payload.url || '/'
        },
        data: payload.data || {}
      };

      // Convert all data values to strings
      if (message.data) {
        const stringData = {};
        Object.keys(message.data).forEach(key => {
          stringData[key] = String(message.data[key]);
        });
        message.data = stringData;
      }

      // Ensure all data values are strings
      if (message.data) {
        Object.keys(message.data).forEach(key => {
          if (typeof message.data[key] !== 'string') {
            message.data[key] = String(message.data[key]);
          }
        });
      }

      // Final validation - ensure all values are strings
      if (message.data) {
        const finalData = {};
        Object.keys(message.data).forEach(key => {
          finalData[key] = String(message.data[key]);
        });
        message.data = finalData;
      }

      // Debug: Log the final message structure
      console.log('Final message:', JSON.stringify(message, null, 2));

      const response = await admin.messaging().send(message);
      return { success: true, messageId: response };
    } catch (error) {
      console.error('Topic notification error:', error);
      return { success: false, error: error.message };
    }
  }

  async subscribeToTopic(token, topic) {
    try {
      await admin.messaging().subscribeToTopic([token], topic);
      return { success: true };
    } catch (error) {
      console.error('Subscribe error:', error);
      return { success: false, error: error.message };
    }
  }

  async unsubscribeFromTopic(token, topic) {
    try {
      await admin.messaging().unsubscribeFromTopic([token], topic);
      return { success: true };
    } catch (error) {
      console.error('Unsubscribe error:', error);
      return { success: false, error: error.message };
    }
  }

  async sendBreakingNews(news) {
    const payload = {
      title: news.title,
      body: news.summary,
      url: `/article/${news.id}`,
      data: { 
        newsId: String(news.id), 
        category: String(news.category),
        type: 'breaking-news',
        timestamp: String(Date.now())
      }
    };

    // Send to category topic
    await this.sendToTopic(news.category, payload);
    
    // Send to breaking news topic
    await this.sendToTopic('breaking-news', payload);
    
    return { success: true };
  }

  async sendCategoryNotification(category, title, body, url, data = {}) {
    const payload = {
      title,
      body,
      url,
      data: {
        category: String(category),
        timestamp: String(Date.now()),
        ...Object.fromEntries(
          Object.entries(data).map(([key, value]) => [key, String(value)])
        )
      }
    };

    return await this.sendToTopic(category, payload);
  }
}

module.exports = new NotificationService();