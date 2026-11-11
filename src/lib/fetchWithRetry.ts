/**
 * fetchWithRetry — mobile-safe fetch utility
 *
 * - Sets a 25-second timeout (longer than mobile browser default
 *   so Render's cold-start has time to wake up)
 * - On failure or timeout, waits 3 seconds then retries once
 * - Returns null on total failure so pages can show a retry button
 */

const TIMEOUT_MS = 25000;   // 25s — enough for a cold Render start
const RETRY_DELAY_MS = 3000; // 3s pause before retry

export async function fetchWithRetry(
  url: string,
  retries = 1
): Promise<Response | null> {
  let currentUrl = url;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      console.log(`Attempt ${attempt + 1}: Fetching ${currentUrl}`);
      const response = await fetch(currentUrl, { signal: controller.signal });
      clearTimeout(timerId);
      if (response.ok) return response;

      // If we failed with non-www, try with www (or vice versa) on retry
      if (attempt < retries) {
        if (currentUrl.includes('https://realssanews.com.ng')) {
          currentUrl = currentUrl.replace('https://realssanews.com.ng', 'https://www.realssanews.com.ng');
        } else if (currentUrl.includes('https://www.realssanews.com.ng')) {
          currentUrl = currentUrl.replace('https://www.realssanews.com.ng', 'https://realssanews.com.ng');
        }
      }

      return null;
    } catch (err: any) {
      clearTimeout(timerId);
      console.warn(`Fetch attempt ${attempt + 1} failed:`, err.message);

      if (attempt < retries) {
        // Switch between www and non-www on retry
        if (currentUrl.includes('https://realssanews.com.ng')) {
          currentUrl = currentUrl.replace('https://realssanews.com.ng', 'https://www.realssanews.com.ng');
        } else if (currentUrl.includes('https://www.realssanews.com.ng')) {
          currentUrl = currentUrl.replace('https://www.realssanews.com.ng', 'https://realssanews.com.ng');
        }
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }
  return null;
}
