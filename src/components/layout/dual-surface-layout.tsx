"use client";

import { type ReactNode, useCallback, useRef } from "react";
import {
  Group,
  Panel,
  type PanelImperativeHandle,
  type PanelSize,
  Separator,
  useDefaultLayout,
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
 *
 * Layout is a dumb container -- it does NOT control when canvas opens (D-14).
 */
export function DualSurfaceLayout({
  chat,
  panel,
  panelOpen,
  canvasOpen,
  canvasContent,
  onPanelCollapse,
  onPanelExpand,
}: DualSurfaceLayoutProps) {
  const panelRef = useRef<PanelImperativeHandle>(null);

  // Persist normal layout sizes
  const normalLayout = useDefaultLayout({
    id: "sais-layout",
    storage: typeof window !== "undefined" ? localStorage : undefined,
  });

  // Persist canvas layout sizes
  const canvasLayout = useDefaultLayout({
    id: "sais-canvas",
    storage: typeof window !== "undefined" ? localStorage : undefined,
  });

  const handlePanelResize = useCallback(
    (size: PanelSize) => {
      // Panel collapsed when size reaches 0
      if (size.asPercentage === 0) {
        onPanelCollapse?.();
      } else {
        onPanelExpand?.();
      }
    },
    [onPanelCollapse, onPanelExpand]
  );

  // Canvas mode: Chat 35% | Separator | Canvas 65%
  if (canvasOpen) {
    return (
      <Group
        orientation="horizontal"
        className="h-full"
        defaultLayout={canvasLayout.defaultLayout}
        onLayoutChanged={canvasLayout.onLayoutChanged}
        id="sais-canvas"
      >
        <Panel
          id="chat-canvas"
          defaultSize="35%"
          minSize="20%"
        >
          {chat}
        </Panel>
        <Separator className="w-1.5 bg-border hover:bg-primary/20 transition-colors" />
        <Panel
          id="canvas"
          defaultSize="65%"
          minSize="40%"
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
      <div className="h-full" data-testid="chat-only">
        {chat}
      </div>
    );
  }

  // Normal mode: Chat 60% | Separator | Panel 40%
  return (
    <Group
      orientation="horizontal"
      className="h-full"
      defaultLayout={normalLayout.defaultLayout}
      onLayoutChanged={normalLayout.onLayoutChanged}
      id="sais-layout"
    >
      <Panel
        id="chat"
        defaultSize="60%"
        minSize="30%"
      >
        {chat}
      </Panel>
      <Separator className="w-1.5 bg-border hover:bg-primary/20 transition-colors" />
      <Panel
        id="panel"
        defaultSize="40%"
        minSize="20%"
        collapsible
        collapsedSize="0%"
        onResize={handlePanelResize}
        panelRef={panelRef}
        data-testid="block-panel"
      >
        {panel}
      </Panel>
    </Group>
  );
}
