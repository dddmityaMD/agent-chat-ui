/**
 * Tests for ReadinessPanel component
 *
 * Phase 4 - EVID-05: Readiness panel with traffic lights
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ReadinessPanel } from "../ReadinessPanel";
import type {
  ConnectorStatus,
  ReadinessStatus,
} from "@/hooks/useConnectorStatus";

// Mock the useConnectorStatus hooks
const mockRefresh = jest.fn().mockResolvedValue(undefined);
const mockUseReadinessPolling = jest.fn();
const mockUseParallelExecution = jest.fn();

const mockUseSetupStatus = jest.fn();

jest.mock("@/hooks/useConnectorStatus", () => ({
  useReadinessPolling: (options: unknown) => mockUseReadinessPolling(options),
  useParallelExecution: (options: unknown) => mockUseParallelExecution(options),
  getStatusColorClass: (status: string) => {
    const colors: Record<string, string> = {
      healthy: "bg-green-500",
      degraded: "bg-yellow-500",
      unhealthy: "bg-red-500",
      unknown: "bg-gray-400",
    };
    return colors[status] || colors.unknown;
  },
  formatLastFetch: (dateString: string | null) =>
    dateString ? "2 minutes ago" : "Never",
}));

jest.mock("@/hooks/useSetupStatus", () => ({
  useSetupStatus: (...args: unknown[]) => mockUseSetupStatus(...args),
}));

// Mock ConnectorStatusCard
jest.mock("../ConnectorStatusCard", () => ({
  ConnectorStatusCard: ({
    connector,
    expanded,
    onToggle,
    onRefresh,
    isRefreshing,
  }: {
    connector: ConnectorStatus;
    expanded: boolean;
    onToggle: () => void;
    onRefresh: (name: string) => void;
    isRefreshing: boolean;
  }) => (
    <div data-testid={`connector-${connector.name}`}>
      <span data-testid={`status-${connector.name}`}>{connector.status}</span>
      <span>{connector.name}</span>
      <button onClick={onToggle}>Toggle</button>
      <button onClick={() => onRefresh(connector.name)} disabled={isRefreshing}>
        Refresh
      </button>
    </div>
  ),
}));

const createMockConnector = (
  name: string,
  status: ReadinessStatus = "healthy"
): ConnectorStatus => ({
  connector_id: `conn-${name}`,
  name,
  type: "metabase",
  status,
  server_url: `https://${name}.example.com`,
  hostname: `${name}.example.com`,
  last_successful_fetch: "2024-01-15T10:30:00Z",
  last_check_at: "2024-01-15T10:30:00Z",
  last_sync_at: "2024-01-15T10:00:00Z",
  response_time_ms: 150,
  error_message: null,
  capabilities: ["fetch_cards", "fetch_dashboards"],
  entity_count: 47,
});

describe("ReadinessPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock return values
    mockUseReadinessPolling.mockReturnValue({
      connectors: [
        createMockConnector("metabase"),
        createMockConnector("postgres"),
      ],
      overallStatus: "healthy",
      statusSummary: "All systems operational",
      checkedAt: "2024-01-15T10:30:00Z",
      isLoading: false,
      error: null,
      refresh: mockRefresh,
    });

    mockUseParallelExecution.mockReturnValue({
      jobs: [],
      isExecuting: false,
    });

    mockUseSetupStatus.mockReturnValue({
      data: { has_connectors: true, is_ready: true },
      loading: false,
      error: null,
    });
  });

  describe("Rendering", () => {
    it("renders the panel with title", () => {
      render(<ReadinessPanel />);
      expect(screen.getByText("System Readiness")).toBeInTheDocument();
    });

    it("renders connector status cards", () => {
      render(<ReadinessPanel />);
      expect(screen.getByTestId("connector-metabase")).toBeInTheDocument();
      expect(screen.getByTestId("connector-postgres")).toBeInTheDocument();
    });

    it("renders overall status summary", () => {
      render(<ReadinessPanel />);
      expect(screen.getByText("All systems operational")).toBeInTheDocument();
    });

    it("renders last checked timestamp", () => {
      render(<ReadinessPanel />);
      expect(screen.getByText(/Last checked:/)).toBeInTheDocument();
    });
  });

  describe("Traffic light status indicator", () => {
    it("shows green indicator when all healthy", () => {
      mockUseReadinessPolling.mockReturnValue({
        connectors: [createMockConnector("test", "healthy")],
        overallStatus: "healthy",
        statusSummary: "All systems operational",
        checkedAt: "2024-01-15T10:30:00Z",
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      render(<ReadinessPanel />);
      const indicator = screen.getByTitle("Overall: healthy");
      expect(indicator).toHaveClass("bg-green-500");
    });

    it("shows yellow indicator when degraded", () => {
      mockUseReadinessPolling.mockReturnValue({
        connectors: [createMockConnector("test", "degraded")],
        overallStatus: "degraded",
        statusSummary: "Some systems degraded",
        checkedAt: "2024-01-15T10:30:00Z",
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      render(<ReadinessPanel />);
      const indicator = screen.getByTitle("Overall: degraded");
      expect(indicator).toHaveClass("bg-yellow-500");
    });

    it("shows red indicator when unhealthy", () => {
      mockUseReadinessPolling.mockReturnValue({
        connectors: [createMockConnector("test", "unhealthy")],
        overallStatus: "unhealthy",
        statusSummary: "Systems down",
        checkedAt: "2024-01-15T10:30:00Z",
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      render(<ReadinessPanel />);
      const indicator = screen.getByTitle("Overall: unhealthy");
      expect(indicator).toHaveClass("bg-red-500");
    });

    it("shows gray indicator when unknown", () => {
      mockUseReadinessPolling.mockReturnValue({
        connectors: [],
        overallStatus: "unknown",
        statusSummary: "Status unknown",
        checkedAt: null,
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      render(<ReadinessPanel />);
      const indicator = screen.getByTitle("Overall: unknown");
      expect(indicator).toHaveClass("bg-gray-400");
    });
  });

  describe("Issue counts", () => {
    it("displays unhealthy count", () => {
      mockUseReadinessPolling.mockReturnValue({
        connectors: [
          createMockConnector("test1", "unhealthy"),
          createMockConnector("test2", "unhealthy"),
        ],
        overallStatus: "unhealthy",
        statusSummary: "Issues detected",
        checkedAt: "2024-01-15T10:30:00Z",
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      render(<ReadinessPanel />);
      expect(screen.getByText(/2 down/)).toBeInTheDocument();
    });

    it("displays degraded count", () => {
      mockUseReadinessPolling.mockReturnValue({
        connectors: [createMockConnector("test", "degraded")],
        overallStatus: "degraded",
        statusSummary: "Issues detected",
        checkedAt: "2024-01-15T10:30:00Z",
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      render(<ReadinessPanel />);
      expect(screen.getByText(/1 degraded/)).toBeInTheDocument();
    });
  });

  describe("Refresh functionality", () => {
    it("calls refresh when refresh button clicked", async () => {
      render(<ReadinessPanel />);
      const refreshButton = screen.getByTitle("Refresh status");
      fireEvent.click(refreshButton);
      expect(mockRefresh).toHaveBeenCalled();
    });

    it("disables refresh button when loading", () => {
      mockUseReadinessPolling.mockReturnValue({
        connectors: [],
        overallStatus: "unknown",
        statusSummary: "Loading",
        checkedAt: null,
        isLoading: true,
        error: null,
        refresh: mockRefresh,
      });

      render(<ReadinessPanel />);
      const refreshButton = screen.getByTitle("Refresh status");
      expect(refreshButton).toBeDisabled();
    });
  });

  describe("Collapse functionality", () => {
    it("collapses when collapse button clicked", () => {
      render(<ReadinessPanel />);

      // Initially expanded - connectors should be visible
      expect(screen.getByTestId("connector-metabase")).toBeInTheDocument();

      // Click collapse
      const collapseButton = screen.getByTitle("Collapse");
      fireEvent.click(collapseButton);

      // After collapse - connectors should not be visible
      expect(screen.queryByTestId("connector-metabase")).not.toBeInTheDocument();
    });

    it("expands when expand button clicked", () => {
      render(<ReadinessPanel />);

      // Collapse first
      const collapseButton = screen.getByTitle("Collapse");
      fireEvent.click(collapseButton);

      // Verify collapsed
      expect(screen.queryByTestId("connector-metabase")).not.toBeInTheDocument();

      // Expand
      const expandButton = screen.getByTitle("Expand");
      fireEvent.click(expandButton);

      // Verify expanded
      expect(screen.getByTestId("connector-metabase")).toBeInTheDocument();
    });
  });

  describe("Empty state", () => {
    it("shows message when no connectors configured", () => {
      mockUseReadinessPolling.mockReturnValue({
        connectors: [],
        overallStatus: "unknown",
        statusSummary: "No connectors",
        checkedAt: null,
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });
      mockUseSetupStatus.mockReturnValue({
        data: { has_connectors: false, is_ready: false },
        loading: false,
        error: null,
      });

      render(<ReadinessPanel />);
      expect(screen.getByText("No data sources connected")).toBeInTheDocument();
    });

    it("shows loading message when loading with no connectors", () => {
      mockUseReadinessPolling.mockReturnValue({
        connectors: [],
        overallStatus: "unknown",
        statusSummary: "Loading",
        checkedAt: null,
        isLoading: true,
        error: null,
        refresh: mockRefresh,
      });

      render(<ReadinessPanel />);
      expect(screen.getByText("Loading connectors...")).toBeInTheDocument();
    });
  });

  describe("Error handling", () => {
    it("displays error message when error occurs", () => {
      mockUseReadinessPolling.mockReturnValue({
        connectors: [],
        overallStatus: "unknown",
        statusSummary: "Error",
        checkedAt: null,
        isLoading: false,
        error: new Error("Failed to fetch status"),
        refresh: mockRefresh,
      });

      render(<ReadinessPanel />);
      expect(screen.getByText("Failed to fetch status")).toBeInTheDocument();
    });
  });

  describe("Parallel execution", () => {
    it("shows parallel execution section when enabled and executing", () => {
      mockUseParallelExecution.mockReturnValue({
        jobs: [
          { id: "1", source: "SQL", status: "in_progress" },
          { id: "2", source: "Git", status: "pending" },
        ],
        isExecuting: true,
      });

      render(<ReadinessPanel showParallelExecution />);
      expect(screen.getByText("Collecting evidence...")).toBeInTheDocument();
      expect(screen.getByText("SQL")).toBeInTheDocument();
      expect(screen.getByText("Git")).toBeInTheDocument();
    });

    it("hides parallel execution section when not executing", () => {
      mockUseParallelExecution.mockReturnValue({
        jobs: [],
        isExecuting: false,
      });

      render(<ReadinessPanel showParallelExecution />);
      expect(screen.queryByText("Collecting evidence...")).not.toBeInTheDocument();
    });

    it("uses external parallelJobs when provided", () => {
      render(
        <ReadinessPanel
          showParallelExecution
          parallelJobs={[{ id: "ext-1", source: "External", status: "done" }]}
        />
      );
      expect(screen.getByText("Collecting evidence...")).toBeInTheDocument();
      expect(screen.getByText("External")).toBeInTheDocument();
    });
  });

  describe("Polling configuration", () => {
    it("passes polling interval to hook", () => {
      render(<ReadinessPanel pollingInterval={60000} />);
      expect(mockUseReadinessPolling).toHaveBeenCalledWith(
        expect.objectContaining({ interval: 60000 })
      );
    });

    it("passes enabled flag to hook", () => {
      render(<ReadinessPanel enabled={false} />);
      expect(mockUseReadinessPolling).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false })
      );
    });
  });

  describe("Accessibility", () => {
    it("has data-testid attribute", () => {
      render(<ReadinessPanel />);
      expect(screen.getByTestId("readiness-panel")).toBeInTheDocument();
    });

    it("has proper button titles", () => {
      render(<ReadinessPanel />);
      expect(screen.getByTitle("Refresh status")).toBeInTheDocument();
      expect(screen.getByTitle("Collapse")).toBeInTheDocument();
    });
  });
});
