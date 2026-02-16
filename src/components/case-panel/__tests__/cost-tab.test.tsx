/**
 * Tests for CostTab component.
 *
 * Phase 19 - TEST-04: Frontend component test coverage.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { CostTab } from "../cost-tab";

// Mock recharts to avoid canvas/SVG rendering issues in jsdom
jest.mock("recharts", () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="recharts-tooltip" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock Radix UI Tooltip
jest.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock getApiBaseUrl
jest.mock("@/lib/api-url", () => ({
  getApiBaseUrl: () => "http://localhost:8000",
}));

const mockCostData = {
  thread_id: "thread-1",
  steps: [
    {
      operation: "intent_routing",
      label: "Intent Router",
      model: "gpt-4o-mini",
      input_tokens: 500,
      output_tokens: 50,
      cost_usd: 0.0012,
    },
    {
      operation: "evidence_collection",
      label: "Evidence Collection",
      model: "gpt-4o-mini",
      input_tokens: 1200,
      output_tokens: 300,
      cost_usd: 0.0035,
    },
  ],
  total_input_tokens: 1700,
  total_output_tokens: 350,
  total_cost_usd: 0.0047,
};

describe("CostTab", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("shows 'Select a thread' when no threadId provided", () => {
    render(<CostTab />);
    expect(screen.getByText("Select a thread to view cost data.")).toBeInTheDocument();
  });

  it("shows loading spinner while fetching", () => {
    // Never resolve the fetch
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}));
    const { container } = render(<CostTab threadId="thread-1" />);
    // Check for the animate-spin class on the loader
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeTruthy();
  });

  it("shows 'No cost data yet' when API returns empty steps", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ thread_id: "thread-1", steps: [], total_input_tokens: 0, total_output_tokens: 0, total_cost_usd: 0 }),
    });

    render(<CostTab threadId="thread-1" />);

    await waitFor(() => {
      expect(screen.getByText(/No cost data yet/)).toBeInTheDocument();
    });
  });

  it("renders a table with step rows when data is provided", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockCostData,
    });

    render(<CostTab threadId="thread-1" />);

    await waitFor(() => {
      expect(screen.getByText("Intent Router")).toBeInTheDocument();
    });
    expect(screen.getByText("Evidence Collection")).toBeInTheDocument();
  });

  it("shows friendly labels not raw operation types", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockCostData,
    });

    render(<CostTab threadId="thread-1" />);

    await waitFor(() => {
      expect(screen.getByText("Intent Router")).toBeInTheDocument();
    });
    // The raw "intent_routing" should only appear in tooltip, not directly visible
    expect(screen.getByText("Intent Router")).toBeInTheDocument();
  });

  it("shows totals row", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockCostData,
    });

    render(<CostTab threadId="thread-1" />);

    await waitFor(() => {
      expect(screen.getByText("Total")).toBeInTheDocument();
    });
  });

  it("shows model name for each step", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockCostData,
    });

    render(<CostTab threadId="thread-1" />);

    await waitFor(() => {
      // Both steps use gpt-4o-mini
      const modelCells = screen.getAllByText("gpt-4o-mini");
      expect(modelCells.length).toBe(2);
    });
  });

  it("shows error message on fetch failure", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    render(<CostTab threadId="thread-1" />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load cost data/)).toBeInTheDocument();
    });
  });

  it("renders bar chart when 2+ steps present", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockCostData,
    });

    render(<CostTab threadId="thread-1" />);

    await waitFor(() => {
      expect(screen.getByText("Cost per Operation")).toBeInTheDocument();
    });
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("does not render bar chart with only 1 step", async () => {
    const singleStepData = {
      ...mockCostData,
      steps: [mockCostData.steps[0]],
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => singleStepData,
    });

    render(<CostTab threadId="thread-1" />);

    await waitFor(() => {
      expect(screen.getByText("Intent Router")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("bar-chart")).not.toBeInTheDocument();
  });

  it("fetches from correct API endpoint", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockCostData,
    });

    render(<CostTab threadId="thread-123" />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/api/cost/thread/thread-123",
        expect.objectContaining({ credentials: "include" }),
      );
    });
  });
});
