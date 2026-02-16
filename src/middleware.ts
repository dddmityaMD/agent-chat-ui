import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
// NOTE: Do NOT import from @/lib/auth here. Middleware runs in Edge Runtime.
// If @/lib/auth ever imports Node.js APIs (crypto, fs, etc.), this middleware breaks.
// Inline the cookie name constant instead.

const PUBLIC_PATHS = ["/login"];
const PUBLIC_PREFIXES = ["/api/auth", "/_next/static", "/_next/image", "/favicon.ico"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // Check for session cookie (inline name -- edge runtime constraint)
  const session = request.cookies.get("sais_session");
  if (!session?.value) {
    // API routes should get 401 JSON, not redirect (H-FE-04)
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
