const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const notificationService = require('../services/notificationService');

// Users PostgreSQL connection
const usersDbUrl = process.env.USERS_DATABASE_URL || process.env.DATABASE_URL;
const pool = new Pool({
  connectionString: usersDbUrl,
  ssl: usersDbUrl ? { rejectUnauthorized: false } : undefined
});

// Subscribe to notifications
router.post('/subscribe', async (req, res) => {
  try {
    const { userId, subscription, topics } = req.body;
    
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ success: false, error: 'Subscription endpoint is required' });
    }

    const p256dh = subscription.keys ? subscription.keys.p256dh : null;
    const auth = subscription.keys ? subscription.keys.auth : null;
    
    // Save or update subscription in database
    const query = `
      INSERT INTO user_subscriptions (user_id, endpoint, p256dh, auth, topics, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (endpoint) 
      DO UPDATE SET user_id = $1, p256dh = $3, auth = $4, topics = $5, is_active = true
      RETURNING id
    `;
    const values = [userId, subscription.endpoint, p256dh, auth, topics || []];
    
    const dbRes = await pool.query(query, values);
    const subscriptionId = dbRes.rows[0].id;
    
    // Subscribe to topics in Firebase messaging
    if (topics && topics.length > 0) {
      for (const topic of topics) {
        try {
          await notificationService.subscribeToTopic(subscription.endpoint, topic);
        } catch (subErr) {
          console.warn(`Could not subscribe token to Firebase topic ${topic}:`, subErr.message);
          // Don't fail the whole request if Firebase topic subscription fails
        }
      }
    }
    
    res.json({ success: true, subscriptionId });
  } catch (error) {
    console.error('Error in /subscribe:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Unsubscribe from notifications
router.post('/unsubscribe', async (req, res) => {
  try {
    const { subscription } = req.body;
    
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ success: false, error: 'Subscription endpoint is required' });
    }

    // Set is_active = false
    await pool.query(
      'UPDATE user_subscriptions SET is_active = false WHERE endpoint = $1',
      [subscription.endpoint]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error in /unsubscribe:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send notification to category topic
router.post('/send-category', async (req, res) => {
  try {
    const { category, title, body, url } = req.body;
    
    const payload = {
      title,
      body,
      url,
      data: { category: String(category), timestamp: String(Date.now()) }
    };
    
    // Send to topic
    const result = await notificationService.sendToTopic(category, payload);
    res.json(result);
  } catch (error) {
    console.error('Error in /send-category:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send breaking news notification
router.post('/send-breaking', async (req, res) => {
  try {
    const { news } = req.body;
    
    if (!news) {
      return res.status(400).json({ success: false, error: 'News object is required' });
    }

    const result = await notificationService.sendBreakingNews(news);
    res.json(result);
  } catch (error) {
    console.error('Error in /send-breaking:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user preferences
router.get('/preferences/:userId', async (req, res) => {
  try {
    const resDb = await pool.query(
      'SELECT categories, topics, notification_settings AS "notificationSettings" FROM user_preferences WHERE user_id = $1',
      [req.params.userId]
    );
    
    if (resDb.rows.length > 0) {
      res.json({
        userId: req.params.userId,
        categories: resDb.rows[0].categories || [],
        topics: resDb.rows[0].topics || [],
        notificationSettings: resDb.rows[0].notificationSettings || {}
      });
    } else {
      res.json({ userId: req.params.userId, categories: [], topics: [], notificationSettings: {} });
    }
  } catch (error) {
    console.error('Error in /preferences GET:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update user preferences
router.put('/preferences/:userId', async (req, res) => {
  try {
    const { categories, topics, notificationSettings } = req.body;
    
    const query = `
      INSERT INTO user_preferences (user_id, categories, topics, notification_settings, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id)
      DO UPDATE SET categories = $2, topics = $3, notification_settings = $4, updated_at = CURRENT_TIMESTAMP
      RETURNING categories, topics, notification_settings AS "notificationSettings"
    `;
    
    const values = [
      req.params.userId,
      JSON.stringify(categories || []),
      JSON.stringify(topics || []),
      JSON.stringify(notificationSettings || {})
    ];
    
    const resDb = await pool.query(query, values);
    
    res.json({
      userId: req.params.userId,
      categories: resDb.rows[0].categories || [],
      topics: resDb.rows[0].topics || [],
      notificationSettings: resDb.rows[0].notificationSettings || {}
    });
  } catch (error) {
    console.error('Error in /preferences PUT:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test notification
router.post('/test', async (req, res) => {
  try {
    const { userId, title, body, url } = req.body;
    
    const result = await notificationService.sendToUser(userId, {
      title: title || 'Test Notification',
      body: body || 'This is a test notification from RealSSA News',
      url: url || '/'
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error in /test route:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;