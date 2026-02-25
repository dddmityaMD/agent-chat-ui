/**
 * Unit tests for block type registry (Phase 23.4-08).
 *
 * Tests verify:
 * - All 5 built-in block types are registered and resolvable
 * - Unknown types return null
 * - Custom type registration works via registerBlockType
 */

import { getBlockRenderer, registerBlockType } from "../registry";

describe("getBlockRenderer", () => {
  it("returns TextBlock for 'text' type", () => {
    const renderer = getBlockRenderer("text");
    expect(renderer).not.toBeNull();
  });

  it("returns DataTableBlock for 'data_table' type", () => {
    const renderer = getBlockRenderer("data_table");
    expect(renderer).not.toBeNull();
  });

  it("returns FlowSummaryBlock for 'flow_summary' type", () => {
    const renderer = getBlockRenderer("flow_summary");
    expect(renderer).not.toBeNull();
  });

  it("returns InterruptCardBlock for 'interrupt_card' type", () => {
    const renderer = getBlockRenderer("interrupt_card");
    expect(renderer).not.toBeNull();
  });

  it("returns InterruptDecisionBlock for 'interrupt_decision' type", () => {
    const renderer = getBlockRenderer("interrupt_decision");
    expect(renderer).not.toBeNull();
  });

  it("returns null for unknown type", () => {
    const renderer = getBlockRenderer("nonexistent_type");
    expect(renderer).toBeNull();
  });
});

describe("registerBlockType", () => {
  it("adds custom type that getBlockRenderer can resolve", () => {
    // Register a mock component
    const MockComponent = () => null;
    registerBlockType("custom_test_block", MockComponent as any);

    const renderer = getBlockRenderer("custom_test_block");
    expect(renderer).toBe(MockComponent);
  });
});

describe("built-in registry completeness", () => {
  it("has all 5 built-in types registered", () => {
    const builtInTypes = [
      "text",
      "data_table",
      "flow_summary",
      "interrupt_card",
      "interrupt_decision",
    ];

    for (const type of builtInTypes) {
      const renderer = getBlockRenderer(type);
      expect(renderer).not.toBeNull();
    }
  });
});
