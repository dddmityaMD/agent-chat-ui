"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

interface DeleteConnectorDialogProps {
  open: boolean;
  connectorName: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  errorMessage?: string | null;
}

export function DeleteConnectorDialog({
  open,
  connectorName,
  onConfirm,
  onCancel,
  loading = false,
  errorMessage = null,
}: DeleteConnectorDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          <Dialog.Title className="text-lg font-semibold text-foreground">
            Delete Connector
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            Are you sure? This will remove the connector{" "}
            <strong className="text-foreground">{connectorName}</strong> and its
            credentials.
          </Dialog.Description>

          {errorMessage && (
            <div className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onCancel}
              disabled={loading}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
            >
              {loading ? "Deleting..." : "Delete"}
            </button>
          </div>

          <Dialog.Close asChild>
            <button
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
