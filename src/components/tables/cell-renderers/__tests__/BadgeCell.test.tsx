/**
 * Tests for BadgeCell component
 *
 * Phase 4 - TABLE-02: Rich cell types - status badges
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BadgeCell, getStatusColor } from "../BadgeCell";

describe("BadgeCell", () => {
  describe("Rendering", () => {
    it("renders badge with text value", () => {
      render(<BadgeCell value="success" />);
      expect(screen.getByText("success")).toBeInTheDocument();
    });

    it("returns null for null value", () => {
      const { container } = render(<BadgeCell value={null as unknown as string} />);
      expect(container.firstChild).toBeNull();
    });

    it("returns null for undefined value", () => {
      const { container } = render(<BadgeCell value={undefined as unknown as string} />);
      expect(container.firstChild).toBeNull();
    });

    it("converts numeric values to strings", () => {
      render(<BadgeCell value={123 as unknown as string} />);
      expect(screen.getByText("123")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      render(<BadgeCell value="test" className="custom-class" />);
      expect(screen.getByText("test")).toHaveClass("custom-class");
    });
  });

  describe("Status colors - success states (green)", () => {
    const greenStatuses = ["success", "active", "published", "completed", "enabled", "healthy", "connected"];

    greenStatuses.forEach((status) => {
      it(`renders green badge for "${status}"`, () => {
        render(<BadgeCell value={status} />);
        const badge = screen.getByText(status);
        expect(badge).toHaveClass("bg-green-100");
        expect(badge).toHaveClass("text-green-800");
      });
    });
  });

  describe("Status colors - error states (red)", () => {
    const redStatuses = ["error", "failed", "critical", "disconnected", "unhealthy"];

    redStatuses.forEach((status) => {
      it(`renders red badge for "${status}"`, () => {
        render(<BadgeCell value={status} />);
        const badge = screen.getByText(status);
        expect(badge).toHaveClass("bg-red-100");
        expect(badge).toHaveClass("text-red-800");
      });
    });
  });

  describe("Status colors - running states (blue)", () => {
    const blueStatuses = ["running", "processing", "in_progress", "syncing"];

    blueStatuses.forEach((status) => {
      it(`renders blue badge for "${status}"`, () => {
        render(<BadgeCell value={status} />);
        const badge = screen.getByText(status);
        expect(badge).toHaveClass("bg-blue-100");
        expect(badge).toHaveClass("text-blue-800");
      });
    });
  });

  describe("Status colors - pending states (gray)", () => {
    const grayStatuses = ["pending", "draft", "queued", "idle", "disabled", "archived"];

    grayStatuses.forEach((status) => {
      it(`renders gray badge for "${status}"`, () => {
        render(<BadgeCell value={status} />);
        const badge = screen.getByText(status);
        expect(badge).toHaveClass("bg-gray-100");
        expect(badge).toHaveClass("text-gray-800");
      });
    });
  });

  describe("Status colors - warning states (yellow)", () => {
    const yellowStatuses = ["deprecated", "warning", "stale", "outdated"];

    yellowStatuses.forEach((status) => {
      it(`renders yellow badge for "${status}"`, () => {
        render(<BadgeCell value={status} />);
        const badge = screen.getByText(status);
        expect(badge).toHaveClass("bg-yellow-100");
        expect(badge).toHaveClass("text-yellow-800");
      });
    });
  });

  describe("Case insensitivity", () => {
    it("handles uppercase status", () => {
      render(<BadgeCell value="SUCCESS" />);
      const badge = screen.getByText("SUCCESS");
      expect(badge).toHaveClass("bg-green-100");
    });

    it("handles mixed case status", () => {
      render(<BadgeCell value="Success" />);
      const badge = screen.getByText("Success");
      expect(badge).toHaveClass("bg-green-100");
    });
  });

  describe("Hyphen to underscore normalization", () => {
    it("handles hyphenated status", () => {
      render(<BadgeCell value="in-progress" />);
      const badge = screen.getByText("in-progress");
      expect(badge).toHaveClass("bg-blue-100");
    });
  });

  describe("Unknown status fallback", () => {
    it("renders gray badge for unknown status", () => {
      render(<BadgeCell value="unknown_status" />);
      const badge = screen.getByText("unknown_status");
      expect(badge).toHaveClass("bg-gray-100");
      expect(badge).toHaveClass("text-gray-800");
    });
  });
});

describe("getStatusColor utility", () => {
  it("returns correct color classes for known statuses", () => {
    expect(getStatusColor("success")).toContain("bg-green");
    expect(getStatusColor("error")).toContain("bg-red");
    expect(getStatusColor("running")).toContain("bg-blue");
    expect(getStatusColor("pending")).toContain("bg-gray");
    expect(getStatusColor("warning")).toContain("bg-yellow");
  });

  it("returns default color for unknown status", () => {
    expect(getStatusColor("foobar")).toContain("bg-gray");
  });

  it("is case insensitive", () => {
    expect(getStatusColor("SUCCESS")).toContain("bg-green");
    expect(getStatusColor("ERROR")).toContain("bg-red");
  });
});
