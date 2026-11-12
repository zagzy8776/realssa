import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function decodeHTMLEntities(text: string): string {
  let decoded = String(text || '');
  for (let pass = 0; pass < 3; pass++) {
    const previous = decoded;
    decoded = decoded.replace(/&#(x[\da-f]+|\d+);/gi, (_, raw) => {
      const code = raw[0].toLowerCase() === 'x' ? parseInt(raw.slice(1), 16) : Number(raw);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    }).replace(/&(amp|quot|apos|lt|gt|nbsp|lsquo|rsquo|ldquo|rdquo|ndash|mdash);/gi, (_, name) =>
      ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—' })[name.toLowerCase()]);
    if (decoded === previous) break;
  }
  return decoded;
}

export function safeLocalStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (err: any) {
    if (err?.name === 'QuotaExceededError' || err?.code === 22) {
      try {
        localStorage.removeItem('realssa_offline_digest');
        localStorage.removeItem('realssa_browser_history');
        localStorage.setItem(key, value);
      } catch (retryErr) {
        console.warn('LocalStorage quota exceeded:', retryErr);
      }
    }
  }
}
