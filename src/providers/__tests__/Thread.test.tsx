/**
 * Tests for ThreadProvider and useThreads hook.
 *
 * Phase 19 - TEST-04: Frontend component test coverage.
 *
 * Tests the public API of ThreadProvider: getThreads, registerThread,
 * updateThread, archiveThread, permissionState management.
 */
import React from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { ThreadProvider, useThreads, usePermissionState } from "../Thread";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock useAuth from Auth provider
const mockSetSessionExpired = jest.fn();
jest.mock("../Auth", () => ({
  useAuth: () => ({
    username: "testuser",
    sessionExpired: false,
    setSessionExpired: mockSetSessionExpired,
    logout: jest.fn(),
  }),
}));

// Mock getApiBaseUrl
jest.mock("@/lib/api-url", () => ({
  getApiBaseUrl: () => "http://localhost:8000",
}));

// Mock useSaisUi extractors (used by Thread.tsx for extractFlowInfo)
jest.mock("@/hooks/useSaisUi", () => ({
  extractFlowType: jest.fn(() => null),
  extractHandoffProposal: jest.fn(() => null),
}));

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const mockThread = {
  thread_id: "thread-1",
  workspace_id: null,
  title: "Test Thread",
  is_pinned: false,
  is_archived: false,
  created_at: "2026-01-01T00:00:00Z",
  last_activity_at: "2026-01-01T00:00:00Z",
  last_message_preview: "Hello",
};

/** Component that exposes ThreadProvider state for testing */
function ThreadConsumer() {
  const {
    threads,
    threadsLoading,
    getThreads,
    setThreads,
    registerThread,
    updateThread,
    archiveThread,
  } = useThreads();

  return (
    <div>
      <div data-testid="threads-count">{threads.length}</div>
      <div data-testid="threads-loading">{threadsLoading.toString()}</div>
      <button
        data-testid="fetch-threads"
        onClick={async () => {
          const result = await getThreads();
          setThreads(result);
        }}
      >
        Fetch
      </button>
      <button
        data-testid="register-thread"
        onClick={() => registerThread("new-thread", "Title")}
      >
        Register
      </button>
      <button
        data-testid="update-thread"
        onClick={() => updateThread("thread-1", { title: "Updated" })}
      >
        Update
      </button>
      <button
        data-testid="archive-thread"
        onClick={() => archiveThread("thread-1")}
      >
        Archive
      </button>
    </div>
  );
}

function PermissionConsumer() {
  const { permissionState, addPermissionGrant, revokePermissionGrant, clearPermissionGrants } =
    usePermissionState();

  return (
    <div>
      <div data-testid="grants-count">{permissionState.grants.length}</div>
      <button
        data-testid="add-grant"
        onClick={() =>
          addPermissionGrant({
            capability: "WRITE",
            scope: "once",
            granted_at: "2026-01-01T00:00:00Z",
            expires_at: null,
            reason: null,
            pending_action_id: "pa-1",
          })
        }
      >
        Add Grant
      </button>
      <button
        data-testid="revoke-grant"
        onClick={() => revokePermissionGrant("pa-1")}
      >
        Revoke
      </button>
      <button data-testid="clear-grants" onClick={clearPermissionGrants}>
        Clear
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ThreadProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("provides initial empty state", () => {
    render(
      <ThreadProvider>
        <ThreadConsumer />
      </ThreadProvider>,
    );
    expect(screen.getByTestId("threads-count")).toHaveTextContent("0");
    expect(screen.getByTestId("threads-loading")).toHaveTextContent("false");
  });

  it("getThreads fetches from /api/threads and updates state", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [mockThread],
    });

    render(
      <ThreadProvider>
        <ThreadConsumer />
      </ThreadProvider>,
    );

    await act(async () => {
      await userEvent.click(screen.getByTestId("fetch-threads"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("threads-count")).toHaveTextContent("1");
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/threads?",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("getThreads triggers session expired on 401", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    render(
      <ThreadProvider>
        <ThreadConsumer />
      </ThreadProvider>,
    );

    await act(async () => {
      await userEvent.click(screen.getByTestId("fetch-threads"));
    });

    expect(mockSetSessionExpired).toHaveBeenCalledWith(true);
  });

  it("getThreads returns empty on network error", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

    render(
      <ThreadProvider>
        <ThreadConsumer />
      </ThreadProvider>,
    );

    await act(async () => {
      await userEvent.click(screen.getByTestId("fetch-threads"));
    });

    expect(screen.getByTestId("threads-count")).toHaveTextContent("0");
  });

  it("registerThread calls POST /api/threads/{id}/register", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockThread,
    });

    render(
      <ThreadProvider>
        <ThreadConsumer />
      </ThreadProvider>,
    );

    await act(async () => {
      await userEvent.click(screen.getByTestId("register-thread"));
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/threads/new-thread/register",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );
  });

  it("updateThread calls PATCH and optimistically updates local state", async () => {
    // First populate threads
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [mockThread],
    });

    render(
      <ThreadProvider>
        <ThreadConsumer />
      </ThreadProvider>,
    );

    // Populate threads
    await act(async () => {
      await userEvent.click(screen.getByTestId("fetch-threads"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("threads-count")).toHaveTextContent("1");
    });

    // Now mock the update call
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
    });

    await act(async () => {
      await userEvent.click(screen.getByTestId("update-thread"));
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/threads/thread-1",
      expect.objectContaining({
        method: "PATCH",
        credentials: "include",
      }),
    );
  });

  it("archiveThread calls POST /api/threads/{id}/archive", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
    });

    render(
      <ThreadProvider>
        <ThreadConsumer />
      </ThreadProvider>,
    );

    await act(async () => {
      await userEvent.click(screen.getByTestId("archive-thread"));
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/threads/thread-1/archive",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );
  });
});

describe("useThreads outside provider", () => {
  it("throws error when used outside ThreadProvider", () => {
    function BadConsumer() {
      useThreads();
      return null;
    }

    // Suppress console.error for expected error
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<BadConsumer />)).toThrow(
      "useThreads must be used within a ThreadProvider",
    );
    spy.mockRestore();
  });
});

describe("Permission state management", () => {
  it("starts with empty grants", () => {
    render(
      <ThreadProvider>
        <PermissionConsumer />
      </ThreadProvider>,
    );
    expect(screen.getByTestId("grants-count")).toHaveTextContent("0");
  });

  it("addPermissionGrant adds a grant", async () => {
    render(
      <ThreadProvider>
        <PermissionConsumer />
      </ThreadProvider>,
    );

    await act(async () => {
      await userEvent.click(screen.getByTestId("add-grant"));
    });

    expect(screen.getByTestId("grants-count")).toHaveTextContent("1");
  });

  it("revokePermissionGrant removes a grant by pending_action_id", async () => {
    render(
      <ThreadProvider>
        <PermissionConsumer />
      </ThreadProvider>,
    );

    // Add then revoke
    await act(async () => {
      await userEvent.click(screen.getByTestId("add-grant"));
    });
    expect(screen.getByTestId("grants-count")).toHaveTextContent("1");

    await act(async () => {
      await userEvent.click(screen.getByTestId("revoke-grant"));
    });
    expect(screen.getByTestId("grants-count")).toHaveTextContent("0");
  });

  it("clearPermissionGrants removes all grants", async () => {
    render(
      <ThreadProvider>
        <PermissionConsumer />
      </ThreadProvider>,
    );

    // Add a grant
    await act(async () => {
      await userEvent.click(screen.getByTestId("add-grant"));
    });
    expect(screen.getByTestId("grants-count")).toHaveTextContent("1");

    // Clear all
    await act(async () => {
      await userEvent.click(screen.getByTestId("clear-grants"));
    });
    expect(screen.getByTestId("grants-count")).toHaveTextContent("0");
  });
});
