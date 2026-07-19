// Load environment variables if available
require('dotenv').config();

const { testBufferConnection } = require('./services/buffer');

async function main() {
  console.log('Testing Buffer connection...');
  console.log('Environment BUFFER_ACCESS_TOKEN prefix:', process.env.BUFFER_ACCESS_TOKEN ? process.env.BUFFER_ACCESS_TOKEN.slice(0, 10) + '...' : 'undefined');
  console.log('Environment BUFFER_PROFILE_IDS:', process.env.BUFFER_PROFILE_IDS || 'undefined');

  const result = await testBufferConnection();
  console.log('Buffer Connection Test Result:', JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error('Buffer test run failed:', err);
});
