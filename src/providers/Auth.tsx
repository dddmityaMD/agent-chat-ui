"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { getApiBaseUrl } from "@/lib/api-url";

interface UserInfo {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

interface AuthContextType {
  user: UserInfo | null;
  /** Display name for backward compatibility (uses user.name or user.email) */
  username: string | null;
  isAdmin: boolean;
  sessionExpired: boolean;
  setSessionExpired: (expired: boolean) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  // Guard against race condition: multiple parallel 401s triggering duplicate redirect
  const sessionExpiredRef = useRef(false);
  const fetchedRef = useRef(false);

  // Fetch current user info from JWT-backed endpoint
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const base = getApiBaseUrl();
    fetch(`${base}/api/users/me`, { credentials: "include" })
      .then((res) => {
        if (res.status === 401) {
          // Not authenticated — redirect to login
          // Only redirect if not already on login page
          if (!window.location.pathname.startsWith("/login")) {
            router.push("/login");
          }
          return null;
        }
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data) {
          setUser({
            id: data.user_id,
            email: data.email,
            name: data.name ?? null,
            role: data.role ?? "member",
          });
        }
      })
      .catch(() => {
        // Network error — silently ignore, user stays unauthenticated
      });
  }, [router]);

  const handleSessionExpired = useCallback(
    (expired: boolean) => {
      if (expired && sessionExpiredRef.current) return; // Already handling
      sessionExpiredRef.current = expired;
      setSessionExpired(expired);

      if (expired) {
        // Redirect to login with expired flag — OAuth re-auth requires full
        // page redirect anyway, so a modal with form fields is useless.
        router.push("/login?expired=true");
      }
    },
    [router],
  );

  const logout = useCallback(async () => {
    const base = getApiBaseUrl();
    // Call backend OAuth logout to clear JWT cookie
    await fetch(`${base}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    // Also call frontend logout route to clear cookie on frontend domain
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
  }, [router]);

  const username = user?.name ?? user?.email ?? null;
  const isAdmin = user?.role === "admin";

  return (
    <AuthContext.Provider
      value={{
        user,
        username,
        isAdmin,
        sessionExpired,
        setSessionExpired: handleSessionExpired,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
