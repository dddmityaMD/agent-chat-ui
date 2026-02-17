/**
 * Tests for AssistantMessage and related components.
 *
 * Phase 19 - TEST-04: Frontend component test coverage.
 *
 * Strategy: Test AssistantMessage rendering behaviors with heavily mocked
 * dependencies. Focus on: content rendering, isLastMessage branching
 * (LastMessageDecorations vs HistoricalMessageContent), and React.memo behavior.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// ---------------------------------------------------------------------------
// Mocks (before imports)
// ---------------------------------------------------------------------------

// Mock Stream provider
const mockStreamContext = {
  messages: [] as Array<{ id: string; type: string }>,
  values: { messages: [], sais_ui: undefined },
  submit: jest.fn(),
  stop: jest.fn(),
  interrupt: undefined,
  isLoading: false,
  error: undefined,
  getMessagesMetadata: jest.fn(() => undefined),
  setBranch: jest.fn(),
  next: jest.fn(),
};

jest.mock("@/providers/Stream", () => ({
  useStreamContext: jest.fn(() => mockStreamContext),
}));

// Mock useSaisUi hook
const mockSaisUiResult = {
  raw: null,
  flowType: null,
  caseStatus: null,
  hasBlockers: false,
  blockers: [],
  isInvestigating: false,
  hasEvidence: false,
  evidence: [],
  findings: null,
  isCatalog: false,
  metadataResults: [],
  disambiguation: null,
  remediationProposals: [],
  isBuild: false,
  hasBuildPlan: false,
  buildPlanStatus: null,
  buildVerificationResult: null,
  handoff: null,
  resolutionSteps: null,
  confidence: null,
  multiIntent: null,
  permissions: null,
  hasPermissionGrants: false,
  permissionGrants: [],
};

jest.mock("@/hooks/useSaisUi", () => ({
  useSaisUi: jest.fn(() => mockSaisUiResult),
  extractFlowType: jest.fn(() => null),
  extractHandoffProposal: jest.fn(() => null),
  extractRemediationProposals: jest.fn(() => []),
  extractBlockers: jest.fn(() => []),
  extractConfidence: jest.fn(() => null),
  extractMultiIntent: jest.fn(() => null),
  extractBuildPlan: jest.fn(() => null),
  extractBuildPlanStatus: jest.fn(() => null),
  extractBuildVerification: jest.fn(() => null),
}));

// Mock Thread provider
jest.mock("@/providers/Thread", () => ({
  usePermissionState: () => ({
    permissionState: { grants: [] },
    addPermissionGrant: jest.fn(),
    revokePermissionGrant: jest.fn(),
    clearPermissionGrants: jest.fn(),
  }),
}));

// Mock nuqs
jest.mock("nuqs", () => ({
  useQueryState: jest.fn(() => [false, jest.fn()]),
  parseAsBoolean: { withDefault: jest.fn(() => ({ defaultValue: false })) },
}));

// Mock LangChain core
jest.mock("@langchain/core/output_parsers", () => ({
  parsePartialJson: jest.fn(() => ({})),
}));

// Mock child components to isolate AssistantMessage behavior
jest.mock("@/components/thread/messages/shared", () => ({
  BranchSwitcher: () => <div data-testid="branch-switcher" />,
  CommandBar: () => <div data-testid="command-bar" />,
}));

jest.mock("@/components/thread/markdown-text", () => ({
  MarkdownText: ({ children }: { children: string }) => (
    <div data-testid="markdown-text">{children}</div>
  ),
}));

jest.mock("@langchain/langgraph-sdk/react-ui", () => ({
  LoadExternalComponent: () => null,
}));

jest.mock("@/components/thread/agent-inbox", () => ({
  ThreadView: () => null,
}));

jest.mock("@/components/thread/messages/generic-interrupt", () => ({
  GenericInterruptView: () => null,
}));

jest.mock("@/components/thread/artifact", () => ({
  useArtifact: () => ({}),
}));

jest.mock("@/components/query", () => ({
  QueryResults: () => null,
}));

jest.mock("@/components/flow-indicator/FlowBadge", () => ({
  FlowBadge: ({ flowType }: { flowType: string }) => (
    <div data-testid="flow-badge">{flowType}</div>
  ),
}));

jest.mock("@/components/remediation/BatchReview", () => ({
  BatchReview: () => null,
}));

jest.mock("@/components/thread/blocker-message", () => ({
  BlockerMessage: () => null,
}));

jest.mock("@/components/thread/multi-intent-result", () => ({
  MultiIntentResult: () => null,
}));

jest.mock("@/components/thread/confidence-badge", () => ({
  ConfidenceBadge: () => <div data-testid="confidence-badge" />,
}));

jest.mock("@/lib/agent-inbox-interrupt", () => ({
  isAgentInboxInterruptSchema: () => false,
}));

jest.mock("@/components/thread/clarification-card", () => ({
  ClarificationCard: () => null,
  getClarification: () => null,
}));

jest.mock("@/components/thread/disambiguation-card", () => ({
  DisambiguationCard: () => null,
  getPendingDisambiguation: () => null,
}));

jest.mock("@/components/thread/messages/build-plan", () => ({
  BuildPlanDisplay: () => null,
}));

jest.mock("@/components/thread/messages/verification-badge", () => ({
  VerificationBadge: () => null,
}));

jest.mock("@/components/lineage-link", () => ({
  ViewInLineageButton: () => <div data-testid="lineage-button" />,
}));

jest.mock("@/components/thread/messages/tool-calls", () => ({
  ToolCalls: () => <div data-testid="tool-calls" />,
  ToolResult: () => <div data-testid="tool-result" />,
}));

jest.mock("@/components/thread/utils", () => ({
  getContentString: (content: unknown) => {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .filter((c: Record<string, unknown>) => c.type === "text")
        .map((c: Record<string, unknown>) => c.text)
        .join("");
    }
    return "";
  },
}));

jest.mock("@/lib/api-url", () => ({
  getApiBaseUrl: () => "http://localhost:8000",
}));

jest.mock("uuid", () => ({
  v4: () => "mock-uuid",
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { AssistantMessage, AssistantMessageLoading } from "../ai";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AssistantMessage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStreamContext.messages = [];
    mockStreamContext.isLoading = false;
  });

  it("renders message content for a non-last message (HistoricalMessageContent)", () => {
    const message = {
      id: "msg-1",
      type: "ai" as const,
      content: [{ type: "text", text: "Hello world" }],
    };
    // Not the last message (no messages in stream context)
    mockStreamContext.messages = [message, { id: "msg-2", type: "ai" }];

    render(
      <AssistantMessage
        message={message as any}
        isLoading={false}
        handleRegenerate={jest.fn()}
      />,
    );

    expect(screen.getByTestId("ai-message")).toBeInTheDocument();
    expect(screen.getByTestId("ai-message-content")).toBeInTheDocument();
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders LastMessageDecorations for the last message", () => {
    const message = {
      id: "msg-1",
      type: "ai" as const,
      content: [{ type: "text", text: "Last message" }],
    };
    mockStreamContext.messages = [message];

    render(
      <AssistantMessage
        message={message as any}
        isLoading={false}
        handleRegenerate={jest.fn()}
      />,
    );

    expect(screen.getByTestId("ai-message")).toBeInTheDocument();
    // Last message should render through LastMessageDecorations
    expect(screen.getByText("Last message")).toBeInTheDocument();
  });

  it("renders confidence badge", () => {
    const message = {
      id: "msg-1",
      type: "ai" as const,
      content: [{ type: "text", text: "Some text" }],
    };
    mockStreamContext.messages = [message];

    render(
      <AssistantMessage
        message={message as any}
        isLoading={false}
        handleRegenerate={jest.fn()}
      />,
    );

    expect(screen.getByTestId("confidence-badge")).toBeInTheDocument();
  });

  it("renders lineage button", () => {
    const message = {
      id: "msg-1",
      type: "ai" as const,
      content: [{ type: "text", text: "Some text" }],
    };
    mockStreamContext.messages = [message];

    render(
      <AssistantMessage
        message={message as any}
        isLoading={false}
        handleRegenerate={jest.fn()}
      />,
    );

    expect(screen.getByTestId("lineage-button")).toBeInTheDocument();
  });

  it("renders branch switcher and command bar", () => {
    const message = {
      id: "msg-1",
      type: "ai" as const,
      content: [{ type: "text", text: "Some text" }],
    };
    mockStreamContext.messages = [message];

    render(
      <AssistantMessage
        message={message as any}
        isLoading={false}
        handleRegenerate={jest.fn()}
      />,
    );

    expect(screen.getByTestId("branch-switcher")).toBeInTheDocument();
    expect(screen.getByTestId("command-bar")).toBeInTheDocument();
  });

  it("renders tool result for tool messages", () => {
    const message = {
      id: "msg-t1",
      type: "tool" as const,
      content: "tool output",
    };
    mockStreamContext.messages = [message];

    render(
      <AssistantMessage
        message={message as any}
        isLoading={false}
        handleRegenerate={jest.fn()}
      />,
    );

    expect(screen.getByTestId("tool-result")).toBeInTheDocument();
  });
});

describe("AssistantMessageLoading", () => {
  it("renders loading animation", () => {
    const { container } = render(<AssistantMessageLoading />);
    // Check for the pulsing dots
    const dots = container.querySelectorAll("[class*='animate-']");
    expect(dots.length).toBeGreaterThanOrEqual(3);
  });
});
