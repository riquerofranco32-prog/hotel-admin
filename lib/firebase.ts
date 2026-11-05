import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** true si hay credenciales de Firebase; si no, la app funciona en modo demo (localStorage). */
export const firebaseEnabled = Boolean(config.apiKey && config.projectId && config.appId);

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

export function fb() {
  if (!firebaseEnabled) throw new Error("Firebase no configurado");
  if (!app) {
    app = getApps()[0] ?? initializeApp(config);
    auth = getAuth(app);
    // Caché persistente en IndexedDB: recargas instantáneas, menos lecturas y funciona sin conexión
    try {
      db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
    } catch {
      db = getFirestore(app);
    }
    // Desarrollo local con `npm run emulators` (NEXT_PUBLIC_FIREBASE_EMULATOR=1)
    if (process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === "1") {
      connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
      connectFirestoreEmulator(db, "127.0.0.1", 8080);
    }
  }
  return { app: app!, auth: auth!, db: db! };
}
