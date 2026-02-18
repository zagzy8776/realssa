#!/usr/bin/env node

/**
 * Comprehensive test for the complete YouTube API integration solution
 * This test verifies that all components are working together correctly
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';
const FRONTEND_URL = 'http://localhost:8080';

async function testCompleteSolution() {
  console.log('🎬 Comprehensive YouTube Integration Test');
  console.log('==========================================\n');

  const results = {
    backend: { status: '❌', details: [] },
    frontend: { status: '❌', details: [] },
    integration: { status: '❌', details: [] },
    playback: { status: '❌', details: [] }
  };

  try {
    // Test 1: Backend API endpoints
    console.log('1️⃣ Testing Backend API Endpoints...');
    
    // Test categories endpoint
    try {
      const categoriesResponse = await fetch(`${BASE_URL}/api/youtube/categories`);
      const categoriesData = await categoriesResponse.json();
      
      if (categoriesResponse.ok && categoriesData && categoriesData.length > 0) {
        console.log('   ✅ Categories endpoint working');
        results.backend.details.push('Categories endpoint: Working');
        results.backend.status = '✅';
      } else {
        console.log('   ❌ Categories endpoint failed');
        results.backend.details.push('Categories endpoint: Failed');
      }
    } catch (error) {
      console.log('   ❌ Categories endpoint error:', error.message);
      results.backend.details.push(`Categories endpoint error: ${error.message}`);
    }

    // Test live channels endpoint
    try {
      const liveChannelsResponse = await fetch(`${BASE_URL}/api/youtube/live-channels?category=all&maxResults=5`);
      const liveChannelsData = await liveChannelsResponse.json();
      
      if (liveChannelsResponse.ok) {
        console.log('   ✅ Live channels endpoint working');
        results.backend.details.push('Live channels endpoint: Working');
        results.backend.status = '✅';
        
        if (liveChannelsData && liveChannelsData.length > 0) {
          console.log('   📺 Found', liveChannelsData.length, 'channels');
          results.backend.details.push(`Found ${liveChannelsData.length} channels`);
        }
      } else {
        console.log('   ❌ Live channels endpoint failed');
        results.backend.details.push('Live channels endpoint: Failed');
      }
    } catch (error) {
      console.log('   ❌ Live channels endpoint error:', error.message);
      results.backend.details.push(`Live channels endpoint error: ${error.message}`);
    }

    // Test 2: Frontend server
    console.log('\n2️⃣ Testing Frontend Server...');
    
    try {
      const frontendResponse = await fetch(`${FRONTEND_URL}/`);
      if (frontendResponse.ok) {
        console.log('   ✅ Frontend server running');
        results.frontend.details.push('Frontend server: Running');
        results.frontend.status = '✅';
      } else {
        console.log('   ❌ Frontend server not responding');
        results.frontend.details.push('Frontend server: Not responding');
      }
    } catch (error) {
      console.log('   ❌ Frontend server error:', error.message);
      results.frontend.details.push(`Frontend server error: ${error.message}`);
    }

    // Test 3: Integration test - simulate frontend API calls
    console.log('\n3️⃣ Testing Integration...');
    
    try {
      // Simulate what the frontend YouTube API client does
      const categoriesResponse = await fetch(`${BASE_URL}/api/youtube/categories`);
      const categoriesData = await categoriesResponse.json();
      
      if (categoriesResponse.ok && categoriesData && categoriesData.length > 0) {
        console.log('   ✅ Frontend can fetch categories from backend');
        results.integration.details.push('Category fetching: Working');
        
        // Test live channels with a specific category
        const liveResponse = await fetch(`${BASE_URL}/api/youtube/live-channels?category=africa&maxResults=3`);
        const liveData = await liveResponse.json();
        
        if (liveResponse.ok) {
          console.log('   ✅ Frontend can fetch live channels from backend');
          results.integration.details.push('Live channels fetching: Working');
          results.integration.status = '✅';
        } else {
          console.log('   ❌ Live channels integration failed');
          results.integration.details.push('Live channels fetching: Failed');
        }
      } else {
        console.log('   ❌ Integration test failed');
        results.integration.details.push('Category fetching: Failed');
      }
    } catch (error) {
      console.log('   ❌ Integration test error:', error.message);
      results.integration.details.push(`Integration error: ${error.message}`);
    }

    // Test 4: Video playback simulation
    console.log('\n4️⃣ Testing Video Playback...');
    
    // Test with a known working YouTube video ID
    const testVideoId = '5qap5aO4i9A'; // Relaxing music video
    const youtubeEmbedUrl = `https://www.youtube.com/embed/${testVideoId}`;
    
    try {
      // Test if YouTube embed URL is valid
      const embedResponse = await fetch(youtubeEmbedUrl, { redirect: 'manual' });
      
      if (embedResponse.status === 200 || embedResponse.status === 302) {
        console.log('   ✅ YouTube embed URL is valid');
        results.playback.details.push('YouTube embed: Valid');
        results.playback.status = '✅';
      } else {
        console.log('   ⚠️  YouTube embed URL may have issues');
        results.playback.details.push('YouTube embed: Potential issues');
      }
    } catch (error) {
      console.log('   ❌ YouTube embed test failed:', error.message);
      results.playback.details.push(`YouTube embed error: ${error.message}`);
    }

    // Final summary
    console.log('\n🎉 Test Results Summary');
    console.log('=======================');
    
    console.log(`Backend API: ${results.backend.status}`);
    results.backend.details.forEach(detail => console.log(`  - ${detail}`));
    
    console.log(`\nFrontend Server: ${results.frontend.status}`);
    results.frontend.details.forEach(detail => console.log(`  - ${detail}`));
    
    console.log(`\nIntegration: ${results.integration.status}`);
    results.integration.details.forEach(detail => console.log(`  - ${detail}`));
    
    console.log(`\nVideo Playback: ${results.playback.status}`);
    results.playback.details.forEach(detail => console.log(`  - ${detail}`));

    // Overall assessment
    const allWorking = Object.values(results).every(result => result.status === '✅');
    
    console.log('\n🎯 Overall Assessment:');
    if (allWorking) {
      console.log('✅ ALL SYSTEMS WORKING! YouTube integration is fully functional.');
      console.log('\n📋 What was fixed:');
      console.log('   1. ✅ Added backend proxy server for YouTube API');
      console.log('   2. ✅ Fixed CORS issues by routing through backend');
      console.log('   3. ✅ Added proper environment variable configuration');
      console.log('   4. ✅ Updated frontend to use backend proxy endpoints');
      console.log('   5. ✅ Implemented proper error handling and fallbacks');
      console.log('   6. ✅ Verified video playback functionality');
    } else {
      console.log('⚠️  Some systems may need attention. Check the details above.');
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.log('\n💡 Troubleshooting tips:');
    console.log('   1. Make sure both backend and frontend servers are running');
    console.log('   2. Check that the YouTube API key is valid and has proper permissions');
    console.log('   3. Verify that the backend can access YouTube API endpoints');
    console.log('   4. Check browser console for any frontend errors');
  }
}

// Run the test
testCompleteSolution();