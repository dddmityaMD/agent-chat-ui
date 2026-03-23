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
    <Dialog.Root
      open={open}
      onOpenChange={(isOpen) => !isOpen && onCancel()}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="border-border bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border p-6 shadow-lg">
          <Dialog.Title className="text-foreground text-lg font-semibold">
            Delete Connector
          </Dialog.Title>
          <Dialog.Description className="text-muted-foreground mt-2 text-sm">
            Are you sure? This will remove the connector{" "}
            <strong className="text-foreground">{connectorName}</strong> and its
            credentials.
          </Dialog.Description>

          {errorMessage && (
            <div className="bg-destructive/10 text-destructive mt-3 rounded-md px-3 py-2 text-sm">
              {errorMessage}
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onCancel}
              disabled={loading}
              className="border-border text-foreground hover:bg-accent rounded-md border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? "Deleting..." : "Delete"}
            </button>
          </div>

          <Dialog.Close asChild>
            <button
              className="text-muted-foreground hover:text-foreground absolute top-4 right-4 transition-colors"
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
