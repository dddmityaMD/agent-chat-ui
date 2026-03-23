"use client";

import { type ReactNode } from "react";
import {
  Group,
  Panel,
  Separator,
} from "react-resizable-panels";

export interface DualSurfaceLayoutProps {
  chat: ReactNode;
  panel: ReactNode;
  panelOpen: boolean;
  canvasOpen: boolean;
  canvasContent?: ReactNode;
  onPanelCollapse?: () => void;
  onPanelExpand?: () => void;
}

/**
 * Three-surface layout: Chat | Block Panel | Canvas.
 *
 * Three modes:
 * - Normal (panelOpen=true, canvasOpen=false): Chat 60% | Separator | Panel 40%
 * - Chat-only (panelOpen=false, canvasOpen=false): Chat 100%
 * - Canvas (canvasOpen=true): Chat 35% | Separator | Canvas 65%. Panel hidden.
 */
export function DualSurfaceLayout({
  chat,
  panel,
  panelOpen,
  canvasOpen,
  canvasContent,
}: DualSurfaceLayoutProps) {
  // Canvas mode: Chat 35% | Separator | Canvas 65%
  if (canvasOpen) {
    return (
      <Group
        orientation="horizontal"
        className="h-full"
        id="sais-canvas"
      >
        <Panel
          id="chat-canvas"
          defaultSize={35}
          minSize={20}
        >
          {chat}
        </Panel>
        <Separator className="w-1.5 bg-border hover:bg-primary/20 transition-colors" />
        <Panel
          id="canvas"
          defaultSize={65}
          minSize={40}
          data-testid="canvas-panel"
        >
          {canvasContent}
        </Panel>
      </Group>
    );
  }

  // Chat-only mode: no panel
  if (!panelOpen) {
    return (
      <div className="h-full flex-1 min-w-0" data-testid="chat-only">
        {chat}
      </div>
    );
  }

  // Normal mode: Chat 60% | Separator | Panel 40%
  return (
    <Group
      orientation="horizontal"
      className="h-full"
      id="sais-layout"
    >
      <Panel
        id="chat"
        defaultSize={60}
        minSize={30}
      >
        {chat}
      </Panel>
      <Separator className="w-1.5 bg-border hover:bg-primary/20 transition-colors" />
      <Panel
        id="panel"
        defaultSize={40}
        minSize={20}
        collapsible
        collapsedSize={0}
        data-testid="block-panel"
      >
        {panel}
      </Panel>
    </Group>
  );
}
