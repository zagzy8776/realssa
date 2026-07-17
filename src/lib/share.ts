import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

export interface ShareOptions {
  title: string;
  text?: string;
  url: string;
}

export async function shareContent({ title, text, url }: ShareOptions): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const canShare = await Share.canShare();
      if (canShare.value) {
        await Share.share({
          title,
          text,
          url,
          dialogTitle: 'Share News via RealSSA',
        });
        return true;
      }
    } catch (e) {
      console.warn('Native share sheet failed, falling back to Web API', e);
    }
  }

  // Web Browser fallback
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return true;
    } catch (e) {
      console.warn('Web share failed', e);
    }
  }

  // Clipboard fallback
  try {
    await navigator.clipboard.writeText(url);
    return false; // Returns false to indicate clipboard copy was used
  } catch (err) {
    console.error('Clipboard copy failed', err);
    return false;
  }
}
