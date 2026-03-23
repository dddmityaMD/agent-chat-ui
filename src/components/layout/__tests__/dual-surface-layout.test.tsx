import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DualSurfaceLayout } from "../dual-surface-layout";

// Mock react-resizable-panels with simple divs
jest.mock("react-resizable-panels", () => ({
  Group: ({ children, ...props }: any) => (
    <div data-testid="panel-group" data-orientation={props.orientation}>
      {children}
    </div>
  ),
  Panel: ({ children, ...props }: any) => (
    <div data-testid={props["data-testid"] || `panel-${props.id}`}>
      {children}
    </div>
  ),
  Separator: (_props: any) => <div data-testid="separator" />,
  useDefaultLayout: () => ({
    defaultLayout: undefined,
    onLayoutChange: jest.fn(),
    onLayoutChanged: jest.fn(),
  }),
}));

describe("DualSurfaceLayout", () => {
  it("renders chat and panel side by side when panelOpen=true", () => {
    render(
      <DualSurfaceLayout
        chat={<div>Chat Content</div>}
        panel={<div>Panel Content</div>}
        panelOpen={true}
        canvasOpen={false}
      />
    );

    expect(screen.getByText("Chat Content")).toBeInTheDocument();
    expect(screen.getByText("Panel Content")).toBeInTheDocument();
    expect(screen.getByTestId("separator")).toBeInTheDocument();
    expect(screen.getByTestId("panel-group")).toHaveAttribute(
      "data-orientation",
      "horizontal"
    );
  });

  it("renders chat only when panelOpen=false", () => {
    render(
      <DualSurfaceLayout
        chat={<div>Chat Content</div>}
        panel={<div>Panel Content</div>}
        panelOpen={false}
        canvasOpen={false}
      />
    );

    expect(screen.getByText("Chat Content")).toBeInTheDocument();
    expect(screen.queryByText("Panel Content")).not.toBeInTheDocument();
    expect(screen.getByTestId("chat-only")).toBeInTheDocument();
  });

  it("renders chat and canvas when canvasOpen=true (panel hidden)", () => {
    render(
      <DualSurfaceLayout
        chat={<div>Chat Content</div>}
        panel={<div>Panel Content</div>}
        panelOpen={true}
        canvasOpen={true}
        canvasContent={<div>Canvas Content</div>}
      />
    );

    expect(screen.getByText("Chat Content")).toBeInTheDocument();
    expect(screen.getByText("Canvas Content")).toBeInTheDocument();
    expect(screen.queryByText("Panel Content")).not.toBeInTheDocument();
    expect(screen.getByTestId("canvas-panel")).toBeInTheDocument();
  });

  it("does not render panel content when canvasOpen=true", () => {
    render(
      <DualSurfaceLayout
        chat={<div>Chat</div>}
        panel={<div>Hidden Panel</div>}
        panelOpen={true}
        canvasOpen={true}
        canvasContent={<div>Canvas</div>}
      />
    );

    expect(screen.queryByText("Hidden Panel")).not.toBeInTheDocument();
    expect(screen.getByText("Canvas")).toBeInTheDocument();
  });
});
