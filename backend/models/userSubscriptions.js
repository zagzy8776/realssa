const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  endpoint: { type: String, required: true },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true }
  },
  topics: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
});

const UserSubscription = mongoose.model('UserSubscription', subscriptionSchema);
module.exports = UserSubscription;