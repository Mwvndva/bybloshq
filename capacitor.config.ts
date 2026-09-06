import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'space.bybloshq.app',
  appName: 'Byblos',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  android: {
    // No static WebView backgroundColor: it would show a light frame on a dark
    // cold launch. MainActivity sets the WebView background from the
    // OS-qualified @color/byblos_launch_background (light in values/, #000000 in
    // values-night/), matching the native splash/window/status-bar. Run
    // `npx cap sync android` after changing this file.
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    Keyboard: {
      resize: 'body',
      // Initial accessory-bar style only (app defaults to dark). At runtime
      // applyResolvedTheme() calls Keyboard.setStyle() so the bar follows the
      // active light/dark theme. Run `npx cap sync android` after changing this.
      style: 'dark',
      resizeOnFullScreen: true
    },
    SystemBars: {
      insetsHandling: 'css'
    }
  }
};

export default config;
