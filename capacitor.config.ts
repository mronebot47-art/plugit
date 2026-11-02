import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.plugit.app',
  appName: 'PlugIt',
  webDir: 'public',
  server: {
    url: process.env.CAPACITOR_SERVER_URL || 'https://accordance-enhancement-spiritual-produced.trycloudflare.com',
    cleartext: true,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#0E0E0B',
  },
};

export default config;
