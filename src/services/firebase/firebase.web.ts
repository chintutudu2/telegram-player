import { type FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { connectFirestoreEmulator, type Firestore, getFirestore } from "firebase/firestore/lite";

/**
 * Firebase Web SDK, configured purely from public `NEXT_PUBLIC_FIREBASE_*`
 * keys. Used for catalog reads (Firestore Lite: REST, no realtime socket).
 * Reads run on the server inside cached functions, so Firestore usage stays
 * at roughly one collection read per cache window regardless of traffic.
 *
 * Security comes from the Firestore security rules (public read on `media`, no client
 * writes) — these keys are public by design.
 */

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export function getFirebaseWebConfig(): FirebaseWebConfig | null {
  // Literal `process.env.NEXT_PUBLIC_*` access so Next.js can inline values.
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  };
  return config.apiKey && config.projectId && config.appId ? config : null;
}

export const isFirebaseWebConfigured = () => getFirebaseWebConfig() !== null;

function getFirebaseApp(): FirebaseApp {
  const config = getFirebaseWebConfig();
  if (!config) throw new Error("Firebase is not configured (see .env.example).");
  return getApps().length ? getApp() : initializeApp(config);
}

// The SDK may be bundled once per route chunk (separate instances) or shared;
// track connected *instances* process-wide so each is wired exactly once.
const CONNECTED = Symbol.for("telegram-player.firestore-emulator-connected");
type GlobalWithConnected = typeof globalThis & { [CONNECTED]?: WeakSet<Firestore> };

/** Firestore Lite instance for catalog reads. */
export function getCatalogDb(): Firestore {
  const db = getFirestore(getFirebaseApp());
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  if (host) {
    const connected = ((globalThis as GlobalWithConnected)[CONNECTED] ??= new WeakSet());
    if (!connected.has(db)) {
      const [hostname, port] = host.split(":");
      connectFirestoreEmulator(db, hostname, Number(port));
      connected.add(db);
    }
  }
  return db;
}
