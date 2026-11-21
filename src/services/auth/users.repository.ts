import "server-only";

import { type DocumentData, FieldValue, type Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/services/firebase/firebase.admin";
import type { AccessStatus } from "./session.token";

/**
 * Who may watch: one `users/{uid}` doc per account, written only through the
 * Admin SDK (the Firestore security rules deny all client access). Emails listed in
 * ADMIN_EMAILS are approved automatically and can approve everyone else.
 */

export interface AppUser {
  uid: string;
  email: string;
  status: AccessStatus;
  createdAt: Date | null;
  decidedAt: Date | null;
}

const COLLECTION = "users";

export function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export const isAdminEmail = (email: string) => adminEmails().has(email.toLowerCase());

const toDate = (value: unknown) => (value && typeof (value as Timestamp).toDate === "function" ? (value as Timestamp).toDate() : null);

function toUser(uid: string, data: DocumentData): AppUser {
  const status: AccessStatus = data.status === "approved" || data.status === "rejected" ? data.status : "pending";
  return {
    uid,
    email: String(data.email ?? ""),
    status,
    createdAt: toDate(data.createdAt),
    decidedAt: toDate(data.decidedAt),
  };
}

const usersCollection = () => getAdminDb().collection(COLLECTION);

export async function getUser(uid: string): Promise<AppUser | null> {
  const snapshot = await usersCollection().doc(uid).get();
  return snapshot.exists ? toUser(uid, snapshot.data()!) : null;
}

/**
 * The user's current record, creating it on first sign-in. Admin emails are
 * always approved. `created` is true when this call made a new pending record.
 */
export async function ensureUser(uid: string, email: string): Promise<{ user: AppUser; created: boolean }> {
  const ref = usersCollection().doc(uid);
  const admin = isAdminEmail(email);

  return getAdminDb().runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (snapshot.exists) {
      const user = toUser(uid, snapshot.data()!);
      if (admin && user.status !== "approved") {
        tx.update(ref, { status: "approved", decidedAt: FieldValue.serverTimestamp() });
        return { user: { ...user, status: "approved" }, created: false };
      }
      return { user, created: false };
    }

    const status: AccessStatus = admin ? "approved" : "pending";
    tx.set(ref, {
      email,
      status,
      createdAt: FieldValue.serverTimestamp(),
      decidedAt: admin ? FieldValue.serverTimestamp() : null,
    });
    return { user: { uid, email, status, createdAt: new Date(), decidedAt: null }, created: !admin };
  });
}

export async function listUsers(): Promise<AppUser[]> {
  const snapshot = await usersCollection().get();
  return snapshot.docs
    .map((doc) => toUser(doc.id, doc.data()))
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}

export async function setUserStatus(uid: string, status: AccessStatus): Promise<void> {
  await usersCollection().doc(uid).update({ status, decidedAt: FieldValue.serverTimestamp() });
}
