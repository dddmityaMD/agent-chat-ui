import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandPalette } from "../CommandPalette";

// Minimal props factory
function makeProps(overrides: Partial<Parameters<typeof CommandPalette>[0]> = {}) {
  return {
    open: true,
    setOpen: jest.fn(),
    threads: [
      { id: "t1", title: "Revenue investigation" },
      { id: "t2", title: "Build dbt model" },
    ],
    onNewThread: jest.fn(),
    onSelectThread: jest.fn(),
    onToggleEvidence: jest.fn(),
    onToggleCasePanel: jest.fn(),
    onFocusInput: jest.fn(),
    onSlashCommand: jest.fn(),
    ...overrides,
  };
}

describe("CommandPalette", () => {
  it("renders when open=true", () => {
    render(<CommandPalette {...makeProps()} />);
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it("does not render content when open=false", () => {
    render(<CommandPalette {...makeProps({ open: false })} />);
    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
  });

  it("filters commands via fuzzy search -- typing 'inv' shows /investigate", async () => {
    const user = userEvent.setup();
    render(<CommandPalette {...makeProps()} />);

    const input = screen.getByPlaceholderText(/search/i);
    await user.type(input, "inv");

    await waitFor(() => {
      expect(screen.getByText(/investigate/i)).toBeInTheDocument();
    });
  });

  it("calls onSlashCommand and closes palette when selecting a slash command", async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<CommandPalette {...props} />);

    const item = screen.getByText(/investigate/i);
    await user.click(item);

    expect(props.onSlashCommand).toHaveBeenCalledWith("/investigate");
    expect(props.setOpen).toHaveBeenCalledWith(false);
  });

  it("calls onSelectThread and closes palette when selecting a thread", async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<CommandPalette {...props} />);

    const threadItem = screen.getByText("Revenue investigation");
    await user.click(threadItem);

    expect(props.onSelectThread).toHaveBeenCalledWith("t1");
    expect(props.setOpen).toHaveBeenCalledWith(false);
  });

  it("closes palette on Escape", async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<CommandPalette {...props} />);

    await user.keyboard("{Escape}");

    expect(props.setOpen).toHaveBeenCalledWith(false);
  });

  it("renders shortcut hints for items that have shortcuts", () => {
    render(<CommandPalette {...makeProps()} />);
    // "Toggle Case Panel" has Ctrl+E shortcut
    expect(screen.getByText(/Ctrl\+E/)).toBeInTheDocument();
  });

  it("calls onNewThread when New Thread action is selected", async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<CommandPalette {...props} />);

    const newThreadItem = screen.getByText(/new thread/i);
    await user.click(newThreadItem);

    expect(props.onNewThread).toHaveBeenCalled();
    expect(props.setOpen).toHaveBeenCalledWith(false);
  });
});
