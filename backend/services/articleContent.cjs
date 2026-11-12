const { JSDOM } = require('jsdom');
const { cleanSocialText } = require('./socialCaption.cjs');
const UI_TEXT = [
  /^get alerts on significant breaking news/i,
  /^you have reached your maximum number of saved items/i,
  /^remove items from your saved list to add more/i,
  /^no gift articles left/i,
  /^you.ve used all of your gift articles/i,
  /^(save|gift|close|share|license this article|more:|bt quiz|quizzes|for subscribers|0\s*\/\s*3)$/i,
  /^.{1,70} is (?:a|an|the) .{0,45}reporter (?:at|for) .{1,100}, covering [\s\S]*connect via /i,
  /^connect via (?:email|twitter|linkedin)/i,
];
function isUiText(text) { return UI_TEXT.some(pattern => pattern.test(text.trim())); }
function removeArticleChrome(root) {
  root.querySelectorAll('script,style,noscript,nav,aside,footer,form,button,input,select,textarea,svg,[role="dialog"],[role="navigation"],[aria-modal="true"],.author-bio,.author-info,.article-tools,.share-tools,.social-share,.subscription-prompt,[data-testid="subscription-prompt"]').forEach(node => node.remove());
  // Test small leaf blocks, never remove a whole article because it mentions a UI term.
  const blocks = Array.from(root.querySelectorAll('p,li,h2,h3,h4,div,span,a')).reverse();
  for (const node of blocks) {
    if (node.querySelector('p,li,h2,h3,h4,div')) continue;
    const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.length < 1500 && isUiText(text)) node.remove();
  }
  return root;
}
function cleanArticleHtml(html) {
  const dom = new JSDOM(`<body>${html || ''}</body>`);
  const root = removeArticleChrome(dom.window.document.body);
  const htmlContent = root.innerHTML;
  // Block boundaries preserve article paragraphs while excluding controls.
  root.querySelectorAll('p,li,h1,h2,h3,h4,blockquote,section,div,br').forEach(node => node.appendChild(dom.window.document.createTextNode('\n\n')));
  const textContent = String(root.textContent || '').split(/\n\s*\n/).map(part => part.replace(/\s+/g, ' ').trim())
    .filter(part => part && !isUiText(part)).join('\n\n');
  dom.window.close();
  return { htmlContent, textContent };
}
function cleanArticleText(text) {
  const raw = String(text || '');
  if (/<\/?(?:p|div|article|section|button|script)\b/i.test(raw)) return cleanArticleHtml(raw).textContent;
  return raw.split(/\n+/).map(line => cleanSocialText(line)).filter(line => line && !isUiText(line)).join('\n\n');
}
module.exports = { cleanArticleHtml, cleanArticleText, removeArticleChrome };
