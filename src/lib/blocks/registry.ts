import type { ComponentType } from "react";
import type { BlockRendererProps } from "./types";
import { TextBlock } from "./renderers/text-block";
import { DataTableBlock } from "./renderers/data-table-block";
import { FlowSummaryBlock } from "./renderers/flow-summary-block";
import { InterruptCardBlock } from "./renderers/interrupt-card-block";
import { InterruptDecisionBlock } from "./renderers/interrupt-decision-block";

const registry = new Map<string, ComponentType<BlockRendererProps>>();

export function registerBlockType(
  type: string,
  component: ComponentType<BlockRendererProps>,
) {
  registry.set(type, component);
}

export function getBlockRenderer(
  type: string,
): ComponentType<BlockRendererProps> | null {
  return registry.get(type) ?? null;
}

// Register built-in types
registerBlockType("text", TextBlock);
registerBlockType("data_table", DataTableBlock);
registerBlockType("flow_summary", FlowSummaryBlock);
registerBlockType("interrupt_card", InterruptCardBlock);
registerBlockType("interrupt_decision", InterruptDecisionBlock);
