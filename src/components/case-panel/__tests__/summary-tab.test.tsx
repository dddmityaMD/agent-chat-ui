/**
 * Tests for SummaryTab component.
 *
 * Phase 19 - TEST-04: Frontend component test coverage.
 * Updated Phase 23.3 - Evidence Status moved to Investigation tab.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SummaryTab } from "../summary-tab";

// Mock ReadinessPanel (complex component with its own tests)
jest.mock("@/components/readiness/ReadinessPanel", () => ({
  ReadinessPanel: () => <div data-testid="readiness-panel">Readiness</div>,
}));

// Mock ContextPanelSection
jest.mock("@/components/context-panel", () => ({
  ContextPanelSection: () => <div data-testid="context-panel">Context</div>,
}));

// Mock sonner
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

// Mock uuid
jest.mock("uuid", () => ({
  v4: () => "mock-uuid",
}));

// Mock clipboard
Object.assign(navigator, {
  clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
});

const defaultProps = {
  threadId: "thread-1",
  summary: null,
  loading: false,
  error: null,
  permissionState: { grants: [] },
  revokePermissionGrant: jest.fn(),
  stream: { messages: [], submit: jest.fn() },
};

describe("SummaryTab", () => {
  it("renders thread ID when provided", () => {
    render(<SummaryTab {...defaultProps} />);
    expect(screen.getByTestId("thread-id-display")).toBeInTheDocument();
    expect(screen.getByText("thread-1")).toBeInTheDocument();
  });

  it("renders 'no thread selected' when threadId is null", () => {
    render(<SummaryTab {...defaultProps} threadId={null} />);
    expect(screen.getByText("(no thread selected)")).toBeInTheDocument();
  });

  it("renders loading indicator when loading", () => {
    render(<SummaryTab {...defaultProps} loading={true} />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders error message when error is set", () => {
    render(<SummaryTab {...defaultProps} error="Something went wrong" />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("does not render sections when summary is null", () => {
    render(<SummaryTab {...defaultProps} summary={null} />);
    expect(screen.queryByTestId("readiness-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("permissions-section")).not.toBeInTheDocument();
  });

  it("does not render Evidence Status (moved to Investigation tab)", () => {
    const summary = {
      thread: {
        thread_id: "thread-1",
        workspace_id: null,
        title: "Test",
        is_pinned: false,
        is_archived: false,
        created_at: "2026-01-01T00:00:00Z",
        last_activity_at: "2026-01-01T00:00:00Z",
        last_message_preview: null,
      },
    };
    render(<SummaryTab {...defaultProps} summary={summary as any} />);
    expect(screen.queryByText("Evidence Status")).not.toBeInTheDocument();
  });

  it("renders sections when summary is provided", () => {
    const summary = {
      thread: {
        thread_id: "thread-1",
        workspace_id: null,
        title: "Test",
        is_pinned: false,
        is_archived: false,
        created_at: "2026-01-01T00:00:00Z",
        last_activity_at: "2026-01-01T00:00:00Z",
        last_message_preview: null,
      },
    };
    render(<SummaryTab {...defaultProps} summary={summary as any} />);
    expect(screen.getByTestId("readiness-panel")).toBeInTheDocument();
    expect(screen.getByTestId("permissions-section")).toBeInTheDocument();
  });

  it("renders archived badge when thread is archived", () => {
    const summary = {
      thread: {
        thread_id: "thread-1",
        workspace_id: null,
        title: "Test",
        is_pinned: false,
        is_archived: true,
        created_at: "2026-01-01T00:00:00Z",
        last_activity_at: "2026-01-01T00:00:00Z",
        last_message_preview: null,
      },
    };
    render(<SummaryTab {...defaultProps} summary={summary as any} />);
    expect(screen.getByTestId("thread-archived-badge")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });

  it("renders 'No active grants' when permissions empty", () => {
    const summary = {
      thread: {
        thread_id: "thread-1",
        workspace_id: null,
        title: "Test",
        is_pinned: false,
        is_archived: false,
        created_at: "2026-01-01T00:00:00Z",
        last_activity_at: "2026-01-01T00:00:00Z",
        last_message_preview: null,
      },
    };
    render(<SummaryTab {...defaultProps} summary={summary as any} />);
    expect(screen.getByText("No active grants")).toBeInTheDocument();
  });

  it("renders permission grants when present", () => {
    const summary = {
      thread: {
        thread_id: "thread-1",
        workspace_id: null,
        title: "Test",
        is_pinned: false,
        is_archived: false,
        created_at: "2026-01-01T00:00:00Z",
        last_activity_at: "2026-01-01T00:00:00Z",
        last_message_preview: null,
      },
    };
    const permissionState = {
      grants: [
        {
          capability: "write",
          scope: "once",
          granted_at: "2026-01-01T00:00:00Z",
          expires_at: null,
          reason: "Test reason",
          pending_action_id: "pa-1",
        },
      ],
    };
    render(
      <SummaryTab
        {...defaultProps}
        summary={summary as any}
        permissionState={permissionState}
      />,
    );
    expect(screen.getByText("WRITE (once)")).toBeInTheDocument();
    expect(screen.getByText("Reason: Test reason")).toBeInTheDocument();
    expect(screen.getByText("Revoke")).toBeInTheDocument();
  });
});
