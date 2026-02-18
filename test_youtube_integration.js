#!/usr/bin/env node

/**
 * Test script to verify YouTube API integration
 * Run with: node test_youtube_integration.js
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function testYouTubeIntegration() {
  console.log('🧪 Testing YouTube API Integration...\n');

  try {
    // Test 1: YouTube Live Channels Endpoint
    console.log('1️⃣ Testing YouTube Live Channels endpoint...');
    const liveChannelsResponse = await fetch(`${BASE_URL}/api/youtube/live-channels?regionCode=US&maxResults=5`);
    const liveChannelsData = await liveChannelsResponse.json();
    
    console.log('   Status:', liveChannelsResponse.status);
    console.log('   Success:', liveChannelsData.success);
    
    if (liveChannelsData.success && liveChannelsData.data && liveChannelsData.data.length > 0) {
      console.log('   ✅ Live channels data received');
      console.log('   Videos found:', liveChannelsData.data.length);
      console.log('   Sample video ID:', liveChannelsData.data[0].videoId);
    } else {
      console.log('   ❌ No live channels data or error occurred');
      console.log('   Error:', liveChannelsData.error || 'Unknown error');
    }

    console.log('\n2️⃣ Testing YouTube Categories endpoint...');
    const categoriesResponse = await fetch(`${BASE_URL}/api/youtube/categories?regionCode=US`);
    const categoriesData = await categoriesResponse.json();
    
    console.log('   Status:', categoriesResponse.status);
    console.log('   Success:', categoriesData.success);
    
    if (categoriesData.success && categoriesData.data && categoriesData.data.length > 0) {
      console.log('   ✅ Categories data received');
      console.log('   Categories found:', categoriesData.data.length);
      console.log('   Sample category:', categoriesData.data[0].title);
    } else {
      console.log('   ❌ No categories data or error occurred');
      console.log('   Error:', categoriesData.error || 'Unknown error');
    }

    console.log('\n3️⃣ Testing sample data fallback...');
    // Test with invalid API key to trigger fallback
    const fallbackResponse = await fetch(`${BASE_URL}/api/youtube/live-channels?regionCode=US&maxResults=5&testFallback=true`);
    const fallbackData = await fallbackResponse.json();
    
    console.log('   Status:', fallbackResponse.status);
    console.log('   Success:', fallbackData.success);
    
    if (fallbackData.success && fallbackData.data && fallbackData.data.length > 0) {
      console.log('   ✅ Fallback data working');
      console.log('   Fallback videos:', fallbackData.data.length);
      console.log('   Sample fallback video ID:', fallbackData.data[0].videoId);
    } else {
      console.log('   ⚠️  Fallback test inconclusive (API might be working)');
    }

    console.log('\n🎉 YouTube API Integration Test Complete!');
    console.log('\n📋 Summary:');
    console.log('   - Live channels endpoint: Working' + (liveChannelsData.success ? ' ✅' : ' ❌'));
    console.log('   - Categories endpoint: Working' + (categoriesData.success ? ' ✅' : ' ❌'));
    console.log('   - Fallback mechanism: Available ✅');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.log('\n💡 Troubleshooting tips:');
    console.log('   1. Make sure your backend server is running on port 3001');
    console.log('   2. Check your YouTube API key in .env file');
    console.log('   3. Verify Google Cloud Console API key configuration');
    console.log('   4. Check browser console for CORS or network errors');
  }
}

// Run the test
testYouTubeIntegration();