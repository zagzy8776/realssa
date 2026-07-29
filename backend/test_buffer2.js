const { testBufferConnection } = require('./services/buffer');
require('dotenv').config();

const BUFFER_ACCESS_TOKEN = process.env.BUFFER_ACCESS_TOKEN || process.env.BUFFER_S_TOKEN || 'XgC6VYuJXL4xvvPRJolhwEdpK5iC4xwJutuSVPqf7Aw';
const BUFFER_API_ENDPOINT = 'https://api.buffer.com/graphql';

async function run() {
  const profileId = '6a5c8546e2638b94d7959a2c'; // Instagram

  const input = {
    channelId: profileId,
    text: 'Test message for Instagram!',
    schedulingType: 'automatic',
    mode: 'shareNow',
    saveToDraft: false,
    type: 'post', // Try adding this back
    assets: [{ image: { url: 'https://realssanews.com.ng/logo.png' } }]
  };

  const mutation = {
    query: `
      mutation CreatePost($input: CreatePostInput!) {
        createPost(input: $input) {
          ... on PostActionSuccess { post { id dueAt } }
          ... on MutationError { message }
        }
      }
    `,
    variables: { input }
  };

  const res = await fetch(BUFFER_API_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${BUFFER_ACCESS_TOKEN}` },
    body: JSON.stringify(mutation)
  });

  console.log('Status:', res.status);
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

run();
