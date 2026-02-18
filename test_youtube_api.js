import fs from 'fs';
import fetch from 'node-fetch';

// Test the YouTube API functionality
async function testYouTubeAPI() {
  console.log('Testing YouTube API...');
  
  // Check if we can read the .env file
  try {
    const envContent = fs.readFileSync('.env', 'utf8');
    console.log('Environment file content:');
    console.log(envContent);
    
    // Extract the API key
    const apiKeyMatch = envContent.match(/VITE_YOUTUBE_API_KEY=(.+)/);
    const apiKey = apiKeyMatch ? apiKeyMatch[1] : null;
    console.log('Extracted API Key:', apiKey ? 'Found' : 'Not found');
    
    if (!apiKey) {
      console.log('No API key found, should use sample data');
      return;
    }
    
    // Test a simple YouTube API call
    const testUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=UC2Dj5hSvl9dz0KU3I6cX5QA&key=${apiKey}`;
    console.log('Testing API call to:', testUrl);
    
    const response = await fetch(testUrl);
    const data = await response.json();
    
    console.log('API Response status:', response.status);
    console.log('API Response data:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('Error testing YouTube API:', error.message);
  }
}

testYouTubeAPI();
