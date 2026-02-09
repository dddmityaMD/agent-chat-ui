/**
 * Tests for DeepLinkCell component
 *
 * Phase 4 - TABLE-03: Deep links to source systems
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DeepLinkCell, createDeepLinkCellRenderer } from "../DeepLinkCell";
import type { DeepLinkType } from "@/lib/deep-links";

const renderWithTooltip = (ui: React.ReactElement) =>
  render(<TooltipProvider>{ui}</TooltipProvider>);

describe("DeepLinkCell", () => {
  describe("Rendering", () => {
    it("returns null when targetId is empty", () => {
      const { container } = renderWithTooltip(
        <DeepLinkCell type="metabase_card" targetId="" />
      );
      expect(container.firstChild).toBeNull();
    });

    it("renders link with correct URL for Metabase card", () => {
      renderWithTooltip(
        <DeepLinkCell type="metabase_card" targetId="123" />
      );
      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", expect.stringContaining("/card/123"));
    });

    it("renders link with correct URL for Metabase dashboard", () => {
      renderWithTooltip(
        <DeepLinkCell type="metabase_dashboard" targetId="456" />
      );
      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", expect.stringContaining("/dashboard/456"));
    });

    it("renders link with correct URL for dbt model", () => {
      const prev = process.env.NEXT_PUBLIC_DBT_DOCS_URL;
      process.env.NEXT_PUBLIC_DBT_DOCS_URL = "http://localhost:8080";
      try {
        renderWithTooltip(
          <DeepLinkCell type="dbt_model" targetId="stg_customers" />
        );
        const link = screen.getByRole("link");
        expect(link).toHaveAttribute("href", expect.stringContaining("model/stg_customers"));
      } finally {
        process.env.NEXT_PUBLIC_DBT_DOCS_URL = prev;
      }
    });

    it("renders link with correct URL for git commit", () => {
      renderWithTooltip(
        <DeepLinkCell type="git_commit" targetId="abc123" config={{ gitRepoUrl: "https://github.com/org/repo" }} />
      );
      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", expect.stringContaining("commit/abc123"));
    });
  });

  describe("Link behavior", () => {
    it("opens in new tab", () => {
      renderWithTooltip(
        <DeepLinkCell type="metabase_card" targetId="123" />
      );
      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("stops propagation on click", () => {
      const parentHandler = jest.fn();
      render(
        <TooltipProvider>
          <div onClick={parentHandler}>
            <DeepLinkCell type="metabase_card" targetId="123" />
          </div>
        </TooltipProvider>
      );

      const link = screen.getByRole("link");
      fireEvent.click(link);

      expect(parentHandler).not.toHaveBeenCalled();
    });
  });

  describe("Default labels", () => {
    const linkTypes: Array<{ type: DeepLinkType; expectedLabel: string }> = [
      { type: "metabase_card", expectedLabel: "View Card" },
      { type: "metabase_dashboard", expectedLabel: "View Dashboard" },
      { type: "dbt_model", expectedLabel: "View Model" },
      { type: "dbt_source", expectedLabel: "View Source" },
      { type: "dbt_test", expectedLabel: "View Test" },
      { type: "dbt_docs", expectedLabel: "Docs" },
      { type: "git_commit", expectedLabel: "View Commit" },
      { type: "git_file", expectedLabel: "View File" },
    ];

    linkTypes.forEach(({ type, expectedLabel }) => {
      it(`shows default label "${expectedLabel}" for type "${type}"`, () => {
        renderWithTooltip(
          <DeepLinkCell type={type} targetId="test-id" />
        );
        expect(screen.getByText(expectedLabel)).toBeInTheDocument();
      });
    });
  });

  describe("Custom label", () => {
    it("uses custom label when provided", () => {
      renderWithTooltip(
        <DeepLinkCell type="metabase_card" targetId="123" label="Custom Label" />
      );
      expect(screen.getByText("Custom Label")).toBeInTheDocument();
    });
  });

  describe("Icons", () => {
    it("renders icon for each link type", () => {
      renderWithTooltip(
        <DeepLinkCell type="metabase_card" targetId="123" />
      );
      // Icon should be present (SVG element inside the link)
      const link = screen.getByRole("link");
      const svg = link.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });
  });

  describe("Tooltip", () => {
    it("wraps link in tooltip", () => {
      renderWithTooltip(
        <DeepLinkCell type="metabase_card" targetId="123" />
      );
      // Tooltip trigger is present
      const link = screen.getByRole("link");
      expect(link).toBeInTheDocument();
    });
  });

  describe("Custom config", () => {
    it("uses custom baseUrl from config", () => {
      renderWithTooltip(
        <DeepLinkCell
          type="metabase_card"
          targetId="123"
          config={{ metabaseBaseUrl: "https://bi.example.com" }}
        />
      );
      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "https://bi.example.com/card/123");
    });
  });
});

describe("createDeepLinkCellRenderer", () => {
  it("creates a cell renderer function", () => {
    const renderer = createDeepLinkCellRenderer("metabase_card", "Custom Label");
    expect(typeof renderer).toBe("function");
  });

  it("renderer returns null for empty value", () => {
    const renderer = createDeepLinkCellRenderer("metabase_card");
    const params = { value: null, data: {}, node: {}, colDef: {} };
    const result = renderer(params as never);
    expect(result).toBeNull();
  });

  it("renderer returns DeepLinkCell for valid value", () => {
    const renderer = createDeepLinkCellRenderer("metabase_card", "View");
    const params = { value: "123", data: {}, node: {}, colDef: {} };

    const { container } = renderWithTooltip(renderer(params as never) as React.ReactElement);
    expect(container.querySelector("a")).toBeInTheDocument();
  });

  it("renderer passes config to DeepLinkCell", () => {
    const renderer = createDeepLinkCellRenderer("metabase_card", "View", {
      metabaseBaseUrl: "https://custom.example.com",
    });
    const params = { value: "456", data: {}, node: {}, colDef: {} };

    renderWithTooltip(renderer(params as never) as React.ReactElement);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://custom.example.com/card/456");
  });
});
