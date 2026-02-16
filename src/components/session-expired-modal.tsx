"use client";

import { useState, FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

interface SessionExpiredModalProps {
  open: boolean;
  onReauth: () => void;
  savedUsername: string | null;
}

export function SessionExpiredModal({
  open,
  onReauth,
  savedUsername,
}: SessionExpiredModalProps) {
  const [username, setUsername] = useState(savedUsername ?? "");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), token }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Login failed" }));
        setError(data.error || "Login failed");
        return;
      }

      // Success -- clear form and close modal
      setToken("");
      setError(null);
      onReauth();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md"
        // Prevent closing via escape or outside click -- user must re-authenticate
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        // Hide close button by not rendering DialogClose
      >
        <DialogHeader>
          <DialogTitle>Session Expired</DialogTitle>
          <DialogDescription>
            Your session has expired. Enter your token to continue where you left
            off.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="reauth-username">Display name</Label>
            <Input
              id="reauth-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your name"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="reauth-token">Token</Label>
            <PasswordInput
              id="reauth-token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter your token"
              required
              autoFocus
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <Button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Continue session"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
