import { io } from "next/cache";
import { Suspense } from "react";
import { getSession } from "@/services/auth/session.server";
import { ProfileMenu, ProfileMenuPlaceholder } from "./ProfileMenu";

async function SessionProfileMenu() {
  // Verifying the session compares its expiry with the clock; `io()` keeps
  // that out of prerenders (including runtime prefetches) so it runs per request.
  await io();
  const session = await getSession();
  return session ? <ProfileMenu email={session.email} /> : null;
}

/**
 * The signed-in viewer's avatar menu. Reading the session cookie is request
 * data, so with Cache Components it streams in behind its own boundary and
 * the rest of the shell stays in the static prerender.
 */
export function UserMenu() {
  return (
    <Suspense fallback={<ProfileMenuPlaceholder />}>
      <SessionProfileMenu />
    </Suspense>
  );
}
