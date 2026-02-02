/**
 * Tests for PaginatedEvidenceTable component
 *
 * Phase 4 - TABLE-01: Paginated tables with AG Grid
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TooltipProvider } from "@/components/ui/tooltip";

// Mock the EvidenceTable component
jest.mock("../EvidenceTable", () => ({
  EvidenceTable: ({ rowData, loading, emptyMessage }: { rowData: unknown[]; loading?: boolean; emptyMessage?: string }) => (
    <div data-testid="mock-evidence-table">
      {loading && <div>Loading...</div>}
      {!loading && rowData.length === 0 && <div>{emptyMessage}</div>}
      {rowData.map((row: unknown, i: number) => (
        <div key={i} data-testid={`row-${i}`}>
          {JSON.stringify(row)}
        </div>
      ))}
    </div>
  ),
}));

// Mock the useTablePagination hook
jest.mock("@/hooks/useTablePagination", () => ({
  useTablePagination: (totalItems: number, initialPage: number = 1, pageSize: number = 10) => {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const page = Math.min(Math.max(1, initialPage), totalPages);
    const start = Math.min((page - 1) * pageSize + 1, totalItems);
    const end = Math.min(page * pageSize, totalItems);

    return {
      page,
      setPage: jest.fn(),
      pageSize,
      totalPages,
      sliceRange: { start, end },
      goToFirst: jest.fn(),
      goToPrev: jest.fn(),
      goToNext: jest.fn(),
      goToLast: jest.fn(),
      hasNext: page < totalPages && totalPages > 0,
      hasPrev: page > 1 && totalPages > 0,
    };
  },
  PAGE_SIZE: 10,
}));

import { PaginatedEvidenceTable } from "../PaginatedEvidenceTable";

const generateTestRows = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `row-${i}`,
    name: `Item ${i + 1}`,
    status: i % 2 === 0 ? "success" : "pending",
  }));

const mockColumnDefs = [
  { field: "id", headerName: "ID" },
  { field: "name", headerName: "Name" },
  { field: "status", headerName: "Status" },
];

const renderWithTooltip = (ui: React.ReactElement) =>
  render(<TooltipProvider>{ui}</TooltipProvider>);

describe("PaginatedEvidenceTable", () => {
  describe("Rendering", () => {
    it("renders with default props", () => {
      renderWithTooltip(
        <PaginatedEvidenceTable
          rowData={generateTestRows(5)}
          columnDefs={mockColumnDefs}
        />
      );

      expect(screen.getByTestId("mock-evidence-table")).toBeInTheDocument();
    });

    it("renders results count correctly", () => {
      const { container } = renderWithTooltip(
        <PaginatedEvidenceTable
          rowData={generateTestRows(25)}
          columnDefs={mockColumnDefs}
        />
      );

      // Should show "Showing 1 to 10 of 25 results" - find by container text
      const resultsText = container.textContent;
      expect(resultsText).toContain("Showing");
      expect(resultsText).toContain("25");
      expect(resultsText).toContain("results");
    });

    it("shows 'No results' when data is empty", () => {
      renderWithTooltip(
        <PaginatedEvidenceTable
          rowData={[]}
          columnDefs={mockColumnDefs}
        />
      );

      expect(screen.getByText("No results")).toBeInTheDocument();
    });

    it("respects custom totalCount prop", () => {
      renderWithTooltip(
        <PaginatedEvidenceTable
          rowData={generateTestRows(10)}
          columnDefs={mockColumnDefs}
          totalCount={100}
        />
      );

      expect(screen.getByText("100")).toBeInTheDocument();
    });
  });

  describe("Pagination controls", () => {
    it("shows pagination when more than one page", () => {
      renderWithTooltip(
        <PaginatedEvidenceTable
          rowData={generateTestRows(25)}
          columnDefs={mockColumnDefs}
        />
      );

      // Should have pagination buttons
      expect(screen.getByRole("button", { name: /go to first page/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /go to previous page/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /go to next page/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /go to last page/i })).toBeInTheDocument();
    });

    it("hides pagination when only one page", () => {
      renderWithTooltip(
        <PaginatedEvidenceTable
          rowData={generateTestRows(5)}
          columnDefs={mockColumnDefs}
        />
      );

      // Should not have pagination buttons (only 5 items, < 10 per page)
      expect(screen.queryByRole("button", { name: /go to first page/i })).not.toBeInTheDocument();
    });

    it("disables previous/first buttons on first page", () => {
      renderWithTooltip(
        <PaginatedEvidenceTable
          rowData={generateTestRows(25)}
          columnDefs={mockColumnDefs}
          initialPage={1}
        />
      );

      expect(screen.getByRole("button", { name: /go to first page/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /go to previous page/i })).toBeDisabled();
    });

    it("renders page numbers for small page counts", () => {
      renderWithTooltip(
        <PaginatedEvidenceTable
          rowData={generateTestRows(30)}
          columnDefs={mockColumnDefs}
        />
      );

      // Should show page 1, 2, 3 buttons
      expect(screen.getByRole("button", { name: /go to page 1/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /go to page 2/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /go to page 3/i })).toBeInTheDocument();
    });
  });

  describe("Loading state", () => {
    it("passes loading prop to EvidenceTable", () => {
      renderWithTooltip(
        <PaginatedEvidenceTable
          rowData={[]}
          columnDefs={mockColumnDefs}
          loading={true}
        />
      );

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });
  });

  describe("Custom empty message", () => {
    it("passes custom empty message to EvidenceTable", () => {
      const customMessage = "No evidence found for this query";
      renderWithTooltip(
        <PaginatedEvidenceTable
          rowData={[]}
          columnDefs={mockColumnDefs}
          emptyMessage={customMessage}
        />
      );

      expect(screen.getByText(customMessage)).toBeInTheDocument();
    });
  });

  describe("Page change callback", () => {
    it("calls onPageChange when page changes", () => {
      const onPageChange = jest.fn();
      renderWithTooltip(
        <PaginatedEvidenceTable
          rowData={generateTestRows(25)}
          columnDefs={mockColumnDefs}
          onPageChange={onPageChange}
        />
      );

      // Click page 2 button
      const page2Button = screen.getByRole("button", { name: /go to page 2/i });
      fireEvent.click(page2Button);

      expect(onPageChange).toHaveBeenCalledWith(2);
    });
  });

  describe("Accessibility", () => {
    it("has proper aria labels on pagination buttons", () => {
      renderWithTooltip(
        <PaginatedEvidenceTable
          rowData={generateTestRows(25)}
          columnDefs={mockColumnDefs}
        />
      );

      expect(screen.getByRole("button", { name: /go to first page/i })).toHaveAttribute("aria-label");
      expect(screen.getByRole("button", { name: /go to previous page/i })).toHaveAttribute("aria-label");
      expect(screen.getByRole("button", { name: /go to next page/i })).toHaveAttribute("aria-label");
      expect(screen.getByRole("button", { name: /go to last page/i })).toHaveAttribute("aria-label");
    });

    it("marks current page button with aria-current", () => {
      renderWithTooltip(
        <PaginatedEvidenceTable
          rowData={generateTestRows(25)}
          columnDefs={mockColumnDefs}
          initialPage={1}
        />
      );

      const page1Button = screen.getByRole("button", { name: /go to page 1/i });
      expect(page1Button).toHaveAttribute("aria-current", "page");
    });
  });
});
