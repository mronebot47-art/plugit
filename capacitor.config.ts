import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.plugit.app',
  appName: 'PlugIt',
  webDir: 'public',
  server: {
    url: process.env.CAPACITOR_SERVER_URL || 'https://plugit-b9zk94aob-team-namee.vercel.app',
    cleartext: true,
    androidScheme: 'https',
    allowNavigation: [
      'plugit-b9zk94aob-team-namee.vercel.app',
      '*.vercel.app',
      'plugit-9k9w.onrender.com',
      '*.onrender.com',
      'basemaps.cartocdn.com',
      '*.cartocdn.com',
      'api.maptiler.com',
      '*.maptiler.com',
    ],
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#0E0E0B',
  },
};

export default config;
