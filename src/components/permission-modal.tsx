"use client";

import { useEffect, useMemo, useState } from "react";
import type { PermissionBlockerMetadata } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type PermissionScope = "once" | "session" | "1h";

export interface PermissionGrantRequest {
  scope: PermissionScope;
  reason: string | null;
  pending_action_id: string | null;
}

interface PermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  blockerMetadata: PermissionBlockerMetadata;
  onGrant: (request: PermissionGrantRequest) => void;
  onDeny: () => void;
}

export function PermissionModal({
  isOpen,
  onClose,
  blockerMetadata,
  onGrant,
  onDeny,
}: PermissionModalProps) {
  const [scope, setScope] = useState<PermissionScope>("once");
  const [showDetails, setShowDetails] = useState(false);
  const [reason, setReason] = useState(blockerMetadata.agent_reason ?? "");

  const requestedCapability = useMemo(
    () => (blockerMetadata.requested_capability || "WRITE").toUpperCase(),
    [blockerMetadata.requested_capability],
  );

  useEffect(() => {
    if (isOpen) {
      setReason(blockerMetadata.agent_reason ?? "");
      setScope("once");
      setShowDetails(false);
    }
  }, [isOpen, blockerMetadata.agent_reason]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const handleGrant = () => {
    onGrant({
      scope,
      reason: reason.trim().length > 0 ? reason.trim() : null,
      pending_action_id: blockerMetadata.pending_action_id ?? null,
    });
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="max-w-xl border-amber-200 bg-amber-50/70">
        <DialogHeader>
          <DialogTitle data-testid="permission-modal-title">
            Permission required: {requestedCapability}
          </DialogTitle>
          <DialogDescription className="text-amber-900/90">
            {blockerMetadata.summary ||
              "The agent needs elevated permission to continue this action safely."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div>
            <button
              type="button"
              onClick={() => setShowDetails((prev) => !prev)}
              className="text-sm font-medium text-amber-900 underline-offset-4 hover:underline"
              data-testid="permission-modal-toggle-details"
            >
              {showDetails ? "Hide details" : "View details"}
            </button>
            {showDetails && (
              <div className="mt-2 rounded-md border border-amber-200 bg-white p-3 text-sm text-amber-950">
                <div>
                  <span className="font-medium">Tool:</span> {blockerMetadata.tool_name || "unknown"}
                </div>
                <div>
                  <span className="font-medium">Action:</span> {blockerMetadata.action_name || "unknown"}
                </div>
                <div>
                  <span className="font-medium">Target:</span> {blockerMetadata.target || "unspecified"}
                </div>
                <div className="mt-2">
                  <span className="font-medium">Justification:</span>{" "}
                  {blockerMetadata.agent_reason || "No reason provided by the agent."}
                </div>
              </div>
            )}
          </div>

          <fieldset className="grid gap-2" data-testid="permission-modal-scope">
            <legend className="text-sm font-semibold text-amber-950">Expiration</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="permission-scope"
                value="once"
                checked={scope === "once"}
                onChange={() => setScope("once")}
              />
              Once (this action only)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="permission-scope"
                value="session"
                checked={scope === "session"}
                onChange={() => setScope("session")}
              />
              For this session
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="permission-scope"
                value="1h"
                checked={scope === "1h"}
                onChange={() => setScope("1h")}
              />
              1 hour
            </label>
          </fieldset>

          <label className="grid gap-1 text-sm">
            <span className="font-semibold text-amber-950">Reason (optional)</span>
            <input
              type="text"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Add context for audit trail"
              className="h-9 rounded-md border border-amber-200 bg-white px-3 text-sm outline-none ring-amber-400 focus:ring-2"
              data-testid="permission-modal-reason"
            />
          </label>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="border-gray-300 bg-white"
            onClick={onDeny}
          >
            Deny
          </Button>
          <Button
            type="button"
            className="bg-amber-600 text-white hover:bg-amber-700"
            onClick={handleGrant}
            data-testid="permission-modal-grant"
          >
            Grant {requestedCapability}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PermissionModal;
