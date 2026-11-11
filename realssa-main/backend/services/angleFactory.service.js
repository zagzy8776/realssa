'use strict';

/**
 * Grounded Angle Factory
 * ======================
 * Turns one source story into three editorial options:
 *
 *   1. factual   — what happened, attributed
 *   2. context   — why it matters / what it changes
 *   3. curiosity — the question readers will ask next (open loop, not a claim)
 *
 * The difference from a generic "spin" prompt is the guardrail layer:
 *   - every key fact must include a verbatim evidence quote
 *   - every quote is checked against the source before the angle is publishable
 *   - numbers in a headline must appear in the source
 *   - legal / sensitive / rumor language raises a review flag
 *   - the AI may return publishable=false and explain what reporting is missing
 *
 * The model is never allowed to invent a second source. If the source is thin,
 * the correct output is a reporting brief, not a story.
 */

const { callGeminiJSON } = require('./aiAgentService');

const SOURCE_CHAR_LIMIT = 14_000;
const MIN_SOURCE_CHARS = 240;
const GROUNDING_OVERLAP = 0.8;

const ANGLE_TYPES = ['factual', 'context', 'curiosity'];

const SYSTEM_INSTRUCTION = `You are the Entertainment Editorial Planner for RealSSA News.
You turn ONE piece of source material into three publication options for a human editor.

HARD RULES
- Use ONLY facts explicitly stated in SOURCE MATERIAL. You may not add outside knowledge.
- Never invent names, numbers, dates, quotes, relationships, motives, or sources.
- Every key fact must include an "evidence" field copied verbatim from SOURCE MATERIAL.
- If the source does not support an angle, set "publishable": false and explain what is missing in "editorial_note".
- Do not accuse anyone of a crime, sexual misconduct, or a medical condition unless the source cites an official document or an on-record statement.
- Do not speculate about minors or identify private individuals.
- The curiosity angle may use an open loop, but it must not assert anything unverified.
- No "you won't believe" or "shocking" framing unless the source itself supports surprise.
- Keep headlines accurate first, interesting second.

ANGLE DEFINITIONS
- factual: the confirmed development, attributed to the source.
- context: what the confirmed development changes, means, or sets up. Analysis must be labeled as analysis.
- curiosity: the specific question a reader will ask next, phrased as a question or an open loop. It must be answerable by reporting, not by invention.

You are planning, not publishing. A thin source must produce a reporting brief, not a fabricated article.`;

const RISK_PATTERNS = [
  { key: 'legal', re: /\b(arrested|charged|indicted|lawsuit|sued|court|trial|convicted|alleged|accused)\b/i },
  { key: 'sensitive', re: /\b(died|death|hospital|diagnosis|cancer|overdose|assault|abuse|minor|child)\b/i },
  { key: 'rumor', re: /\b(rumor|rumour|reportedly|sources say|insider|claims)\b/i },
  { key: 'clickbait', re: /\b(you won't believe|shocking|slams|destroys|blasts|exposed|secret)\b/i },
];

// ── Text + grounding helpers ────────────────────────────────────────────────

function safeString(value, max = 600) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizeForMatch(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitSentences(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 30)
    .slice(0, 80);
}

function tokenSet(value) {
  return new Set(
    normalizeForMatch(value)
      .split(' ')
      .filter((token) => token.length >= 4)
  );
}

function isGrounded(evidence, sourceText, sourceSentences = splitSentences(sourceText)) {
  const quote = normalizeForMatch(evidence);
  if (quote.length < 20) return false;

  if (normalizeForMatch(sourceText).includes(quote)) return true;

  const quoteTokens = tokenSet(quote);
  if (quoteTokens.size < 3) return false;

  for (const sentence of sourceSentences) {
    const sentenceTokens = tokenSet(sentence);
    if (!sentenceTokens.size) continue;
    let hits = 0;
    for (const token of quoteTokens) if (sentenceTokens.has(token)) hits += 1;
    if (hits / quoteTokens.size >= GROUNDING_OVERLAP) return true;
  }

  return false;
}

function extractNumbers(value) {
  return [...String(value || '').matchAll(/\d[\d,.]*/g)]
    .map((match) => match[0].replace(/[.,]$/, ''))
    .filter(Boolean);
}

function numberInSource(number, sourceText) {
  const escaped = String(number).replace(/,/g, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\D)${escaped}(\\D|$)`).test(String(sourceText || '').replace(/,/g, ''));
}

function collectRiskFlags(text) {
  const flags = [];
  for (const pattern of RISK_PATTERNS) {
    if (pattern.re.test(String(text || ''))) flags.push(pattern.key);
  }
  return flags;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

// ── Prompt ──────────────────────────────────────────────────────────────────

function buildUserPrompt(input) {
  const sourceText = safeString(input.sourceText, SOURCE_CHAR_LIMIT);

  return [
    'SOURCE MATERIAL',
    `Headline: ${safeString(input.title, 300) || 'Untitled'}`,
    `Publisher: ${safeString(input.sourceName, 120) || 'Unknown'}`,
    `URL: ${safeString(input.sourceUrl, 500) || 'not provided'}`,
    `Market: ${safeString(input.region, 60) || 'global'}`,
    '--- BEGIN SOURCE ---',
    sourceText,
    '--- END SOURCE ---',
    '',
    'TASK',
    'Produce exactly three angles: factual, context, curiosity.',
    'For each angle return: type, headline, dek, outline (3-5 strings), key_facts (2-4 objects with fact + evidence), publishable (boolean), editorial_note.',
    'Evidence must be a verbatim quote from the source. Do not paraphrase evidence.',
    'If the source is thin, set publishable=false for the affected angle and say what a reporter must confirm.',
    '',
    'Also return: story_subject, what_is_verified (array of strings), what_is_unclear (array), risk_flags (array), recommended_angle (factual|context|curiosity).',
    '',
    'JSON SHAPE',
    JSON.stringify(
      {
        story_subject: 'one line',
        what_is_verified: ['fact confirmed in the source'],
        what_is_unclear: ['question the source does not answer'],
        angles: [
          {
            type: 'factual',
            headline: 'accurate headline',
            dek: 'one-sentence standfirst',
            outline: ['paragraph intent', 'paragraph intent', 'paragraph intent'],
            key_facts: [{ fact: 'confirmed fact', evidence: 'verbatim quote from source' }],
            publishable: true,
            editorial_note: '',
          },
          {
            type: 'context',
            headline: 'analysis headline',
            dek: 'one-sentence standfirst',
            outline: ['paragraph intent'],
            key_facts: [{ fact: 'confirmed fact', evidence: 'verbatim quote from source' }],
            publishable: true,
            editorial_note: '',
          },
          {
            type: 'curiosity',
            headline: 'question readers will ask next',
            dek: 'one-sentence standfirst',
            outline: ['paragraph intent'],
            key_facts: [{ fact: 'confirmed fact', evidence: 'verbatim quote from source' }],
            publishable: true,
            editorial_note: '',
          },
        ],
        risk_flags: [],
        recommended_angle: 'factual',
      },
      null,
      2
    ),
  ].join('\n');
}

// ── Validation ──────────────────────────────────────────────────────────────

function normalizeFact(fact) {
  if (typeof fact === 'string') return { fact: safeString(fact, 400), evidence: '' };
  if (!fact || typeof fact !== 'object') return null;
  return {
    fact: safeString(fact.fact || fact.claim, 400),
    evidence: safeString(fact.evidence || fact.quote, 700),
  };
}

function validateBrief(ai, input) {
  const sourceText = safeString(input.sourceText, SOURCE_CHAR_LIMIT);
  const sourceSentences = splitSentences(sourceText);
  const sourceRisk = collectRiskFlags(sourceText);

  const angles = (Array.isArray(ai?.angles) ? ai.angles : []).slice(0, 3).map((angle, index) => {
    const type = ANGLE_TYPES.includes(angle?.type) ? angle.type : ANGLE_TYPES[index] || 'factual';
    const headline = safeString(angle?.headline, 240);
    const dek = safeString(angle?.dek || angle?.standfirst, 500);
    const outline = (Array.isArray(angle?.outline) ? angle.outline : [])
      .map((line) => safeString(line, 300))
      .filter(Boolean)
      .slice(0, 6);

    const rawFacts = (Array.isArray(angle?.key_facts) ? angle.key_facts : [])
      .map(normalizeFact)
      .filter(Boolean)
      .slice(0, 6);

    const keyFacts = rawFacts.map((fact) => ({
      ...fact,
      verified: isGrounded(fact.evidence, sourceText, sourceSentences),
    }));
    const verifiedFacts = keyFacts.filter((fact) => fact.verified);

    const numbers = extractNumbers(`${headline} ${dek}`);
    const unsupportedNumbers = numbers.filter((number) => !numberInSource(number, sourceText));

    const riskFlags = unique([
      ...collectRiskFlags(`${headline} ${dek} ${outline.join(' ')}`),
      ...(Array.isArray(angle?.risk_flags) ? angle.risk_flags.map((flag) => safeString(flag, 40)) : []),
    ]);

    const minimumFacts = type === 'factual' ? 2 : 1;
    const reasons = [];
    if (angle?.publishable === false) reasons.push('The model marked this angle as not publishable.');
    if (keyFacts.length === 0) reasons.push('No key facts were supplied.');
    if (verifiedFacts.length < minimumFacts) {
      reasons.push(
        `Only ${verifiedFacts.length} of ${keyFacts.length} key facts could be traced to the source; ${minimumFacts} required.`
      );
    }
    if (unsupportedNumbers.length) {
      reasons.push(`Number not found in the source: ${unsupportedNumbers.join(', ')}.`);
    }

    const editorialNote = [safeString(angle?.editorial_note, 600), ...reasons].filter(Boolean).join(' ');

    return {
      type,
      headline,
      dek,
      outline,
      key_facts: keyFacts,
      verified_facts: verifiedFacts,
      grounding_score: keyFacts.length
        ? Math.round((verifiedFacts.length / keyFacts.length) * 100) / 100
        : 0,
      unsupported_numbers: unsupportedNumbers,
      risk_flags: riskFlags,
      publishable: reasons.length === 0,
      editorial_note: editorialNote,
    };
  });

  const recommended = ANGLE_TYPES.includes(ai?.recommended_angle) ? ai.recommended_angle : null;
  const recommendedAngle =
    (recommended && angles.find((angle) => angle.type === recommended && angle.publishable)?.type) ||
    angles.find((angle) => angle.publishable)?.type ||
    'factual';

  return {
    story_subject: safeString(ai?.story_subject || input.title, 200),
    what_is_verified: (Array.isArray(ai?.what_is_verified) ? ai.what_is_verified : [])
      .map((item) => safeString(item, 300))
      .filter(Boolean)
      .slice(0, 8),
    what_is_unclear: (Array.isArray(ai?.what_is_unclear) ? ai.what_is_unclear : [])
      .map((item) => safeString(item, 300))
      .filter(Boolean)
      .slice(0, 8),
    risk_flags: unique([
      ...sourceRisk,
      ...angles.flatMap((angle) => angle.risk_flags),
      ...(Array.isArray(ai?.risk_flags) ? ai.risk_flags.map((flag) => safeString(flag, 40)) : []),
    ]),
    recommended_angle: recommendedAngle,
    angles,
    publishable_angles: angles.filter((angle) => angle.publishable).length,
  };
}

// ── Fallback: a reporting brief, never invented copy ────────────────────────

function fallbackBrief(input, reason) {
  const sourceText = safeString(input.sourceText || input.text, SOURCE_CHAR_LIMIT);
  const title = safeString(input.title, 300) || 'Untitled story';
  const sentences = splitSentences(sourceText);
  const facts = sentences.slice(0, 4).map((sentence) => ({
    fact: safeString(sentence, 300),
    evidence: sentence,
    verified: true,
  }));

  const note =
    reason === 'thin_source'
      ? 'The source is too short to support a publishable angle. Assign a reporter to gather the missing details.'
      : reason === 'missing_source'
        ? 'No usable source text was supplied. Paste the article text or URL before planning.'
        : 'AI drafting is unavailable. This is a reporting skeleton, not publishable copy.';

  const makeAngle = (type, headline, outline) => ({
    type,
    headline,
    dek: facts[0]?.fact || 'Reporting required before publication.',
    outline,
    key_facts: facts.slice(0, type === 'factual' ? 2 : 1),
    verified_facts: facts.slice(0, type === 'factual' ? 2 : 1),
    grounding_score: facts.length ? 1 : 0,
    unsupported_numbers: [],
    risk_flags: collectRiskFlags(sourceText),
    publishable: false,
    editorial_note: note,
  });

  const result = {
    ok: false,
    error: reason,
    requires_ai: reason === 'ai_unavailable',
    source: {
      title,
      sourceName: safeString(input.sourceName, 120) || 'Unknown',
      sourceUrl: safeString(input.sourceUrl, 500) || '',
      region: safeString(input.region, 60) || 'global',
      chars: sourceText.length,
    },
    brief: {
      story_subject: title,
      what_is_verified: facts.map((fact) => fact.fact),
      what_is_unclear: [
        'Who confirmed the details on the record?',
        'What happens next, and on what timeline?',
      ],
      risk_flags: collectRiskFlags(sourceText),
      recommended_angle: 'factual',
      angles: [
        makeAngle('factual', title, [
          'Lead with the confirmed development and attribute it to the source.',
          'Add the dates, names and numbers that are already on the record.',
          'List what is still unconfirmed instead of filling the gaps.',
        ]),
        makeAngle('context', `Why ${title} matters`, [
          'Explain what changes for the people affected.',
          'Place the development in the timeline already established by the source.',
          'Separate confirmed context from analysis.',
        ]),
        makeAngle('curiosity', `What happens next with ${title}?`, [
          'Name the specific question readers will ask next.',
          'List the calls or documents a reporter needs to answer it.',
          'Do not imply an answer the source does not support.',
        ]),
      ],
      publishable_angles: 0,
    },
    angles: [],
    editorial: {
      generatedAt: new Date().toISOString(),
      model: null,
      grounding_threshold: GROUNDING_OVERLAP,
      source_chars: sourceText.length,
      publishable_angles: 0,
      total_angles: 0,
      review_required: true,
      fallback_reason: reason,
    },
    guardrails: guardrailList(),
  };

  result.angles = result.brief.angles;
  return result;
}

function guardrailList() {
  return [
    'Every key fact must carry a verbatim quote from the source.',
    'Quotes are checked against the source before an angle is marked publishable.',
    'Numbers in a headline or dek must appear in the source.',
    'Legal, sensitive, rumor and clickbait language raises a human review flag.',
    'A thin source produces a reporting brief, not invented copy.',
    'Curiosity angles are questions or open loops, never unverified assertions.',
  ];
}

async function generateBrief(input = {}, options = {}) {
  const sourceText = safeString(input.sourceText || input.text || '', SOURCE_CHAR_LIMIT);
  const title = safeString(input.title, 300);

  if (!title || !sourceText) {
    return fallbackBrief({ ...input, title, sourceText }, 'missing_source');
  }

  if (sourceText.length < MIN_SOURCE_CHARS) {
    return fallbackBrief({ ...input, title, sourceText }, 'thin_source');
  }

  const ai = await callGeminiJSON(SYSTEM_INSTRUCTION, buildUserPrompt({ ...input, title, sourceText }), {
    maxTokens: options.maxTokens || 1800,
    temperature: options.temperature === undefined ? 0.25 : options.temperature,
  });

  if (!ai) {
    return fallbackBrief({ ...input, title, sourceText }, 'ai_unavailable');
  }

  const brief = validateBrief(ai, { ...input, title, sourceText });

  if (!brief.angles.length) {
    return fallbackBrief({ ...input, title, sourceText }, 'ai_invalid');
  }

  const reviewRequired = brief.publishable_angles === 0 || brief.risk_flags.length > 0;

  return {
    ok: true,
    source: {
      title,
      sourceName: safeString(input.sourceName, 120) || 'Unknown',
      sourceUrl: safeString(input.sourceUrl, 500) || '',
      region: safeString(input.region, 60) || 'global',
      chars: sourceText.length,
    },
    brief,
    angles: brief.angles,
    editorial: {
      generatedAt: new Date().toISOString(),
      model: 'gemini/nvidia-router',
      grounding_threshold: GROUNDING_OVERLAP,
      source_chars: sourceText.length,
      publishable_angles: brief.publishable_angles,
      total_angles: brief.angles.length,
      review_required: reviewRequired,
    },
    guardrails: guardrailList(),
  };
}

module.exports = {
  generateBrief,
  validateBrief,
  fallbackBrief,
  buildUserPrompt,
  guardrailList,
  _internals: {
    isGrounded,
    splitSentences,
    extractNumbers,
    numberInSource,
    collectRiskFlags,
    normalizeForMatch,
  },
};
