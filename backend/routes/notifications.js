const express = require('express');
const router = express.Router();
const notificationService = require('../services/notificationService');
const UserSubscription = require('../models/userSubscriptions');
const UserPreference = require('../models/userPreferences');

// Subscribe to notifications
router.post('/subscribe', async (req, res) => {
  try {
    const { userId, subscription, topics } = req.body;
    
    // Save subscription to database
    const userSub = new UserSubscription({
      userId,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      topics: topics || []
    });
    
    await userSub.save();
    
    // Subscribe to topics
    for (const topic of topics) {
      await notificationService.subscribeToTopic(subscription.endpoint, topic);
    }
    
    res.json({ success: true, subscriptionId: userSub._id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Unsubscribe from notifications
router.post('/unsubscribe', async (req, res) => {
  try {
    const { subscription } = req.body;
    
    // Find and deactivate subscription
    const userSub = await UserSubscription.findOne({ endpoint: subscription.endpoint });
    if (userSub) {
      userSub.isActive = false;
      await userSub.save();
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send notification to category
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
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send breaking news notification
router.post('/send-breaking', async (req, res) => {
  try {
    const { news } = req.body;
    
    const result = await notificationService.sendBreakingNews(news);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user preferences
router.get('/preferences/:userId', async (req, res) => {
  try {
    const preferences = await UserPreference.findOne({ userId: req.params.userId });
    res.json(preferences || { userId: req.params.userId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update user preferences
router.put('/preferences/:userId', async (req, res) => {
  try {
    const { categories, topics, notificationSettings } = req.body;
    
    const preferences = await UserPreference.findOneAndUpdate(
      { userId: req.params.userId },
      { categories, topics, notificationSettings, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    
    res.json(preferences);
  } catch (error) {
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
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;