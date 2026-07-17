// Sets Vercel production environment variables from the current process environment.
// SECURITY: Do NOT hardcode secrets here. This file must never contain real
// credentials — read them from your local environment (e.g. a .env file that
// is gitignored) or pass them via the shell before running this script.
//
// Usage:
//   JWT_SECRET=... CRON_SECRET=... FOOTBALL_DATA_API_KEY=... node set_vercel_env.js
//
// Any key not present in process.env will be skipped (not overwritten with a
// placeholder), so it is safe to run this without all values set.

const { execSync, spawnSync } = require('child_process');

// Only push values that already exist in the environment. Never embed secrets.
const KEYS = [
  'DATABASE_URL',
  'USERS_DATABASE_URL',
  'CRON_SECRET',
  'JWT_SECRET',
  'GEMINI_API_KEY',
  'ONESIGNAL_API_KEY',
  'FOOTBALL_DATA_API_KEY'
];

let updated = 0;
for (const key of KEYS) {
  const value = process.env[key];
  if (!value) {
    console.log(`Skipping ${key} (not set in environment).`);
    continue;
  }
  console.log(`Updating ${key}...`);
  try {
    execSync(`npx vercel env rm ${key} production -y`, { stdio: 'ignore' });
  } catch (e) {
    // ignore if it didn't exist yet
  }

  const child = spawnSync('npx', ['vercel', 'env', 'add', key, 'production'], {
    input: value,
    encoding: 'utf-8',
    shell: true
  });
  console.log(child.stdout);
  if (child.status !== 0) {
    console.error(`Failed to add ${key}:`, child.stderr);
  } else {
    updated++;
  }
}
console.log(`Done. Updated ${updated} Vercel environment variable(s).`);