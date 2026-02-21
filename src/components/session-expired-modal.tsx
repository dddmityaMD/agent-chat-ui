"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SessionExpiredModalProps {
  open: boolean;
  onReauth?: () => void;
  savedUsername?: string | null;
}

/**
 * Simplified session expired modal. Since OAuth re-auth requires a full page
 * redirect (not inline form), this just shows a message and a redirect button.
 *
 * Note: The AuthProvider now handles session expiry via direct redirect to
 * /login?expired=true, so this modal is kept only as a fallback.
 */
export function SessionExpiredModal({
  open,
  onReauth,
}: SessionExpiredModalProps) {
  const handleLogin = () => {
    if (onReauth) {
      onReauth();
    } else {
      window.location.href = "/login?expired=true";
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Session Expired</DialogTitle>
          <DialogDescription>
            Your session has expired. Please sign in again to continue.
          </DialogDescription>
        </DialogHeader>

        <Button onClick={handleLogin} className="w-full">
          Log in again
        </Button>
      </DialogContent>
    </Dialog>
  );
}
