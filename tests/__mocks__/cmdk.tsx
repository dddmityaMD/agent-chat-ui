/**
 * Mock for cmdk used in Jest tests.
 *
 * Provides minimal Command component tree that renders children
 * so tests can interact with command palette items.
 */

import React from "react";

function CommandRoot({ children, className, onKeyDown }: {
  children: React.ReactNode;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}) {
  return (
    <div data-testid="cmdk-root" className={className} onKeyDown={onKeyDown}>
      {children}
    </div>
  );
}

function CommandInput({ placeholder, className }: {
  placeholder?: string;
  className?: string;
}) {
  return <input placeholder={placeholder} className={className} data-testid="cmdk-input" />;
}

function CommandList({ children, className }: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={className} data-testid="cmdk-list">{children}</div>;
}

function CommandItem({ children, onSelect, value, className }: {
  children: React.ReactNode;
  onSelect?: () => void;
  value?: string;
  className?: string;
}) {
  return (
    <div
      role="option"
      data-value={value}
      className={className}
      onClick={onSelect}
      data-testid={`cmdk-item-${value}`}
    >
      {children}
    </div>
  );
}

function CommandGroup({ children, heading, className }: {
  children: React.ReactNode;
  heading?: string;
  className?: string;
}) {
  return (
    <div data-testid={`cmdk-group-${heading}`} className={className}>
      {heading && <div>{heading}</div>}
      {children}
    </div>
  );
}

function CommandEmpty({ children, className }: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={className} data-testid="cmdk-empty">{children}</div>;
}

function CommandDialog({ children }: { children: React.ReactNode }) {
  return <div data-testid="cmdk-dialog">{children}</div>;
}

// Attach sub-components to Command
const Command = Object.assign(CommandRoot, {
  Input: CommandInput,
  List: CommandList,
  Item: CommandItem,
  Group: CommandGroup,
  Empty: CommandEmpty,
  Dialog: CommandDialog,
});

export { Command };
