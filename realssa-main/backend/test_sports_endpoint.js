/**
 * Quick test to verify /api/sports/matches returns directSources
 */

const axios = require('axios');

const BACKEND_URL = process.env.BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:5000';

async function testSportsEndpoint() {
  console.log('Testing /api/sports/matches endpoint...\n');
  
  try {
    const response = await axios.get(`${BACKEND_URL}/api/sports/matches`, {
      timeout: 10000
    });
    
    const data = response.data;
    console.log(`✅ Status: ${response.status}`);
    console.log(`✅ Total matches: ${data.count || data.matches?.length || 0}`);
    console.log(`✅ Live matches: ${data.liveCount || 0}`);
    
    if (!data.matches || !Array.isArray(data.matches)) {
      console.error('❌ No matches array in response!');
      return;
    }
    
    // Check for directSources in matches
    const withSources = data.matches.filter(m => m.directSources?.length > 0);
    console.log(`✅ Matches with directSources: ${withSources.length}/${data.matches.length}`);
    
    if (withSources.length === 0) {
      console.warn('⚠️  No matches have directSources - this might be expected if no matches are live');
      console.log('\nSample match structure:');
      console.log(JSON.stringify(data.matches[0], null, 2));
    } else {
      console.log('\n✅ SUCCESS! Found matches with directSources:');
      console.log(`\nFirst match with sources: ${withSources[0].event}`);
      console.log(`  - Sport: ${withSources[0].sport}`);
      console.log(`  - Live: ${withSources[0].isLive ? 'Yes' : 'No'}`);
      console.log(`  - Sources: ${withSources[0].directSources.length}`);
      console.log(`  - Sample source: ${withSources[0].directSources[0]?.label || withSources[0].directSources[0]?.url}`);
    }
    
  } catch (error) {
    console.error('❌ Error testing endpoint:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testSportsEndpoint();
