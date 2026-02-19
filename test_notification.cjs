const fetch = require('node-fetch');

const API_URL = 'http://localhost:5000';

async function testNotificationFlow() {
  console.log('🧪 Testing Notification Flow...\n');

  // Test 1: Check if backend is running
  console.log('1️⃣ Testing backend health...');
  try {
    const response = await fetch(`${API_URL}/api/articles/featured`);
    if (response.ok) {
      console.log('✅ Backend is running\n');
    } else {
      console.log('❌ Backend returned error:', response.status, '\n');
    }
  } catch (error) {
    console.log('❌ Backend not accessible:', error.message, '\n');
    console.log('Make sure backend is running on port 5000');
    return;
  }

  // Test 2: Test notification subscribe endpoint
  console.log('2️⃣ Testing /api/notifications/subscribe...');
  try {
    const testToken = 'test-fcm-token-' + Date.now();
    const response = await fetch(`${API_URL}/api/notifications/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: testToken,
        subscription: {
          endpoint: testToken,
          keys: {
            p256dh: 'test-p256dh-key',
            auth: 'test-auth-key'
          }
        },
        topics: ['breaking-news', 'general']
      }),
    });

    const data = await response.json();
    if (response.ok && data.success) {
      console.log('✅ Subscribe endpoint working');
      console.log('   Subscription ID:', data.subscriptionId, '\n');
    } else {
      console.log('❌ Subscribe failed:', data.error || 'Unknown error', '\n');
    }
  } catch (error) {
    console.log('❌ Subscribe endpoint error:', error.message, '\n');
  }

  // Test 3: Test send-breaking endpoint
  console.log('3️⃣ Testing /api/notifications/send-breaking...');
  try {
    const response = await fetch(`${API_URL}/api/notifications/send-breaking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        news: {
          id: 'test-' + Date.now(),
          title: 'Test Breaking News',
          summary: 'This is a test notification from RealSSA',
          category: 'breaking-news'
        }
      }),
    });

    const data = await response.json();
    if (response.ok) {
      console.log('✅ Send-breaking endpoint working');
      console.log('   Result:', JSON.stringify(data, null, 2), '\n');
    } else {
      console.log('❌ Send-breaking failed:', data.error || 'Unknown error', '\n');
    }
  } catch (error) {
    console.log('❌ Send-breaking endpoint error:', error.message, '\n');
  }

  // Test 4: Test unsubscribe endpoint
  console.log('4️⃣ Testing /api/notifications/unsubscribe...');
  try {
    const testToken = 'test-fcm-token-' + Date.now();
    // First subscribe
    await fetch(`${API_URL}/api/notifications/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: testToken,
        subscription: {
          endpoint: testToken,
          keys: {
            p256dh: 'test-p256dh-key',
            auth: 'test-auth-key'
          }
        },
        topics: ['breaking-news']
      }),
    });

    // Then unsubscribe
    const response = await fetch(`${API_URL}/api/notifications/unsubscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscription: {
          endpoint: testToken
        }
      }),
    });

    const data = await response.json();
    if (response.ok && data.success) {
      console.log('✅ Unsubscribe endpoint working\n');
    } else {
      console.log('❌ Unsubscribe failed:', data.error || 'Unknown error', '\n');
    }
  } catch (error) {
    console.log('❌ Unsubscribe endpoint error:', error.message, '\n');
  }

  console.log('🎉 Notification flow testing complete!');
  console.log('\n📋 Next steps:');
  console.log('   1. Open http://localhost:8081 in your browser');
  console.log('   2. Click "Get Alerts" button to enable notifications');
  console.log('   3. Check browser console for FCM token');
  console.log('   4. Use that token to send a test notification');
}

testNotificationFlow().catch(console.error);
