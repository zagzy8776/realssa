import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.realssa.news',
  appName: 'RealSSA News',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    PushNotifications: {
      presentationOptions: [
        'badge',
        'sound',
        'alert'
      ]
    },
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: false,
      backgroundColor: '#1A1A2E',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: true,
      androidSpinnerStyle: 'large',
      spinnerColor: '#E02424',
      splashFullScreen: true,
      splashImmersive: true
    },
    CapacitorUpdater: {
      appId: 'com.realssa.news',
      version: '0.0.66',
      autoUpdate: 'always',
      autoSplashscreen: true
    }
  }
};

export default config;
