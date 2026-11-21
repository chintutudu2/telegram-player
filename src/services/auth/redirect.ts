import { type NextRequest, NextResponse } from "next/server";

/**
 * Same-site redirect from proxy.ts. Proxy requires an absolute URL, and
 * Next.js turns a same-origin one back into a relative Location header.
 */
export const redirectTo = (request: NextRequest, path: string) =>
  NextResponse.redirect(new URL(path, request.nextUrl));

/**
 * Same-site redirect from a Route Handler, as a relative Location header.
 * There `request.url` reflects the server's own address (e.g. localhost:3000
 * behind Caddy), not the host the browser used, so absolute URLs would break.
 */
export const relativeRedirect = (path: string) =>
  new NextResponse(null, { status: 307, headers: { Location: path } });
