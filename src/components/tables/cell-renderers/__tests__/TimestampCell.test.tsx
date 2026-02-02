/**
 * Tests for TimestampCell component
 *
 * Phase 4 - TABLE-02: Rich cell types - timestamps
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TimestampCell } from "../TimestampCell";

// Mock date-fns to ensure deterministic tests
jest.mock("date-fns", () => ({
  ...jest.requireActual("date-fns"),
  formatDistanceToNow: jest.fn(() => "2 hours ago"),
}));

const renderWithTooltip = (ui: React.ReactElement) =>
  render(<TooltipProvider>{ui}</TooltipProvider>);

describe("TimestampCell", () => {
  describe("Rendering", () => {
    it("returns null for null value", () => {
      const { container } = renderWithTooltip(<TimestampCell value={null} />);
      expect(container.textContent).toBe("");
    });

    it("returns null for undefined value", () => {
      const { container } = renderWithTooltip(<TimestampCell value={undefined} />);
      expect(container.textContent).toBe("");
    });

    it("renders formatted date for valid ISO string", () => {
      renderWithTooltip(<TimestampCell value="2024-01-15T14:30:00Z" />);
      // Should show formatted date (short format)
      expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument();
    });

    it("renders formatted date for Date object", () => {
      renderWithTooltip(<TimestampCell value={new Date("2024-01-15T14:30:00Z")} />);
      expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument();
    });

    it("renders formatted date for numeric timestamp (epoch ms)", () => {
      // January 15, 2024 14:30:00 UTC
      const timestamp = 1705329000000;
      renderWithTooltip(<TimestampCell value={timestamp} />);
      expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument();
    });
  });

  describe("Format options", () => {
    it("uses short format by default", () => {
      renderWithTooltip(<TimestampCell value="2024-01-15T14:30:00Z" />);
      // Short format: "Jan 15, 2024, 2:30 PM"
      expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument();
    });

    it("supports long format", () => {
      renderWithTooltip(<TimestampCell value="2024-01-15T14:30:45Z" format="long" />);
      // Long format: "January 15, 2024 at 2:30:45 PM"
      expect(screen.getByText(/January 15, 2024/)).toBeInTheDocument();
    });

    it("supports relative format", () => {
      renderWithTooltip(<TimestampCell value="2024-01-15T14:30:00Z" format="relative" />);
      // Mocked to return "2 hours ago"
      expect(screen.getByText("2 hours ago")).toBeInTheDocument();
    });
  });

  describe("Invalid date handling", () => {
    it("shows 'Invalid date' for invalid string input", () => {
      renderWithTooltip(<TimestampCell value="not-a-date" />);
      // Should gracefully show the original value or Invalid date
      const element = screen.getByText(/not-a-date|Invalid date/);
      expect(element).toBeInTheDocument();
    });

    it("shows 'Invalid date' for invalid Date object", () => {
      renderWithTooltip(<TimestampCell value={new Date("invalid")} />);
      expect(screen.getByText("Invalid date")).toBeInTheDocument();
    });
  });

  describe("Tooltip functionality", () => {
    it("has tooltip trigger wrapper", () => {
      renderWithTooltip(<TimestampCell value="2024-01-15T14:30:00Z" />);
      // The timestamp text should be a tooltip trigger
      const element = screen.getByText(/Jan 15, 2024/);
      expect(element).toBeInTheDocument();
      expect(element).toHaveClass("cursor-help");
    });
  });

  describe("Custom className", () => {
    it("applies custom className", () => {
      renderWithTooltip(
        <TimestampCell value="2024-01-15T14:30:00Z" className="custom-class" />
      );
      const element = screen.getByText(/Jan 15, 2024/);
      expect(element).toHaveClass("custom-class");
    });
  });

  describe("AG Grid compatibility", () => {
    it("works with AG Grid ICellRendererParams format", () => {
      // AG Grid passes params object with value property
      const params = {
        value: "2024-01-15T14:30:00Z",
        data: {},
        node: {},
        colDef: {},
      };

      renderWithTooltip(<TimestampCell {...params} />);
      expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument();
    });
  });
});
