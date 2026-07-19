const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function test(url, body) {
  try {
    const res = await fetch(`${url}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    console.log(`URL: ${url}`);
    console.log(`Status: ${res.status} ${res.statusText}`);
    const text = await res.text();
    console.log(`Response: ${text.slice(0, 300)}`);
  } catch (err) {
    console.error(`Error for ${url}:`, err.message);
  }
}

async function main() {
  console.log('Gemini API Key Prefix:', GEMINI_API_KEY ? GEMINI_API_KEY.slice(0, 8) + '...' : 'undefined');
  
  const bodyText = { contents: [{ parts: [{ text: 'Hello, reply with one word.' }] }] };
  const bodyEmbed = { content: { parts: [{ text: 'Hello' }] } };

  console.log('\n--- TESTING CHAT ---');
  await test('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', bodyText);
  await test('https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent', bodyText);

  console.log('\n--- TESTING EMBEDDING ---');
  await test('https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent', bodyEmbed);
  await test('https://generativelanguage.googleapis.com/v1/models/text-embedding-004:embedContent', bodyEmbed);
}

main().catch(err => console.error(err));
