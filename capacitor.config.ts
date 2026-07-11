import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'so.facet.app',
  appName: 'Facet',
  webDir: 'dist',
  ios: {
    // The reflection ritual happens at night. A black canvas means no
    // white flash on launch.
    backgroundColor: '#000000',
    // The web layer owns the safe areas (viewport-fit=cover + env() in CSS);
    // a native inset on top of that would double the tab bar's clearance.
    contentInset: 'never',
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
