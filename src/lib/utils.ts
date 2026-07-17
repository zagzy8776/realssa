import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function decodeHTMLEntities(text: string): string {
  if (!text) return "";
  if (typeof window === "undefined") {
    // Server-side fallback: basic regex mapping for common entities
    return text
      .replace(/&#8216;/g, "‘")
      .replace(/&#8217;/g, "’")
      .replace(/&#8211;/g, "–")
      .replace(/&#8212;/g, "—")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }
  try {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    return doc.documentElement.textContent || text;
  } catch (e) {
    return text;
  }
}
