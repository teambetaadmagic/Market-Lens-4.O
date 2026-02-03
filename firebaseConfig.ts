import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// ------------------------------------------------------------------
// Market Lens Firebase Configuration
// ------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyBWKwMJNb8ukhwdkXoN2puTtI3yyxVODSQ",
  authDomain: "market-lense-4-o.firebaseapp.com",
  projectId: "market-lense-4-o",
  storageBucket: "market-lense-4-o.firebasestorage.app",
  messagingSenderId: "154541745882",
  appId: "1:154541745882:web:5b163b15cfb2549088e7e3",
  measurementId: "G-JQ8J9GG860"
};

// Check if config is still default placeholder
export const isConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY";

const app = initializeApp(firebaseConfig);

// Initialize Firestore with long polling to prevent 'unavailable' errors in some environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

export const storage = getStorage(app);
