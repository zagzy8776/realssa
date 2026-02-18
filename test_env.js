#!/usr/bin/env node

/**
 * Test script to check environment variables
 */

import 'dotenv/config';

console.log('🔍 Environment Variable Test');
console.log('============================');
console.log('VITE_YOUTUBE_API_KEY:', process.env.VITE_YOUTUBE_API_KEY);
console.log('YOUTUBE_API_KEY:', process.env.YOUTUBE_API_KEY);
console.log('All env vars containing "YOUTUBE":');
Object.keys(process.env).forEach(key => {
  if (key.includes('YOUTUBE')) {
    console.log(`  ${key}: ${process.env[key]}`);
  }
});
console.log('============================');

// Test if the key is valid
const apiKey = process.env.YOUTUBE_API_KEY;
if (apiKey && apiKey.length > 0) {
  console.log('✅ YouTube API key found and valid');
} else {
  console.log('❌ YouTube API key not found or empty');
}