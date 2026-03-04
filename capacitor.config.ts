import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'chat.kernel.app',
  appName: 'Kernel',
  webDir: 'dist',
  server: {
    // In production, serve from bundled web assets
    // For dev, uncomment the url below to hot-reload from Vite dev server
    // url: 'http://localhost:5173',
    androidScheme: 'https',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  ios: {
    scheme: 'Kernel',
    contentInset: 'automatic',
    backgroundColor: '#FAF9F6',
  },
  android: {
    backgroundColor: '#FAF9F6',
  },
}

export default config
