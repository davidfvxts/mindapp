import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'so.mira.app',
  appName: 'Mira',
  webDir: 'dist',
  ios: {
    // The reflection ritual happens at night. A black canvas means no
    // white flash on launch.
    backgroundColor: '#000000',
    contentInset: 'always',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['alert', 'sound'],
    },
    SplashScreen: {
      backgroundColor: '#000000',
      showSpinner: false,
      launchAutoHide: true,
    },
  },
}

export default config
