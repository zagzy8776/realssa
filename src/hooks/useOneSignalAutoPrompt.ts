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
            }, 60000); // Delay native prompt by 60 seconds of active usage
          }
          
        } else {
          // Defer execution until OneSignal is fully initialized
          const OneSignalDeferred = (window as any).OneSignalDeferred;
          if (OneSignalDeferred) {
            OneSignalDeferred.push(async (OneSignal: any) => {
              try {
                // Link external user ID
                console.log('Linking Web OneSignal external user ID:', deviceId);
                await OneSignal.login(deviceId);

                if (value !== 'true') {
                  // Track page view count persistently
                  let pageViews = parseInt(localStorage.getItem('realssa_page_views') || '0');
                  pageViews += 1;
                  localStorage.setItem('realssa_page_views', pageViews.toString());

                  const optedIn = OneSignal.User?.PushSubscription?.optedIn || false;
                  // Only prompt after user has engaged: scrolled at least 300px
                  let hasScrolled = false;
                  const onScroll = () => {
                    if (window.scrollY > 300) {
                      hasScrolled = true;
                      window.removeEventListener('scroll', onScroll);
                    }
                  };
                  window.addEventListener('scroll', onScroll, { passive: true });

                  // Require at least 3 page views before showing prompt
                  if (pageViews >= 3) {
                    // Check every 5s after 2 minutes of active session
                    setTimeout(() => {
                      const checkReady = setInterval(async () => {
                        if (!hasScrolled) return;
                        clearInterval(checkReady);
                        window.removeEventListener('scroll', onScroll);
                        try {
                          if (!optedIn) {
                            if (OneSignal.Slidedown) {
                              await OneSignal.Slidedown.promptPush();
                            } else {
                              await OneSignal.User?.PushSubscription?.optIn();
                            }
                          }
                          await Preferences.set({ key: ONESIGNAL_PROMPT_KEY, value: 'true' });
                        } catch (promptErr) {
                          console.warn('Push prompt failed:', promptErr);
                        }
                      }, 5000);
                    }, 120000); // 2 minutes delay before checking
                  }
                }
              } catch (loginErr) {
                console.warn('OneSignal login failed:', loginErr);
              }
            });
          }
        }
      } catch (err) {
        console.warn('Auto prompt/login failed', err);
      }
    };

    initPush();
  }, []);
}
