import "server-only";

import { type App, cert, getApps, initializeApp } from "firebase-admin/app";
import { type Firestore, getFirestore } from "firebase-admin/firestore";

/**
 * Firebase Admin SDK — used only for *writes* (Telegram ingestion), which
 * must not rely on client keys plus open security rules. Catalog reads use
 * the Web SDK (`firebase.web.ts`). Optional: without it the app still reads
 * the catalog; only the sync/webhook endpoints are disabled.
 *
 * Credentials (first match wins):
 *   1. FIRESTORE_EMULATOR_HOST + FIREBASE_PROJECT_ID   (local development)
 *   2. FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 */

interface AdminConfig {
  projectId: string;
  clientEmail?: string;
  privateKey?: string;
  emulator: boolean;
}

function readConfig(): AdminConfig | null {
  const projectId =
    process.env.FIREBASE_PROJECT_ID?.trim() || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  if (!projectId) return null;

  if (process.env.FIRESTORE_EMULATOR_HOST) return { projectId, emulator: true };

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  // Env files store the PEM on one line with literal "\n" sequences.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  return clientEmail && privateKey ? { projectId, clientEmail, privateKey, emulator: false } : null;
}

export const isFirebaseAdminConfigured = () => readConfig() !== null;

let firestore: Firestore | null = null;

export function getAdminDb(): Firestore {
  if (firestore) return firestore;

  const config = readConfig();
  if (!config) throw new Error("Firebase Admin is not configured (see .env.example).");

  // firebase-admin is one shared (external) instance, but this module can be
  // bundled into several route chunks; only the creator may apply settings.
  const existing: App | undefined = getApps()[0];
  const app: App =
    existing ??
    initializeApp(
      config.emulator
        ? { projectId: config.projectId }
        : {
            projectId: config.projectId,
            credential: cert({
              projectId: config.projectId,
              clientEmail: config.clientEmail,
              privateKey: config.privateKey,
            }),
          },
    );

  firestore = getFirestore(app);
  if (!existing) firestore.settings({ ignoreUndefinedProperties: true });
  return firestore;
}
