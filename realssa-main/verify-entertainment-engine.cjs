'use strict';

/**
 * Offline regression checks for the entertainment engine.
 * Run: node verify-entertainment-engine.cjs
 */

const assert = require('node:assert/strict');

const { validateBrief, fallbackBrief, _internals } = require('./backend/services/angleFactory.service');
const alertThrottle = require('./backend/services/alertThrottle.service');

let passed = 0;

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`✅ ${name}`);
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   ${error.message}`);
    process.exitCode = 1;
  }
}

const source = [
  'Dua Lipa, Tame Impala and SZA will headline Coachella 2027, organizers announced on Monday.',
  'The festival will take place in Indio, California, from April 9 to April 18, 2027.',
  'The lineup also includes a closing set from a surprise guest, organizers said.',
].join(' ');

check('verbatim evidence is grounded', () => {
  assert.equal(
    _internals.isGrounded(
      'Dua Lipa, Tame Impala and SZA will headline Coachella 2027, organizers announced on Monday.',
      source
    ),
    true
  );
});

check('invented evidence is rejected', () => {
  assert.equal(
    _internals.isGrounded('Taylor Swift will headline the festival, organizers confirmed.', source),
    false
  );
});

check('a wrong year blocks publication', () => {
  const brief = validateBrief(
    {
      angles: [
        {
          type: 'factual',
          headline: 'Coachella 2028 lineup leaks',
          dek: 'Organizers announced the lineup.',
          key_facts: [
            {
              fact: 'Lineup',
              evidence:
                'Dua Lipa, Tame Impala and SZA will headline Coachella 2027, organizers announced on Monday.',
            },
            {
              fact: 'Dates',
              evidence:
                'The festival will take place in Indio, California, from April 9 to April 18, 2027.',
            },
          ],
          publishable: true,
        },
      ],
    },
    { sourceText: source, title: 'Coachella 2027' }
  );

  assert.equal(brief.angles[0].publishable, false);
  assert.deepEqual(brief.angles[0].unsupported_numbers, ['2028']);
});

check('two grounded facts make a factual angle publishable', () => {
  const brief = validateBrief(
    {
      angles: [
        {
          type: 'factual',
          headline: 'Dua Lipa, Tame Impala and SZA to headline Coachella 2027',
          dek: 'Organizers announced the lineup on Monday.',
          key_facts: [
            {
              fact: 'Lineup',
              evidence:
                'Dua Lipa, Tame Impala and SZA will headline Coachella 2027, organizers announced on Monday.',
            },
            {
              fact: 'Dates',
              evidence:
                'The festival will take place in Indio, California, from April 9 to April 18, 2027.',
            },
          ],
          publishable: true,
        },
      ],
    },
    { sourceText: source, title: 'Coachella 2027' }
  );

  assert.equal(brief.angles[0].publishable, true);
  assert.equal(brief.angles[0].grounding_score, 1);
});

check('fallback returns three non-publishable reporting angles', () => {
  const result = fallbackBrief({ title: 'Test story', sourceText: source }, 'ai_unavailable');
  assert.equal(result.ok, false);
  assert.equal(result.brief.angles.length, 3);
  assert.equal(result.angles.length, 3);
  assert.ok(result.brief.angles.every((angle) => angle.publishable === false));
});

check('alert throttle enforces cooldown and caps', () => {
  process.env.ALERT_THROTTLE_ENABLED = '1';
  process.env.ALERT_QUIET_START = '0';
  process.env.ALERT_QUIET_END = '0';
  process.env.ALERT_MIN_GAP_MINUTES = '45';
  process.env.ALERT_GLOBAL_PER_DAY = '3';
  process.env.ALERT_CATEGORY_PER_DAY = '2';

  const now = Date.now();
  assert.equal(alertThrottle.canSend({ category: 'sports', now }).allowed, true);
  alertThrottle.record({ category: 'sports', now });

  assert.equal(alertThrottle.canSend({ category: 'sports', now: now + 60_000 }).reason, 'cooldown');

  assert.equal(
    alertThrottle.canSend({ category: 'sports', now: now + 46 * 60_000 }).allowed,
    true
  );
  alertThrottle.record({ category: 'sports', now: now + 46 * 60_000 });

  assert.equal(
    alertThrottle.canSend({ category: 'sports', now: now + 50 * 60_000 }).reason,
    'category_daily_cap'
  );

  process.env.ALERT_GLOBAL_PER_DAY = '2';
  assert.equal(
    alertThrottle.canSend({ category: 'business', now: now + 100 * 60_000 }).reason,
    'global_daily_cap'
  );
});

console.log(`\n${passed} checks passed.`);
