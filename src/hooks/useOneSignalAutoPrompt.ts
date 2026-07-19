import { useEffect } from 'react';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import OneSignalNative from 'onesignal-cordova-plugin';

const ONESIGNAL_PROMPT_KEY = 'onesignal_prompt_shown';
const ONESIGNAL_APP_ID = "055b6596-a96c-48e2-8cda-ff4bb6d61009";

export function useOneSignalAutoPrompt() {
  useEffect(() => {
    const initPush = async () => {
      try {
        // Retrieve or generate persistent device ID
        let deviceId = localStorage.getItem('realssa_device_uuid');
        if (!deviceId) {
          deviceId = typeof crypto !== 'undefined' && crypto.randomUUID 
            ? crypto.randomUUID() 
            : 'dev-' + Math.random().toString(36).substring(2, 15);
          localStorage.setItem('realssa_device_uuid', deviceId);
        }

        // Check if prompt was already shown
        const { value } = await Preferences.get({ key: ONESIGNAL_PROMPT_KEY });

        if (Capacitor.isNativePlatform()) {
          // Native Capacitor (Android/iOS)
          console.log('Initializing Native OneSignal SDK & login user...');
          OneSignalNative.initialize(ONESIGNAL_APP_ID);
          OneSignalNative.login(deviceId);
          
          if (value !== 'true') {
            setTimeout(() => {
              OneSignalNative.Notifications.requestPermission(true).then((success: boolean) => {
                console.log("Native Notification permission granted: " + success);
                Preferences.set({ key: ONESIGNAL_PROMPT_KEY, value: 'true' });
              });
            }, 3000); // Give user a moment before prompting
          }
          
        } else {
          // Web / PWA — wait for OneSignal SDK to load
          let checks = 0;
          const interval = setInterval(() => {
            const OneSignalWeb = (window as any).OneSignal;
            if (OneSignalWeb && OneSignalWeb.User) {
              clearInterval(interval);

              // Link external user ID
              console.log('Linking Web OneSignal external user ID:', deviceId);
              OneSignalWeb.login(deviceId);

              if (value !== 'true') {
                // Only prompt after user has engaged: 30s on page AND scrolled at least 300px
                let hasScrolled = false;
                const onScroll = () => {
                  if (window.scrollY > 300) {
                    hasScrolled = true;
                    window.removeEventListener('scroll', onScroll);
                  }
                };
                window.addEventListener('scroll', onScroll, { passive: true });

                // Check every 5s after 30s — prompt only when both conditions met
                setTimeout(() => {
                  const checkReady = setInterval(async () => {
                    if (!hasScrolled) return;
                    clearInterval(checkReady);
                    window.removeEventListener('scroll', onScroll);
                    try {
                      const optedIn = OneSignalWeb.User.PushSubscription?.optedIn || false;
                      if (!optedIn) {
                        if (OneSignalWeb.Slidedown) {
                          await OneSignalWeb.Slidedown.promptPush();
                        } else {
                          await OneSignalWeb.User.PushSubscription.optIn();
                        }
                      }
                      await Preferences.set({ key: ONESIGNAL_PROMPT_KEY, value: 'true' });
                    } catch (promptErr) {
                      console.warn('Push prompt failed:', promptErr);
                    }
                  }, 5000);
                }, 30000); // wait 30s before starting checks
              }
            }
            checks++;
            if (checks > 20) clearInterval(interval);
          }, 500);
        }
      } catch (err) {
        console.warn('Auto prompt/login failed', err);
      }
    };

    initPush();
  }, []);
}
