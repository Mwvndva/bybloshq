import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

let app: FirebaseApp | null = null;
let analytics: Analytics | null = null;

if (firebaseConfig.apiKey && typeof window !== "undefined") {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

  isSupported().then((supported) => {
    if (supported && app) {
      analytics = getAnalytics(app);
    }
  }).catch(() => {
    // Ignore analytics unsupported environments (e.g., ad blockers, SSR context)
  });
}

export { app, analytics, firebaseConfig };
