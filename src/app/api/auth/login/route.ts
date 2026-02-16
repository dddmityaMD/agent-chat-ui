import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_CASES_API_URL || "http://api:8000";

export async function POST(request: Request) {
  const { token, username } = await request.json();

  if (!token || !username) {
    return NextResponse.json(
      { error: "Token and username are required" },
      { status: 400 }
    );
  }

  // Validate token against backend
  try {
    const res = await fetch(`${API_BASE}/auth/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, username }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { session_cookie } = await res.json();

    // Set HTTP-only cookie on the response
    const response = NextResponse.json({ ok: true, username });
    response.cookies.set(COOKIE_NAME, session_cookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Must be false in dev (HTTP) or browsers refuse to set Secure cookies
      sameSite: "lax",
      path: "/",
      maxAge: 86400, // 24 hours
    });
    return response;
  } catch (err) {
    console.error("Login validation failed:", err);
    return NextResponse.json(
      { error: "Authentication service unavailable" },
      { status: 503 }
    );
  }
}
