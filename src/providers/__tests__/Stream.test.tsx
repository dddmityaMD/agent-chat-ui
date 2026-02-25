/**
 * Tests for StreamProvider and useStreamContext hook.
 *
 * Phase 19 - TEST-04: Frontend component test coverage.
 * Updated: Mocks useSaisStream (custom hook) instead of SDK useStream.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// ---------------------------------------------------------------------------
// Mocks (must be before imports)
// ---------------------------------------------------------------------------

const mockStreamValue = {
  messages: [],
  values: { messages: [], sais_ui: undefined },
  submit: jest.fn(),
  stop: jest.fn(),
  interrupt: undefined,
  isLoading: false,
  error: null,
  getMessagesMetadata: jest.fn(),
  preStreamIds: new Set<string>(),
};

jest.mock("@/hooks/useSaisStream", () => ({
  useSaisStream: jest.fn(() => mockStreamValue),
}));

jest.mock("@langchain/langgraph-sdk/react-ui", () => ({
  uiMessageReducer: jest.fn((prev: unknown[]) => prev),
  isUIMessage: jest.fn(() => false),
  isRemoveUIMessage: jest.fn(() => false),
}));

// Mock nuqs useQueryState
jest.mock("nuqs", () => ({
  useQueryState: jest.fn((key: string, opts?: { defaultValue?: string }) => {
    if (key === "apiUrl") return ["http://localhost:2024", jest.fn()];
    if (key === "assistantId") return ["agent", jest.fn()];
    if (key === "threadId") return [null, jest.fn()];
    return [opts?.defaultValue ?? null, jest.fn()];
  }),
}));

// Mock Thread provider
jest.mock("../Thread", () => ({
  useThreads: () => ({
    getThreads: jest.fn(async () => []),
    setThreads: jest.fn(),
    registerThread: jest.fn(async () => null),
  }),
}));

// Mock Auth provider
jest.mock("../Auth", () => ({
  useAuth: () => ({
    setSessionExpired: jest.fn(),
  }),
}));

// Mock sonner toast
jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    warning: jest.fn(),
    success: jest.fn(),
  },
}));

// Mock getApiKey
jest.mock("@/lib/api-key", () => ({
  getApiKey: () => null,
}));

// Mock env vars for StreamProvider config form bypass
const originalEnv = process.env;
beforeAll(() => {
  process.env = {
    ...originalEnv,
    NEXT_PUBLIC_API_URL: "http://localhost:2024",
    NEXT_PUBLIC_ASSISTANT_ID: "agent",
  };
});
afterAll(() => {
  process.env = originalEnv;
});

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { StreamProvider, useStreamContext } from "../Stream";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function StreamConsumer() {
  const stream = useStreamContext();
  return (
    <div>
      <div data-testid="has-submit">{typeof stream.submit === "function" ? "yes" : "no"}</div>
      <div data-testid="is-loading">{stream.isLoading ? "true" : "false"}</div>
      <div data-testid="messages-count">{stream.messages.length}</div>
      <div data-testid="has-values">{stream.values ? "yes" : "no"}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StreamProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock global.fetch for checkGraphStatus
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("provides stream context to children", () => {
    render(
      <StreamProvider>
        <StreamConsumer />
      </StreamProvider>,
    );

    expect(screen.getByTestId("has-submit")).toHaveTextContent("yes");
    expect(screen.getByTestId("is-loading")).toHaveTextContent("false");
    expect(screen.getByTestId("messages-count")).toHaveTextContent("0");
    expect(screen.getByTestId("has-values")).toHaveTextContent("yes");
  });

  it("provides submit function", () => {
    render(
      <StreamProvider>
        <StreamConsumer />
      </StreamProvider>,
    );

    expect(screen.getByTestId("has-submit")).toHaveTextContent("yes");
  });

  it("provides loading state", () => {
    render(
      <StreamProvider>
        <StreamConsumer />
      </StreamProvider>,
    );

    expect(screen.getByTestId("is-loading")).toHaveTextContent("false");
  });
});

describe("useStreamContext outside provider", () => {
  it("throws error when used outside StreamProvider", () => {
    function BadConsumer() {
      useStreamContext();
      return null;
    }

    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<BadConsumer />)).toThrow(
      "useStreamContext must be used within a StreamProvider",
    );
    spy.mockRestore();
  });
});
