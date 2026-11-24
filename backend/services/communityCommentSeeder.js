/**
 * Community comment seeder
 * ----------------------
 * When a reader opens an article (or a bot cycle runs), plant 2–4 short,
 * natural comments from the persona roster so the thread is never empty.
 * Marked is_bot=true + bot_key='persona-seed' so they stay filterable.
 */

const { pickPersonas, hashSeed } = require('./commentPersonas');

const SEED_KEY = 'persona-seed';

const TEMPLATES = {
  casual: [
    'Just read this — interesting take. Curious what others think.',
    'Been seeing this story everywhere. Finally a clear write-up.',
    'Appreciate the update. Following this closely.',
    'Not sure how I feel about this yet, but the reporting is solid.',
    'Shared this with my group chat already.',
  ],
  thoughtful: [
    'The details here matter. Hope there is a follow-up on the next steps.',
    'This is bigger than the headline suggests. Worth reading fully.',
    'Good context in this piece. A lot of coverage skips the background.',
    'Still processing this. The implications are not small.',
    'Respect to the desk for putting this together cleanly.',
  ],
  direct: [
    'Straight to the point. This is what people needed to know.',
    'Okay this is important. Bookmarking for later.',
    'Clear reporting. No fluff.',
    'This changes how I was looking at the story.',
    'Thanks for covering it without the noise.',
  ],
  curious: [
    'Does anyone know if there is an official statement yet?',
    'What happens next on this? Anyone tracking updates?',
    'Is this connected to the earlier reports from last week?',
    'Genuine question — how widespread is this beyond the headline?',
    'Would love a deeper dive on the numbers behind this.',
  ],
  skeptical: [
    'Holding judgment until more sources confirm the key claims.',
    'Interesting, but I want to see the full data before reacting.',
    'Media moves fast on this topic. Staying cautious.',
    'Part of this tracks. The rest needs more evidence.',
    'Not buying every angle yet — still reading.',
  ],
  sports: [
    'What a result. The comments section is about to be wild.',
    'Been saying this all season. Finally someone wrote it up.',
    'Match day energy in the replies — let\'s go.',
    'Stats do not lie on this one.',
    'As a fan this hits different. Big moment.',
  ],
};

function pickTemplate(style, seed) {
  const list = TEMPLATES[style] || TEMPLATES.casual;
  return list[seed % list.length];
}

function buildComment(persona, article, index) {
  const seed = hashSeed(`${article.id}:${persona.name}:${index}`);
  let text = pickTemplate(persona.style, seed);

  // Light title hook without inventing facts
  const title = String(article.title || '').trim();
  if (title && seed % 3 === 0 && title.length < 90) {
    const hooks = [
      `Re: "${title.slice(0, 70)}" — ${text}`,
      `${text} Especially after reading "${title.slice(0, 60)}".`,
    ];
    text = hooks[seed % hooks.length];
  }

  // Keep short for mobile comment UX
  if (text.length > 280) text = text.slice(0, 277) + '…';
  return text;
}

/**
 * Seed persona comments for one article.
 * @returns {{ created: number, personas: string[] }}
 */
async function seedPersonaComments(client, article, { min = 2, max = 4 } = {}) {
  if (!client || !article?.id) return { created: 0, personas: [] };

  const aliases = [article.id];
  if (article.external_link) {
    const { createHash } = require('crypto');
    aliases.push(
      'rss-' + createHash('sha1').update(String(article.external_link).split('#')[0]).digest('hex').slice(0, 16)
    );
  }

  // Already seeded?
  const existing = await client.query(
    `SELECT COUNT(*)::int AS c FROM external_comments
     WHERE article_id = ANY($1::text[]) AND is_bot = true AND bot_key = $2`,
    [aliases, SEED_KEY]
  );
  if ((existing.rows[0]?.c || 0) > 0) return { created: 0, personas: [], skipped: 'already_seeded' };

  const target =
    min + (hashSeed(article.id) % (Math.max(0, max - min) + 1));
  const personas = pickPersonas(article.id, target);
  let created = 0;
  const names = [];

  for (let i = 0; i < personas.length; i++) {
    const persona = personas[i];
    const content = buildComment(persona, article, i);
    try {
      const result = await client.query(
        `INSERT INTO external_comments
          (article_id, author_name, content, is_bot, bot_key)
         VALUES ($1, $2, $3, true, $4)
         RETURNING id`,
        [article.id, persona.name, content, SEED_KEY]
      );
      if (result.rows.length) {
        created += 1;
        names.push(persona.name);
      }
    } catch (e) {
      console.warn('[PersonaSeeder] insert failed:', e.message);
    }
  }

  return { created, personas: names };
}

module.exports = { seedPersonaComments, SEED_KEY, buildComment };
