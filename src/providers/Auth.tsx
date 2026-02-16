"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { SessionExpiredModal } from "@/components/session-expired-modal";

interface AuthContextType {
  username: string | null;
  sessionExpired: boolean;
  setSessionExpired: (expired: boolean) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  // Read username from JS-readable sais_username cookie
  // (per locked decision: username in cookie, not localStorage)
  const [username] = useState(() => readCookie("sais_username"));
  const [sessionExpired, setSessionExpired] = useState(false);
  // Guard against race condition: multiple parallel 401s triggering duplicate modal
  const sessionExpiredRef = useRef(false);

  const handleSessionExpired = useCallback((expired: boolean) => {
    if (expired && sessionExpiredRef.current) return; // Already showing modal
    sessionExpiredRef.current = expired;
    setSessionExpired(expired);
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    // Clear username cookie
    document.cookie = "sais_username=; path=/; max-age=0; samesite=lax";
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        username,
        sessionExpired,
        setSessionExpired: handleSessionExpired,
        logout,
      }}
    >
      {children}
      <SessionExpiredModal
        open={sessionExpired}
        onReauth={() => {
          sessionExpiredRef.current = false;
          setSessionExpired(false);
          // Full reload to reset all providers, polling intervals, and component
          // effects with the fresh session cookie. router.refresh() won't reset
          // client-side hooks/intervals, so a hard reload is needed.
          window.location.reload();
        }}
        savedUsername={username}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
