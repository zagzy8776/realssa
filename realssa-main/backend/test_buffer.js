const { testBufferConnection, postToBuffer } = require('./services/buffer');
require('dotenv').config();

async function run() {
  console.log('Testing Buffer connection...');
  const conn = await testBufferConnection();
  console.log('Connection Result:', JSON.stringify(conn, null, 2));

  if (conn.ok) {
    console.log('\nAttempting to send a test post to Buffer...');
    const success = await postToBuffer(
      { twitter: 'Test message for Twitter from Node API test!', facebook: 'Test message for Facebook!', instagram: 'Test message for Instagram!' },
      'https://realssanews.com.ng',
      'https://realssanews.com.ng/logo.png',
      true
    );
    console.log('Post success:', success);
  }
}

run();
