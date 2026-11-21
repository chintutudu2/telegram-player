import "server-only";

/**
 * Email/password accounts via the Firebase Auth REST API, called from the
 * server (Server Actions). No Firebase Auth SDK ships to the browser, and the
 * browser never holds a Firebase token: the app issues its own session cookie
 * once Google has confirmed the password.
 *
 * Needs: Firebase console → Authentication → Sign-in method → Email/Password.
 * Local tests: FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099.
 */

export interface AuthAccount {
  uid: string;
  email: string;
}

export class AuthError extends Error {}

const MESSAGES: Record<string, string> = {
  EMAIL_EXISTS: "An account with this email already exists. Sign in instead.",
  EMAIL_NOT_FOUND: "Wrong email or password.",
  INVALID_PASSWORD: "Wrong email or password.",
  INVALID_LOGIN_CREDENTIALS: "Wrong email or password.",
  INVALID_EMAIL: "That email address doesn’t look right.",
  USER_DISABLED: "This account has been disabled.",
  TOO_MANY_ATTEMPTS_TRY_LATER: "Too many attempts. Wait a few minutes and try again.",
  OPERATION_NOT_ALLOWED: "Email sign-in isn’t enabled for this app yet.",
  CONFIGURATION_NOT_FOUND: "Email sign-in isn’t enabled for this app yet.",
};

function endpoint(method: string): string | null {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  if (!apiKey) return null;
  const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST?.trim();
  const base = emulator
    ? `http://${emulator}/identitytoolkit.googleapis.com`
    : "https://identitytoolkit.googleapis.com";
  return `${base}/v1/accounts:${method}?key=${encodeURIComponent(apiKey)}`;
}

export const isAuthProviderConfigured = () => endpoint("signInWithPassword") !== null;

async function call<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const url = endpoint(method);
  if (!url) throw new AuthError("Sign-in isn’t configured (missing Firebase web keys).");

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new AuthError("Couldn’t reach the sign-in service. Try again.");
  }

  const json = (await response.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
  if (!response.ok || !json || json.error) {
    // Firebase codes look like "WEAK_PASSWORD : Password should be at least 6 characters".
    const raw = json?.error?.message ?? `HTTP ${response.status}`;
    const code = raw.split(" ")[0];
    if (code === "WEAK_PASSWORD") throw new AuthError("Use a password with at least 6 characters.");
    throw new AuthError(MESSAGES[code] ?? "Sign-in failed. Try again.");
  }
  return json;
}

interface AccountResponse {
  localId: string;
  email: string;
}

const toAccount = (r: AccountResponse): AuthAccount => ({ uid: r.localId, email: r.email.toLowerCase() });

export const firebaseAuth = {
  signIn: async (email: string, password: string) =>
    toAccount(await call<AccountResponse>("signInWithPassword", { email, password, returnSecureToken: true })),

  signUp: async (email: string, password: string) =>
    toAccount(await call<AccountResponse>("signUp", { email, password, returnSecureToken: true })),

  /** Firebase emails a reset link (its hosted reset page). Unknown emails are ignored silently. */
  sendPasswordReset: async (email: string) => {
    try {
      await call("sendOobCode", { requestType: "PASSWORD_RESET", email });
    } catch (error) {
      // Don't reveal whether an account exists.
      if (error instanceof AuthError && error.message === MESSAGES.EMAIL_NOT_FOUND) return;
      throw error;
    }
  },
};
