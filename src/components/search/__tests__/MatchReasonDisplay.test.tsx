/**
 * Tests for MatchReasonDisplay component
 *
 * Phase 4 - TABLE-05: Search transparency with match reasons
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  MatchReasonDisplay,
  highlightTerms,
  formatFieldName,
  getConfidenceColor,
  type MatchReason,
} from "../MatchReasonDisplay";

const createMockMatchReason = (
  overrides: Partial<MatchReason> = {}
): MatchReason => ({
  matchedFields: ["name", "description"],
  matchedTerms: ["revenue", "report"],
  confidence: 0.85,
  explanation: "Matched 'revenue' and 'report' in name and description",
  fieldConfidences: {
    name: 1.0,
    description: 0.7,
  },
  isDuplicate: false,
  ...overrides,
});

describe("MatchReasonDisplay", () => {
  describe("Simple variant (default)", () => {
    it("renders simple match reason text", () => {
      render(
        <MatchReasonDisplay matchReason={createMockMatchReason()} />
      );
      expect(
        screen.getByText(/Matched 'revenue' and 'report' in name and description/)
      ).toBeInTheDocument();
    });

    it("shows reused indicator when isDuplicate is true", () => {
      render(
        <MatchReasonDisplay
          matchReason={createMockMatchReason({ isDuplicate: true })}
        />
      );
      expect(screen.getByText("(reused)")).toBeInTheDocument();
    });

    it("hides confidence by default", () => {
      render(
        <MatchReasonDisplay matchReason={createMockMatchReason()} />
      );
      expect(screen.queryByText(/85%/)).not.toBeInTheDocument();
    });

    it("shows confidence when showConfidence is true", () => {
      render(
        <MatchReasonDisplay
          matchReason={createMockMatchReason()}
          showConfidence
        />
      );
      expect(screen.getByText("(85%)")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      const { container } = render(
        <MatchReasonDisplay
          matchReason={createMockMatchReason()}
          className="custom-class"
        />
      );
      expect(container.firstChild).toHaveClass("custom-class");
    });

    it("generates explanation from matched fields and terms when none provided", () => {
      render(
        <MatchReasonDisplay
          matchReason={createMockMatchReason({ explanation: undefined })}
        />
      );
      expect(screen.getByText(/Matched:/)).toBeInTheDocument();
      expect(screen.getByText(/'revenue'/)).toBeInTheDocument();
    });

    it("shows 'No match details' when no fields or terms", () => {
      render(
        <MatchReasonDisplay
          matchReason={createMockMatchReason({
            matchedFields: [],
            matchedTerms: [],
            explanation: undefined,
          })}
        />
      );
      expect(screen.getByText("No match details")).toBeInTheDocument();
    });
  });

  describe("Detailed variant", () => {
    it("renders expandable card", () => {
      render(
        <MatchReasonDisplay
          matchReason={createMockMatchReason()}
          variant="detailed"
        />
      );
      // Should have a button to expand
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("shows confidence bar", () => {
      render(
        <MatchReasonDisplay
          matchReason={createMockMatchReason()}
          variant="detailed"
        />
      );
      expect(screen.getByText("85%")).toBeInTheDocument();
    });

    it("expands to show matched terms on click", () => {
      render(
        <MatchReasonDisplay
          matchReason={createMockMatchReason()}
          variant="detailed"
        />
      );

      // Click to expand
      fireEvent.click(screen.getByRole("button"));

      // Should show matched terms section
      expect(screen.getByText("Matched Terms")).toBeInTheDocument();
      expect(screen.getByText("revenue")).toBeInTheDocument();
      expect(screen.getByText("report")).toBeInTheDocument();
    });

    it("shows field breakdown when expanded", () => {
      render(
        <MatchReasonDisplay
          matchReason={createMockMatchReason()}
          variant="detailed"
        />
      );

      // Click to expand
      fireEvent.click(screen.getByRole("button"));

      // Should show field breakdown
      expect(screen.getByText("Field Breakdown")).toBeInTheDocument();
      expect(screen.getByText("name")).toBeInTheDocument();
      expect(screen.getByText("description")).toBeInTheDocument();
      expect(screen.getByText("100%")).toBeInTheDocument(); // name confidence
      expect(screen.getByText("70%")).toBeInTheDocument(); // description confidence
    });

    it("shows deduplication note when isDuplicate", () => {
      render(
        <MatchReasonDisplay
          matchReason={createMockMatchReason({ isDuplicate: true })}
          variant="detailed"
        />
      );

      // Click to expand
      fireEvent.click(screen.getByRole("button"));

      expect(
        screen.getByText(/This evidence was reused from a previous query/)
      ).toBeInTheDocument();
    });

    it("collapses when clicked again", () => {
      render(
        <MatchReasonDisplay
          matchReason={createMockMatchReason()}
          variant="detailed"
        />
      );

      // Click to expand
      fireEvent.click(screen.getByRole("button"));
      expect(screen.getByText("Matched Terms")).toBeInTheDocument();

      // Click to collapse
      fireEvent.click(screen.getByRole("button"));
      expect(screen.queryByText("Matched Terms")).not.toBeInTheDocument();
    });

    it("shows reused badge in header when isDuplicate", () => {
      render(
        <MatchReasonDisplay
          matchReason={createMockMatchReason({ isDuplicate: true })}
          variant="detailed"
        />
      );

      expect(screen.getByText("reused")).toBeInTheDocument();
    });
  });

  describe("Confidence colors", () => {
    it("shows green for high confidence (>=0.8)", () => {
      render(
        <MatchReasonDisplay
          matchReason={createMockMatchReason({ confidence: 0.9 })}
          variant="detailed"
        />
      );

      const percentage = screen.getByText("90%");
      expect(percentage).toHaveClass("text-green-600");
    });

    it("shows yellow for medium confidence (0.5-0.8)", () => {
      render(
        <MatchReasonDisplay
          matchReason={createMockMatchReason({ confidence: 0.6 })}
          variant="detailed"
        />
      );

      const percentage = screen.getByText("60%");
      expect(percentage).toHaveClass("text-yellow-600");
    });

    it("shows gray for low confidence (<0.5)", () => {
      render(
        <MatchReasonDisplay
          matchReason={createMockMatchReason({ confidence: 0.3 })}
          variant="detailed"
        />
      );

      const percentage = screen.getByText("30%");
      expect(percentage).toHaveClass("text-gray-500");
    });
  });
});

describe("highlightTerms utility", () => {
  it("returns original text when no terms provided", () => {
    const result = highlightTerms("hello world", []);
    expect(result).toBe("hello world");
  });

  it("highlights matching terms", () => {
    const result = highlightTerms("Revenue report for Q4", ["revenue", "report"]);
    // Result should be React nodes with highlighted terms
    expect(Array.isArray(result)).toBe(true);
  });

  it("is case insensitive", () => {
    const result = highlightTerms("REVENUE report", ["revenue"]);
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("formatFieldName utility", () => {
  it("replaces underscores with spaces", () => {
    expect(formatFieldName("table_name")).toBe("table name");
    expect(formatFieldName("created_at_date")).toBe("created at date");
  });

  it("leaves names without underscores unchanged", () => {
    expect(formatFieldName("name")).toBe("name");
  });
});

describe("getConfidenceColor utility", () => {
  it("returns green for high confidence", () => {
    expect(getConfidenceColor(0.8)).toBe("text-green-600");
    expect(getConfidenceColor(0.9)).toBe("text-green-600");
    expect(getConfidenceColor(1.0)).toBe("text-green-600");
  });

  it("returns yellow for medium confidence", () => {
    expect(getConfidenceColor(0.5)).toBe("text-yellow-600");
    expect(getConfidenceColor(0.7)).toBe("text-yellow-600");
    expect(getConfidenceColor(0.79)).toBe("text-yellow-600");
  });

  it("returns gray for low confidence", () => {
    expect(getConfidenceColor(0.1)).toBe("text-gray-500");
    expect(getConfidenceColor(0.3)).toBe("text-gray-500");
    expect(getConfidenceColor(0.49)).toBe("text-gray-500");
  });
});
