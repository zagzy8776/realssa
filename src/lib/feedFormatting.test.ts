import { expect, test } from 'vitest';
import { cleanText } from './utils';

test('RSS anchors render as readable text, including previously truncated feeds', () => {
  expect(cleanText('&amp;lt;a href=&amp;quot;https://news.google.com/rss/article&amp;quot;&amp;gt;Bank report&amp;lt;/a&amp;gt;')).toBe('Bank report');
  expect(cleanText('<a href="https://news.google.com/rss/articles/CBMiiAF')).toBe('');
  expect(cleanText('Prices < 30 naira')).toBe('Prices < 30 naira');
});
