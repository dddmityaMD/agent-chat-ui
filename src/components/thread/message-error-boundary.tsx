/**
 * message-error-boundary.tsx — Error boundary for individual messages.
 * Prevents a single malformed message from crashing the entire thread.
 */

import { Component, ReactNode } from "react";

export class MessageErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Failed to render this message.{" "}
          <span className="text-xs text-red-500">
            {this.state.error?.message}
          </span>
        </div>
      );
    }
    return this.props.children;
  }
}
