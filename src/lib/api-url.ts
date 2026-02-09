/**
 * Centralized API base URL resolution.
 *
 * Priority:
 *  1. NEXT_PUBLIC_CASES_API_URL env var (explicit configuration)
 *  2. Derive from window.location (works in Docker when env var is unset)
 *  3. http://localhost:8000 (SSR / fallback)
 */
export function getApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_CASES_API_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");

  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:8000`;
  }

  return "http://localhost:8000";
}
