/**
 * Behavioral tests for WorkspaceTab component.
 *
 * Phase 54.2 Plan 03 - Task 3: Tests verify empty state, file list rendering,
 * file content fetch on click, and refreshKey-triggered re-fetch.
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { WorkspaceTab } from "../workspace-tab";

// Mock getApiBaseUrl
jest.mock("@/lib/api-url", () => ({
  getApiBaseUrl: () => "http://localhost:8000",
}));

// Mock lucide-react icons to simple spans
jest.mock("lucide-react", () => ({
  FileText: ({ className }: { className?: string }) => (
    <span data-testid="file-icon" className={className} />
  ),
  FolderOpen: ({ className }: { className?: string }) => (
    <span data-testid="folder-open-icon" className={className} />
  ),
  Folder: ({ className }: { className?: string }) => (
    <span data-testid="folder-icon" className={className} />
  ),
  Loader2: ({ className }: { className?: string }) => (
    <span data-testid="loader-icon" className={className} />
  ),
  Plus: ({ className }: { className?: string }) => (
    <span data-testid="plus-icon" className={className} />
  ),
  Check: ({ className }: { className?: string }) => (
    <span data-testid="check-icon" className={className} />
  ),
}));

const defaultProps = {
  onStartThread: jest.fn().mockResolvedValue(undefined),
  currentThread: null,
};

describe("WorkspaceTab", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("shows empty state when API returns empty files array", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        workspace_root: "/data/workspaces/user",
        files: [],
      }),
    });

    render(<WorkspaceTab threadId="t1" {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("No workspace files yet.")).toBeInTheDocument();
    });
  });

  it("renders file names in the tree when API returns files", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        workspace_root: "/data/workspaces/user",
        files: [
          { path: "models/stg_orders.sql", size: 120, modified: 1710000000 },
          { path: "models/schema.yml", size: 80, modified: 1710000001 },
        ],
      }),
    });

    render(<WorkspaceTab threadId="t1" {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("stg_orders.sql")).toBeInTheDocument();
    });
    expect(screen.getByText("schema.yml")).toBeInTheDocument();
    // Directory node should also render
    expect(screen.getByText("models")).toBeInTheDocument();
  });

  it("fetches and displays file content when a file is clicked", async () => {
    // First call: file listing
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        workspace_root: "/data/workspaces/user",
        files: [
          { path: "models/stg_orders.sql", size: 120, modified: 1710000000 },
        ],
      }),
    });

    render(<WorkspaceTab threadId="t1" {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("stg_orders.sql")).toBeInTheDocument();
    });

    // Mock the file content fetch
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        path: "models/stg_orders.sql",
        content: "SELECT * FROM raw.orders",
        size: 25,
      }),
    });

    // Click the file
    fireEvent.click(screen.getByText("stg_orders.sql"));

    await waitFor(() => {
      expect(screen.getByText("SELECT * FROM raw.orders")).toBeInTheDocument();
    });

    // Verify the file content endpoint was called
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/workspace/file?path=models%2Fstg_orders.sql"),
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("re-fetches file list when refreshKey changes", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        workspace_root: "/data/workspaces/user",
        files: [
          { path: "notes.md", size: 50, modified: 1710000000 },
        ],
      }),
    });

    const { rerender } = render(<WorkspaceTab threadId="t1" refreshKey={1} {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("notes.md")).toBeInTheDocument();
    });

    // Count calls to the workspace listing endpoint
    const listCalls = (global.fetch as jest.Mock).mock.calls.filter(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("/workspace") && !(call[0] as string).includes("/workspace/file"),
    );
    expect(listCalls).toHaveLength(1);

    // Re-render with new refreshKey
    rerender(<WorkspaceTab threadId="t1" refreshKey={2} {...defaultProps} />);

    await waitFor(() => {
      const allListCalls = (global.fetch as jest.Mock).mock.calls.filter(
        (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("/workspace") && !(call[0] as string).includes("/workspace/file"),
      );
      expect(allListCalls).toHaveLength(2);
    });
  });
});
