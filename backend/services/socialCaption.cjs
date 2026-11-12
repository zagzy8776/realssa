/** Shared editorial formatting for generated captions and provider outages. */
function cleanSocialText(value) {
  return String(value || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(x[\da-f]+|\d+);/gi, (match, code) => {
      const point = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ' ';
    })
    .replace(/&(nbsp|amp|quot|apos|lt|gt|rsquo|lsquo|rdquo|ldquo);/gi,
      (_, key) => ({ nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"' })[key.toLowerCase()])
    .replace(/[ \t]+/g, ' ').trim();
}

function fitText(text, budget) {
  if (text.length <= budget) return text;
  const clipped = text.slice(0, budget);
  const sentence = clipped.match(/^[\s\S]*[.!?](?=\s|$)/);
  if (sentence && sentence[0].length > budget / 2) return sentence[0];
  return clipped.slice(0, Math.max(0, clipped.lastIndexOf(' '))).trimEnd() + '…';
}

function sourceSummary(title, context) {
  const headline = cleanSocialText(title);
  const sentences = cleanSocialText(context).match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) || [];
  const seen = new Set([headline.replace(/\W/g, '').toLowerCase()]);
  const details = sentences.map(s => s.trim()).filter(s => {
    const key = s.replace(/\W/g, '').toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 5).join(' ');
  // Extract confirmed source detail when AI is unavailable; never invent background.
  return [headline, details].filter(Boolean).join('\n\n');
}

function formatSocialCaption(value, { maxLength = 2200 } = {}) {
  const ending = 'Link in bio 🔗\n\n#RealSSA';
  const body = cleanSocialText(value)
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/#[\p{L}\p{N}_]+/gu, '')
    .replace(/(?:read (?:the )?full (?:story|report)(?: on RealSSA(?: News)?)?[.!]?|read more(?: on RealSSA(?: News)?)?|link in bio)[^\S\n]*(?:🔗|👇)?/gi, '')
    .replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return `${fitText(body, maxLength - ending.length - 2)}\n\n${ending}`.trim();
}

module.exports = { cleanSocialText, sourceSummary, formatSocialCaption };
