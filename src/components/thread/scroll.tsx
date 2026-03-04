/**
 * scroll.tsx — Scroll-related components for the thread view.
 * StickyToBottomContent, ScrollToBottom, NewMessagesDetector.
 */

import { ReactNode, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useStickToBottomContext } from "use-stick-to-bottom";
import { ArrowDown } from "lucide-react";

export function StickyToBottomContent(props: {
  content: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const context = useStickToBottomContext();
  return (
    <div
      ref={context.scrollRef}
      style={{ width: "100%", height: "100%" }}
      className={props.className}
    >
      <div
        ref={context.contentRef}
        className={props.contentClassName}
      >
        {props.content}
      </div>

      {props.footer}
    </div>
  );
}

export function ScrollToBottom(props: {
  className?: string;
  hasNewMessages?: boolean;
  onScrollToBottom?: () => void;
}) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  if (isAtBottom) return null;
  return (
    <button
      type="button"
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-full border bg-background shadow-md transition-all hover:bg-accent",
        props.hasNewMessages ? "h-8 px-3" : "h-8 w-8",
        props.className,
      )}
      onClick={() => {
        scrollToBottom();
        props.onScrollToBottom?.();
      }}
      aria-label={props.hasNewMessages ? "New messages - scroll to bottom" : "Scroll to bottom"}
    >
      {props.hasNewMessages && (
        <span className="text-xs font-medium text-blue-600">New messages</span>
      )}
      <ArrowDown className="h-4 w-4" />
    </button>
  );
}

/**
 * Detects new messages arriving while user is scrolled up.
 * Must be rendered inside StickToBottom context.
 */
export function NewMessagesDetector({
  messageCount,
  onNewMessages,
  onAtBottom,
}: {
  messageCount: number;
  onNewMessages: () => void;
  onAtBottom: () => void;
}) {
  const { isAtBottom } = useStickToBottomContext();
  const prevCountRef = useRef(messageCount);

  useEffect(() => {
    if (messageCount > prevCountRef.current && !isAtBottom) {
      onNewMessages();
    }
    prevCountRef.current = messageCount;
  }, [messageCount, isAtBottom, onNewMessages]);

  useEffect(() => {
    if (isAtBottom) {
      onAtBottom();
    }
  }, [isAtBottom, onAtBottom]);

  return null;
}
