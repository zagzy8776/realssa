const mongoose = require('mongoose');

const preferenceSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  categories: [{
    category: String,
    enabled: Boolean,
    priority: { type: Number, default: 1 }
  }],
  topics: [{
    topic: String,
    enabled: Boolean
  }],
  notificationSettings: {
    enabled: { type: Boolean, default: true },
    quietHours: {
      start: String, // "22:00"
      end: String    // "07:00"
    },
    maxPerDay: { type: Number, default: 10 }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const UserPreference = mongoose.model('UserPreference', preferenceSchema);
module.exports = UserPreference;