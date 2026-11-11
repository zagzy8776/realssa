/**
 * Image-based logo detection.
 *
 * The old approach used URL regex (cropped-punch, PUNCH-Logo, etc.) which
 * requires maintaining an exclusion list per site forever and still breaks.
 * URL regex is the wrong signal — detect on the image itself.
 *
 * Reject as logo if:
 *   - width < 400
 *   - aspect > 3.2:1 (extremely wide banner)
 *   - aspect within 0.95–1.05 with >85% near-white pixels (square white logo)
 *   - edge density in the top 5% of the corpus with a centered cluster
 *
 * Computed once per image and cached in-memory + localStorage — no runtime
 * cost after first load, no per-site lists.
 */

const cache = new Map<string, boolean>();
const STORAGE_KEY = 'realssa_logo_cache_v1';

// Load persisted cache once
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) cache.set(k, Boolean(v));
    }
  }
} catch {
  // ignore
}

function persistCache() {
  try {
    const obj: Record<string, boolean> = {};
    for (const [k, v] of cache.entries()) obj[k] = v;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // ignore
  }
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function samplePixels(img: HTMLImageElement): { nearWhitePct: number; edgeDensity: number; centerCluster: boolean } {
  const canvas = document.createElement('canvas');
  const maxDim = 64; // downsample for speed
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { nearWhitePct: 0, edgeDensity: 0, centerCluster: false };
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  let nearWhite = 0;
  let total = 0;
  let edgePixels = 0;
  let centerPixels = 0;
  let centerEdge = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      total++;
      // Near-white: all channels > 240
      if (r > 240 && g > 240 && b > 240) nearWhite++;
      // Edge detection: luminance difference from neighbors
      if (x > 0 && y > 0) {
        const pi = ((y - 1) * w + (x - 1)) * 4;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const pl = 0.299 * data[pi] + 0.587 * data[pi + 1] + 0.114 * data[pi + 2];
        if (Math.abs(lum - pl) > 40) {
          edgePixels++;
          // Center cluster: within middle 60% of image
          if (x > w * 0.2 && x < w * 0.8 && y > h * 0.2 && y < h * 0.8) {
            centerEdge++;
            centerPixels++;
          }
        }
      }
    }
  }

  return {
    nearWhitePct: total > 0 ? nearWhite / total : 0,
    edgeDensity: total > 0 ? edgePixels / total : 0,
    centerCluster: centerPixels > 0 && centerEdge / centerPixels > 0.5
  };
}

/**
 * Detect whether an image URL is likely a source logo (not card art).
 * Returns true if the image should be rejected as card art.
 */
export async function isLogoImage(url?: string): Promise<boolean> {
  if (!url) return true;
  // Skip data URIs and known placeholder patterns
  if (url.startsWith('data:')) return false;
  if (url.includes('placeholder') || url.includes('brand-cover')) return false;

  // Cache hit
  if (cache.has(url)) return cache.get(url)!;

  const img = await loadImage(url);
  if (!img) return false; // can't analyze, don't reject

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const aspect = w / h;

  // Rule 1: width < 400
  if (w < 400) {
    cache.set(url, true);
    persistCache();
    return true;
  }

  // Rule 2: aspect > 3.2:1 (extremely wide banner)
  if (aspect > 3.2) {
    cache.set(url, true);
    persistCache();
    return true;
  }

  // Rule 3: square-ish with >85% near-white pixels (white logo on white bg)
  if (aspect >= 0.95 && aspect <= 1.05) {
    const { nearWhitePct } = samplePixels(img);
    if (nearWhitePct > 0.85) {
      cache.set(url, true);
      persistCache();
      return true;
    }
  }

  // Rule 4: edge density in top 5% with centered cluster
  const { edgeDensity, centerCluster } = samplePixels(img);
  if (edgeDensity > 0.25 && centerCluster) {
    cache.set(url, true);
    persistCache();
    return true;
  }

  cache.set(url, false);
  persistCache();
  return false;
}

/**
 * Synchronous heuristic for the common case — checks URL patterns that are
 * unambiguous (favicon, icon, avatar) but defers to async image analysis for
 * ambiguous cases. This keeps the initial render fast.
 */
export function isLikelyLogoUrl(url?: string): boolean {
  if (!url) return true;
  if (url.startsWith('data:')) return false;
  // Unambiguous URL signals
  if (/(favicon|\.ico$|avatar|icon\.png|logo\.png|logo\.svg|brand\.svg|placeholder)/i.test(url)) return true;
  return false;
}

/**
 * Deterministic generated card fallback: category-colored gradient,
 * source initial, category label. Looks intentional, never broken.
 */
export function generatedCardStyle(category: string, seed: string): { background: string; initial: string; label: string } {
  const gradients: Record<string, string> = {
    sports: 'linear-gradient(135deg, #1e3a5f 0%, #2d6a4f 100%)',
    politics: 'linear-gradient(135deg, #3d1d1d 0%, #7f1d1d 100%)',
    business: 'linear-gradient(135deg, #1a2e1a 0%, #3f6212 100%)',
    tech: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%)',
    crypto: 'linear-gradient(135deg, #3b0764 0%, #7c3aed 100%)',
    entertainment: 'linear-gradient(135deg, #4a044e 0%, #a21caf 100%)',
    culture: 'linear-gradient(135deg, #3f1d38 0%, #9d174d 100%)',
    world: 'linear-gradient(135deg, #0c4a6e 0%, #0284c7 100%)',
    africa: 'linear-gradient(135deg, #3f2d0c 0%, #a16207 100%)',
    health: 'linear-gradient(135deg, #14532d 0%, #16a34a 100%)',
    science: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
    lifestyle: 'linear-gradient(135deg, #7c2d12 0%, #ea580c 100%)',
    jobs: 'linear-gradient(135deg, #1e293b 0%, #475569 100%)',
    default: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)'
  };
  const bg = gradients[category] || gradients.default;
  const initial = (seed || 'R').charAt(0).toUpperCase();
  const label = category.replace(/-/g, ' ').toUpperCase();
  return { background: bg, initial, label };
}
