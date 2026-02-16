/**
 * Tests for EmptyState component.
 *
 * Phase 19 - TEST-04: Frontend component test coverage.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { EmptyState } from "../empty-state";

describe("EmptyState", () => {
  it("renders heading text", () => {
    render(<EmptyState onSelect={jest.fn()} />);
    expect(
      screen.getByText("What would you like to know about your data?"),
    ).toBeInTheDocument();
  });

  it("renders 3 suggested query chips", () => {
    render(<EmptyState onSelect={jest.fn()} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);
  });

  it("renders correct chip text content", () => {
    render(<EmptyState onSelect={jest.fn()} />);
    expect(
      screen.getByText("What tables do we have in the data warehouse?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Show me the lineage for our key metrics"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Are there any data quality issues to investigate?"),
    ).toBeInTheDocument();
  });

  it("calls onSelect with query text when chip is clicked", async () => {
    const onSelect = jest.fn();
    render(<EmptyState onSelect={onSelect} />);

    await userEvent.click(
      screen.getByText("What tables do we have in the data warehouse?"),
    );

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(
      "What tables do we have in the data warehouse?",
    );
  });

  it("calls onSelect with correct text for each chip", async () => {
    const onSelect = jest.fn();
    render(<EmptyState onSelect={onSelect} />);

    await userEvent.click(
      screen.getByText("Show me the lineage for our key metrics"),
    );
    expect(onSelect).toHaveBeenCalledWith(
      "Show me the lineage for our key metrics",
    );

    await userEvent.click(
      screen.getByText("Are there any data quality issues to investigate?"),
    );
    expect(onSelect).toHaveBeenCalledWith(
      "Are there any data quality issues to investigate?",
    );
  });

  it("renders description text", () => {
    render(<EmptyState onSelect={jest.fn()} />);
    expect(
      screen.getByText(/Ask about your data sources, lineage, quality/),
    ).toBeInTheDocument();
  });
});
