import { useEffect } from 'react';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import OneSignalNative from 'onesignal-cordova-plugin';

const ONESIGNAL_APP_ID = '055b6596-a96c-48e2-8cda-ff4bb6d61009';
const WEB_PROMPT_COOLDOWN_KEY = 'realssa_onesignal_prompt_v2';
const WEB_PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export function useOneSignalAutoPrompt() {
  useEffect(() => {
    let disposed = false;

    const initPush = async () => {
      try {
        let deviceId = localStorage.getItem('realssa_device_uuid');
        if (!deviceId) {
          deviceId = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `dev-${Math.random().toString(36).substring(2, 15)}`;
          localStorage.setItem('realssa_device_uuid', deviceId);
        }

        if (Capacitor.isNativePlatform()) {
          console.log('[OneSignal] Initializing native SDK...');
          OneSignalNative.initialize(ONESIGNAL_APP_ID);
          OneSignalNative.login(deviceId);

          const permission = await OneSignalNative.Notifications.hasPermission().catch(() => false);
          if (!disposed && permission) return;

          // Keep the native experience delayed, but do not permanently lock the
          // prompt behind the old one-time Preferences flag.
          setTimeout(() => {
            if (disposed) return;
            OneSignalNative.Notifications.requestPermission(true)
              .then(granted => console.log('[OneSignal] Native permission:', granted))
              .catch(error => console.warn('[OneSignal] Native permission failed:', error));
          }, 30000);
          return;
        }

        // The Web SDK is initialized from index.html before this hook runs.
        // Queue through the same Deferred API so initialization races cannot
        // permanently prevent the prompt from appearing.
        const deferred = (window as any).OneSignalDeferred;
        if (!deferred) {
          console.warn('[OneSignal] OneSignalDeferred is unavailable on web.');
          return;
        }

        deferred.push(async (OneSignal: any) => {
          try {
            if (disposed) return;

            await OneSignal.login(deviceId);
            const subscription = OneSignal.User?.PushSubscription;
            const optedIn = Boolean(subscription?.optedIn);

            if (optedIn) {
              localStorage.removeItem(WEB_PROMPT_COOLDOWN_KEY);
              return;
            }

            // A browser-level denial is controlled by the browser and cannot be
            // fixed by repeatedly calling the SDK. The bell/settings flow remains
            // available through PushNotificationManager.
            if (Notification.permission === 'denied') return;

            const lastPrompt = Number(localStorage.getItem(WEB_PROMPT_COOLDOWN_KEY) || 0);
            const promptRecentlyAttempted = lastPrompt && Date.now() - lastPrompt < WEB_PROMPT_COOLDOWN_MS;
            if (promptRecentlyAttempted) return;

            let prompted = false;
            const showPrompt = async () => {
              if (prompted || disposed) return;
              prompted = true;
              localStorage.setItem(WEB_PROMPT_COOLDOWN_KEY, String(Date.now()));

              try {
                if (OneSignal.Slidedown?.promptPush) {
                  await OneSignal.Slidedown.promptPush();
                } else if (OneSignal.Notifications?.requestPermission) {
                  await OneSignal.Notifications.requestPermission();
                }
              } catch (error) {
                console.warn('[OneSignal] Web prompt failed:', error);
                prompted = false;
                localStorage.removeItem(WEB_PROMPT_COOLDOWN_KEY);
              }
            };

            // First meaningful interaction: this avoids browsers that require a
            // user gesture while still bringing the RealSSA alert prompt back.
            const onFirstInteraction = () => {
              window.removeEventListener('pointerdown', onFirstInteraction);
              window.removeEventListener('keydown', onFirstInteraction);
              window.removeEventListener('scroll', onFirstInteraction);
              showPrompt();
            };

            window.addEventListener('pointerdown', onFirstInteraction, { passive: true, once: true });
            window.addEventListener('keydown', onFirstInteraction, { passive: true, once: true });
            window.addEventListener('scroll', onFirstInteraction, { passive: true, once: true });

            // Also allow the slidedown to appear for visitors who simply read
            // the page for a while and never interact with it.
            const timer = window.setTimeout(showPrompt, 20000);

            return () => {
              window.clearTimeout(timer);
              window.removeEventListener('pointerdown', onFirstInteraction);
              window.removeEventListener('keydown', onFirstInteraction);
              window.removeEventListener('scroll', onFirstInteraction);
            };
          } catch (error) {
            console.warn('[OneSignal] Web login/prompt setup failed:', error);
          }
        });
      } catch (error) {
        console.warn('[OneSignal] Push initialization failed:', error);
      }
    };

    initPush();
    return () => {
      disposed = true;
    };
  }, []);
}
