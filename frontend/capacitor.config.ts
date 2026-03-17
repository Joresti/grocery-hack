import type { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'com.groceryhack.app',
  appName: 'GroceryHack',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
