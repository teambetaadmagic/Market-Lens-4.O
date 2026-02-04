import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// ------------------------------------------------------------------
// Market Lens Firebase Configuration
// ------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyA6NRKT-L_7I4sfbjLKKX0PmExgFswnKnA",
  authDomain: "market-lens-a907c.firebaseapp.com",
  projectId: "market-lens-a907c",
  storageBucket: "market-lens-a907c.firebasestorage.app",
  messagingSenderId: "566860518876",
  appId: "1:566860518876:web:cc5a04fd93be90107f2b19",
  measurementId: "G-CP10QDCY3R"
};

// Check if config is still default placeholder
export const isConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY";

const app = initializeApp(firebaseConfig);

// Initialize Firestore with long polling to prevent 'unavailable' errors in some environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

export const storage = getStorage(app);
