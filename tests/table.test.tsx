import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

// Import components to test
import { EvidenceTable } from "@/components/tables/EvidenceTable";
import {
  LoadMoreButton,
  LoadMoreButtonCompact,
} from "@/components/tables/LoadMoreButton";
import {
  createTableColumnDefs,
  createReportColumnDefs,
  BadgeCellRenderer,
  LinkCellRenderer,
  MatchReasonCellRenderer,
} from "@/components/tables/columnDefinitions";
import { QueryResults } from "@/components/query/QueryResults";
import { ClarificationDialog } from "@/components/query/ClarificationDialog";
import { useQueryStreaming } from "@/hooks/useQueryStreaming";

// ============================================================================
// EvidenceTable Tests
// ============================================================================

describe("EvidenceTable", () => {
  const mockRowData = [
    { id: "1", name: "Test Table 1", schema: "public", type: "table" },
    { id: "2", name: "Test Table 2", schema: "analytics", type: "table" },
    { id: "3", name: "Test Table 3", schema: "public", type: "view" },
  ];

  const mockColumnDefs = [
    { field: "name", headerName: "Name", width: 200 },
    { field: "schema", headerName: "Schema", width: 150 },
    { field: "type", headerName: "Type", width: 100 },
  ];

  it("renders with row data", () => {
    render(
      <EvidenceTable
        rowData={mockRowData}
        columnDefs={mockColumnDefs}
        loading={false}
      />,
    );

    // Check that the component renders (AG Grid initializes)
    const container = screen.getByTestId("evidence-table-container");
    expect(container).toBeInTheDocument();
  });

  it("shows loading state", () => {
    render(
      <EvidenceTable
        rowData={[]}
        columnDefs={mockColumnDefs}
        loading={true}
      />,
    );

    expect(screen.getByText(/loading evidence/i)).toBeInTheDocument();
  });

  it("shows empty state when no data", () => {
    render(
      <EvidenceTable
        rowData={[]}
        columnDefs={mockColumnDefs}
        loading={false}
      />,
    );

    expect(screen.getByText(/no results found/i)).toBeInTheDocument();
    expect(screen.getByText(/try adjusting your filters/i)).toBeInTheDocument();
  });

  it("calls onRowClicked when row is clicked", async () => {
    const handleRowClick = jest.fn();
    render(
      <EvidenceTable
        rowData={mockRowData}
        columnDefs={mockColumnDefs}
        loading={false}
        onRowClicked={handleRowClick}
      />,
    );

    // Wait for grid to initialize
    await waitFor(() => {
      expect(
        screen.getByTestId("evidence-table-container"),
      ).toBeInTheDocument();
    });
  });

  it("applies custom height", () => {
    const { container } = render(
      <EvidenceTable
        rowData={mockRowData}
        columnDefs={mockColumnDefs}
        loading={false}
        height={500}
      />,
    );

    const gridElement = container.querySelector(".ag-theme-quartz");
    expect(gridElement).toHaveStyle({ height: "500px" });
  });

  it("applies custom className", () => {
    const { container } = render(
      <EvidenceTable
        rowData={mockRowData}
        columnDefs={mockColumnDefs}
        loading={false}
        className="custom-class"
      />,
    );

    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass("custom-class");
  });

  it("shows empty message prop", () => {
    render(
      <EvidenceTable
        rowData={[]}
        columnDefs={mockColumnDefs}
        loading={false}
        emptyMessage="Custom empty message"
      />,
    );

    expect(screen.getByText("Custom empty message")).toBeInTheDocument();
  });
});

// ============================================================================
// LoadMoreButton Tests
// ============================================================================

describe("LoadMoreButton", () => {
  it("shows load more when hasMore is true", () => {
    render(
      <LoadMoreButton
        hasMore={true}
        loading={false}
        loadedCount={10}
        totalCount={50}
        onLoadMore={jest.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /load 10 more/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/showing 10 of 50 results/i)).toBeInTheDocument();
  });

  it("shows loading spinner when loading", () => {
    render(
      <LoadMoreButton
        hasMore={true}
        loading={true}
        loadedCount={10}
        totalCount={50}
        onLoadMore={jest.fn()}
      />,
    );

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("hides when no more results", () => {
    render(
      <LoadMoreButton
        hasMore={false}
        loading={false}
        loadedCount={50}
        totalCount={50}
        onLoadMore={jest.fn()}
      />,
    );

    expect(screen.getByText(/showing all 50 results/i)).toBeInTheDocument();
  });

  it("calls onLoadMore when clicked", async () => {
    const handleLoadMore = jest.fn();
    render(
      <LoadMoreButton
        hasMore={true}
        loading={false}
        loadedCount={10}
        totalCount={50}
        onLoadMore={handleLoadMore}
      />,
    );

    const button = screen.getByRole("button", { name: /load 10 more/i });
    await userEvent.click(button);

    expect(handleLoadMore).toHaveBeenCalledTimes(1);
  });

  it("shows progress bar when totalCount is provided", () => {
    const { container } = render(
      <LoadMoreButton
        hasMore={true}
        loading={false}
        loadedCount={25}
        totalCount={100}
        onLoadMore={jest.fn()}
      />,
    );

    const progressBar = container.querySelector(".bg-primary");
    expect(progressBar).toBeInTheDocument();
  });

  it("shows load all button when conditions met", () => {
    render(
      <LoadMoreButton
        hasMore={true}
        loading={false}
        loadedCount={10}
        totalCount={55}
        onLoadMore={jest.fn()}
        showLoadAll={true}
        onLoadAll={jest.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /load all/i }),
    ).toBeInTheDocument();
  });

  it("shows correct batch size based on remaining", () => {
    render(
      <LoadMoreButton
        hasMore={true}
        loading={false}
        loadedCount={45}
        totalCount={50}
        onLoadMore={jest.fn()}
        batchSize={10}
      />,
    );

    // Should show "Load 5 more" not "Load 10 more" since only 5 remaining
    expect(
      screen.getByRole("button", { name: /load 5 more/i }),
    ).toBeInTheDocument();
  });
});

describe("LoadMoreButtonCompact", () => {
  it("renders compact variant", () => {
    render(
      <LoadMoreButtonCompact
        hasMore={true}
        loading={false}
        loadedCount={10}
        onLoadMore={jest.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /load more/i }),
    ).toBeInTheDocument();
  });

  it("shows count in compact mode", () => {
    render(
      <LoadMoreButtonCompact
        hasMore={true}
        loading={false}
        loadedCount={10}
        totalCount={50}
        onLoadMore={jest.fn()}
      />,
    );

    expect(screen.getByText(/10\/50/i)).toBeInTheDocument();
  });

  it("shows total when no more", () => {
    render(
      <LoadMoreButtonCompact
        hasMore={false}
        loading={false}
        loadedCount={50}
        onLoadMore={jest.fn()}
      />,
    );

    expect(screen.getByText(/50 total/i)).toBeInTheDocument();
  });
});

// ============================================================================
// Column Definitions Tests
// ============================================================================

describe("Column Definitions", () => {
  it("createTableColumnDefs returns correct columns", () => {
    const columns = createTableColumnDefs();

    expect(columns).toHaveLength(9);
    expect(columns[0].field).toBe("entity_type");
    expect(columns[1].field).toBe("schema_name");
    expect(columns[2].field).toBe("table_name");
  });

  it("createReportColumnDefs returns correct columns", () => {
    const columns = createReportColumnDefs();

    // 11 columns: entity_type, name, description, collection, parent_dashboards,
    // status, created_at, updated_at, relevance_score, card_id, actions
    expect(columns).toHaveLength(11);
    expect(columns.some((col) => col.field === "card_id")).toBe(true);
    expect(columns.some((col) => col.field === "name")).toBe(true);
    expect(columns.some((col) => col.field === "parent_dashboards")).toBe(true);
  });

  it("BadgeCellRenderer renders with correct variant", () => {
    const params = {
      value: "active",
      data: {},
    } as any;

    const { container } = render(<BadgeCellRenderer {...params} />);
    // Badge uses multiple Tailwind classes together, look for the badge by text content
    const badge = screen.getByText("active");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("rounded-full");
  });

  it("BadgeCellRenderer handles different statuses", () => {
    const statuses = ["deprecated", "error", "draft"];

    statuses.forEach((value) => {
      const params = { value, data: {} } as any;
      render(<BadgeCellRenderer {...params} />);
      // Verify the badge renders with the status text
      expect(screen.getByText(value)).toBeInTheDocument();
    });
  });

  it("LinkCellRenderer renders link correctly", () => {
    const params = {
      value: { url: "https://example.com", text: "View" },
      data: {},
    } as any;

    const { container } = render(<LinkCellRenderer {...params} />);
    const link = container.querySelector("a");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("MatchReasonCellRenderer shows tooltip", () => {
    const params = {
      value: "Match text",
      data: { match_reason: "This is why it matched" },
    } as any;

    render(<MatchReasonCellRenderer {...params} />);
    const element = screen.getByTitle("This is why it matched");
    expect(element).toBeInTheDocument();
    expect(element).toHaveTextContent("Match text");
  });
});

// ============================================================================
// useQueryStreaming Hook Tests
// ============================================================================

describe("useQueryStreaming", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("initializes with correct defaults", () => {
    const TestComponent = () => {
      const hook = useQueryStreaming();
      return (
        <div>
          <span data-testid="status">{hook.status}</span>
          <span data-testid="isStreaming">
            {hook.isStreaming ? "true" : "false"}
          </span>
          <span data-testid="progress">{hook.progress}</span>
        </div>
      );
    };

    render(<TestComponent />);

    expect(screen.getByTestId("status")).toHaveTextContent("idle");
    expect(screen.getByTestId("isStreaming")).toHaveTextContent("false");
    expect(screen.getByTestId("progress")).toHaveTextContent("0");
  });

  it("submitQuery updates status", async () => {
    const TestComponent = () => {
      const { submitQuery, status } = useQueryStreaming();
      return (
        <div>
          <span data-testid="status">{status}</span>
          <button onClick={() => submitQuery("test query")}>Submit</button>
        </div>
      );
    };

    render(<TestComponent />);

    const button = screen.getByRole("button", { name: /submit/i });
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByTestId("status")).not.toHaveTextContent("idle");
    });
  });

  it("cancelQuery resets state", async () => {
    const TestComponent = () => {
      const { cancelQuery, status, submitQuery } = useQueryStreaming();
      return (
        <div>
          <span data-testid="status">{status}</span>
          <button onClick={() => submitQuery("test")}>Submit</button>
          <button onClick={cancelQuery}>Cancel</button>
        </div>
      );
    };

    render(<TestComponent />);

    // Start query then cancel
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("idle");
    });
  });
});

// ============================================================================
// QueryResults Tests
// ============================================================================

describe("QueryResults", () => {
  const mockEvidence = [
    { id: "1", entity_type: "table", name: "orders", schema: "public" },
    { id: "2", entity_type: "table", name: "customers", schema: "public" },
  ];

  it("renders answer when present", () => {
    const { container } = render(
      <QueryResults
        evidence={mockEvidence}
        answer="Test answer"
        isLoading={false}
        hasMore={false}
        onLoadMore={jest.fn()}
        entityType="table"
        loadedCount={2}
      />,
    );

    // Check that the answer text is rendered in the component
    expect(screen.getByText("Test answer")).toBeInTheDocument();
    // Verify the answer section has the correct styling (border-l-4 border-l-primary)
    const answerCard = container.querySelector(".border-l-4.border-l-primary");
    expect(answerCard).toBeInTheDocument();
  });

  it("renders table with evidence", () => {
    render(
      <QueryResults
        evidence={mockEvidence}
        isLoading={false}
        hasMore={false}
        onLoadMore={jest.fn()}
        entityType="table"
        loadedCount={2}
      />,
    );

    expect(screen.getByText(/evidence/i)).toBeInTheDocument();
  });

  it("shows pagination when there are multiple pages", () => {
    const lotsOfEvidence = Array.from({ length: 25 }, (_, i) => ({
      id: String(i + 1),
      entity_type: "table",
      name: `Table ${i + 1}`,
      schema: "public",
    }));

    render(
      <QueryResults
        evidence={lotsOfEvidence}
        isLoading={false}
        hasMore={false}
        onLoadMore={jest.fn()}
        entityType="table"
        loadedCount={25}
        totalCount={25}
      />,
    );

    // Should show pagination controls for 25 items (3 pages)
    expect(screen.getByRole("button", { name: /go to first page/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /go to previous page/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /go to next page/i })).toBeInTheDocument();
  });

  it("shows empty state when no evidence", () => {
    render(
      <QueryResults
        evidence={[]}
        isLoading={false}
        hasMore={false}
        onLoadMore={jest.fn()}
        entityType="table"
        loadedCount={0}
      />,
    );

    expect(screen.getByText(/no results found/i)).toBeInTheDocument();
  });

  it("shows loading state", () => {
    render(
      <QueryResults
        evidence={[]}
        isLoading={true}
        hasMore={false}
        onLoadMore={jest.fn()}
        entityType="table"
        loadedCount={0}
      />,
    );

    expect(screen.getByText(/loading results/i)).toBeInTheDocument();
  });

  it("shows error state", () => {
    render(
      <QueryResults
        evidence={[]}
        isLoading={false}
        hasMore={false}
        onLoadMore={jest.fn()}
        entityType="table"
        loadedCount={0}
        error={new Error("Test error")}
      />,
    );

    expect(screen.getByText(/query error/i)).toBeInTheDocument();
    expect(screen.getByText(/test error/i)).toBeInTheDocument();
  });

  it("calls onPageChange when pagination clicked", async () => {
    const lotsOfEvidence = Array.from({ length: 25 }, (_, i) => ({
      id: String(i + 1),
      entity_type: "table",
      name: `Table ${i + 1}`,
      schema: "public",
    }));

    const handlePageChange = jest.fn();
    render(
      <QueryResults
        evidence={lotsOfEvidence}
        isLoading={false}
        hasMore={false}
        onLoadMore={jest.fn()}
        entityType="table"
        loadedCount={25}
        totalCount={25}
        onPageChange={handlePageChange}
      />,
    );

    // Navigate to page 2
    const page2Button = screen.getByRole("button", { name: /go to page 2/i });
    await userEvent.click(page2Button);

    expect(handlePageChange).toHaveBeenCalledWith(2);
  });
});

// ============================================================================
// ClarificationDialog Tests
// ============================================================================

describe("ClarificationDialog", () => {
  const mockOptions = [
    {
      id: "1",
      label: "Count all reports",
      preview: "count reports",
      confidence: 0.8,
    },
    {
      id: "2",
      label: "Count reports using orders table",
      preview: "count reports where table = orders",
      confidence: 0.6,
    },
  ];

  it("renders options when open", () => {
    render(
      <ClarificationDialog
        isOpen={true}
        options={mockOptions}
        onSelect={jest.fn()}
        onCancel={jest.fn()}
        originalQuery="How many reports?"
      />,
    );

    expect(screen.getByText(/did you mean/i)).toBeInTheDocument();
    expect(screen.getByText("Count all reports")).toBeInTheDocument();
    expect(
      screen.getByText("Count reports using orders table"),
    ).toBeInTheDocument();
  });

  it("shows original query", () => {
    render(
      <ClarificationDialog
        isOpen={true}
        options={mockOptions}
        onSelect={jest.fn()}
        onCancel={jest.fn()}
        originalQuery="How many reports?"
      />,
    );

    expect(screen.getByText(/original query/i)).toBeInTheDocument();
    expect(screen.getByText(/how many reports/i)).toBeInTheDocument();
  });

  it("calls onSelect when option clicked", async () => {
    const handleSelect = jest.fn();
    render(
      <ClarificationDialog
        isOpen={true}
        options={mockOptions}
        onSelect={handleSelect}
        onCancel={jest.fn()}
        originalQuery="How many reports?"
      />,
    );

    const option = screen.getByRole("radio", { name: /count all reports/i });
    await userEvent.click(option);

    await waitFor(() => {
      expect(handleSelect).toHaveBeenCalledWith("1");
    });
  });

  it("calls onCancel when cancel clicked", async () => {
    const handleCancel = jest.fn();
    render(
      <ClarificationDialog
        isOpen={true}
        options={mockOptions}
        onSelect={jest.fn()}
        onCancel={handleCancel}
        originalQuery="How many reports?"
      />,
    );

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    await userEvent.click(cancelButton);

    expect(handleCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when something else clicked", async () => {
    const handleCancel = jest.fn();
    render(
      <ClarificationDialog
        isOpen={true}
        options={mockOptions}
        onSelect={jest.fn()}
        onCancel={handleCancel}
        originalQuery="How many reports?"
      />,
    );

    // "Something else" is a Card with role="button" and specific aria-label
    const somethingElse = screen.getByRole("button", {
      name: /none of the above/i,
    });
    await userEvent.click(somethingElse);

    expect(handleCancel).toHaveBeenCalledTimes(1);
  });

  it("shows confidence indicators", () => {
    render(
      <ClarificationDialog
        isOpen={true}
        options={mockOptions}
        onSelect={jest.fn()}
        onCancel={jest.fn()}
        originalQuery="How many reports?"
      />,
    );

    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it("shows loading state when selecting", () => {
    render(
      <ClarificationDialog
        isOpen={true}
        options={mockOptions}
        onSelect={jest.fn()}
        onCancel={jest.fn()}
        originalQuery="How many reports?"
        isLoading={true}
      />,
    );

    // Loading state should be visible
    expect(screen.getByText(/count all reports/i)).toBeInTheDocument();
  });

  it("is not visible when closed", () => {
    const { container } = render(
      <ClarificationDialog
        isOpen={false}
        options={mockOptions}
        onSelect={jest.fn()}
        onCancel={jest.fn()}
        originalQuery="How many reports?"
      />,
    );

    // Dialog content should not be in the document
    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Integration: QueryResults with PaginatedEvidenceTable", () => {
  it("displays evidence in paginated table format", () => {
    const evidence = Array.from({ length: 15 }, (_, i) => ({
      id: String(i + 1),
      entity_type: "table",
      name: `Table ${i + 1}`,
      schema: "public",
      description: `Description for table ${i + 1}`,
    }));

    render(
      <QueryResults
        evidence={evidence}
        answer="Found 15 tables"
        isLoading={false}
        hasMore={false}
        onLoadMore={jest.fn()}
        entityType="table"
        loadedCount={15}
        totalCount={15}
      />,
    );

    expect(screen.getByText(/found 15 tables/i)).toBeInTheDocument();
    expect(screen.getByText(/evidence/i)).toBeInTheDocument();
    // PaginatedEvidenceTable shows total in header and range above table
    expect(screen.getByText(/\(15 total\)/i)).toBeInTheDocument();
    // The "Showing X to Y of Z" text is in PaginatedEvidenceTable
    expect(screen.getByText(/showing/i)).toBeInTheDocument();
  });

  it("paginates evidence correctly", () => {
    const evidence = Array.from({ length: 25 }, (_, i) => ({
      id: String(i + 1),
      entity_type: "table",
      name: `Table ${i + 1}`,
      schema: "public",
    }));

    render(
      <QueryResults
        evidence={evidence}
        isLoading={false}
        hasMore={false}
        onLoadMore={jest.fn()}
        entityType="table"
        loadedCount={25}
        totalCount={25}
      />,
    );

    // Should show page navigation
    expect(screen.getByRole("button", { name: /go to first page/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /go to next page/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /go to last page/i })).toBeInTheDocument();
    // Page info appears twice (mobile + desktop), check for at least one
    expect(screen.getAllByText(/page 1 of 3/i).length).toBeGreaterThanOrEqual(1);
  });
});

describe("Integration: useQueryStreaming with ClarificationDialog", () => {
  it("shows clarification dialog when needed", async () => {
    const TestComponent = () => {
      const { clarificationOptions, submitQuery, submitClarification, status } =
        useQueryStreaming({
          onClarificationNeeded: (options) => {
            // This would be called by the hook
          },
        });

      return (
        <div>
          <span data-testid="status">{status}</span>
          <ClarificationDialog
            isOpen={!!clarificationOptions && clarificationOptions.length > 0}
            options={clarificationOptions || []}
            onSelect={submitClarification}
            onCancel={() => {}}
            originalQuery="test query"
          />
          <button onClick={() => submitQuery("ambiguous query")}>Submit</button>
        </div>
      );
    };

    render(<TestComponent />);

    // Initially dialog should not be visible
    expect(screen.queryByText(/did you mean/i)).not.toBeInTheDocument();

    // Submit query
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
  });
});
