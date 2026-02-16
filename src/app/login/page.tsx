"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { USERNAME_COOKIE } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, username }),
      });

      if (res.ok) {
        // Remember username in a JS-readable cookie (per locked decision: username in cookie, not localStorage)
        document.cookie = `${USERNAME_COOKIE}=${encodeURIComponent(username)}; path=/; max-age=86400; samesite=lax`;
        router.push("/");
      } else {
        const data = await res.json();
        setError(data.error || "Invalid token");
      }
    } catch {
      setError("Authentication service unavailable");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900">
            SAIS DataBI
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="username">Display name</Label>
              <Input
                id="username"
                type="text"
                placeholder="Your name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="token">Token</Label>
              <PasswordInput
                id="token"
                placeholder="Enter your token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                autoComplete="current-password"
              />
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading || !username || !token}
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
