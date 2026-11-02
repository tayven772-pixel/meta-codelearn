import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.meta.learn',
  appName: 'Meta Code',
  webDir: 'dist',
  // Bundle the built website into the APK instead of loading the old remote URL.
  // This keeps the installed app tied to the exact site version used for this build.
  android: {
    allowMixedContent: false,
  },
};

export default config;
