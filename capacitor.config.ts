import type { CapacitorConfig } from '@capacitor/cli';

// Read server URL from environment (e.g. CAPACITOR_SERVER_URL=https://plugit.app)
const serverUrl = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.plugit.app',
  appName: 'PlugIt',
  webDir: 'public',
  server: serverUrl
    ? {
        url: serverUrl,
        cleartext: true,
        androidScheme: 'https',
      }
    : {
        androidScheme: 'https',
      },
  android: {
    allowMixedContent: true,
    backgroundColor: '#0E0E0B',
  },
};

export default config;
