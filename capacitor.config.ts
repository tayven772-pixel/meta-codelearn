import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.meta.learn',
  appName: 'Meta',
  webDir: 'dist',
  server: {
    url: 'https://metasupportcom.dbm.shared-servers.com',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
