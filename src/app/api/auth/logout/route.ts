import { NextResponse } from "next/server";
import { COOKIE_NAME, USERNAME_COOKIE } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // Match login route: false in dev for HTTP compat
    sameSite: "lax",
    path: "/",
    maxAge: 0, // Immediately expire
  });
  // Also clear the username cookie
  response.cookies.set(USERNAME_COOKIE, "", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
