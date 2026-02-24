'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, ChevronRight, Check, Loader2, Brain, Circle } from 'lucide-react';
import type { ThoughtStage } from '@/lib/message-groups';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Single stage row
// ---------------------------------------------------------------------------

function StageRow({
  stage,
  status,
}: {
  stage: ThoughtStage;
  status: 'completed' | 'in-progress' | 'pending';
}) {
  if (status === 'pending') return null; // Not yet revealed

  return (
    <div className="flex items-center gap-2 py-0.5">
      {status === 'in-progress' ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500 flex-shrink-0" />
      ) : status === 'completed' ? (
        <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
      ) : (
        <Circle className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
      )}
      <span
        className={cn(
          'text-xs',
          status === 'in-progress' ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {stage.label}
      </span>
      {stage.detail && (
        <span className="text-xs text-muted-foreground/70">
          — {stage.detail}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progressive stage reveal hook
// ---------------------------------------------------------------------------

/**
 * Progressively reveals stages during streaming. Combines two signals:
 *
 * 1. **Timer-based**: Reveals one stage every `intervalMs` as a fallback
 *    animation when streaming state hasn't arrived yet.
 * 2. **Data-driven** (`minRevealCount`): When the parent computes that
 *    streaming state shows a stage has completed, it passes a higher
 *    minRevealCount to immediately jump ahead of the timer.
 *
 * The final revealed count is `Math.max(timer, minRevealCount)`, so
 * data always wins over the timer but the timer provides smooth
 * animation when data is delayed.
 */
function useProgressiveReveal(
  stages: ThoughtStage[],
  isStreaming: boolean,
  minRevealCount: number = 0,
  intervalMs: number = 2000,
): number {
  // timerCount: timer-driven reveal count (1-based).
  const [timerCount, setTimerCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isStreaming || stages.length === 0) {
      // Reset when not streaming
      setTimerCount(0);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Start with first stage visible immediately
    setTimerCount(1);

    timerRef.current = setInterval(() => {
      setTimerCount((prev) => {
        const next = prev + 1;
        if (next >= stages.length) {
          // All stages revealed — stop timer (last one stays spinning)
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
        }
        return Math.min(next, stages.length);
      });
    }, intervalMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isStreaming, stages.length, intervalMs]);

  // Data-driven reveal is primary. Timer can only show at most 1 stage
  // beyond what data confirms, preventing stages from completing (checkmark)
  // before their detail data has arrived from the backend.
  if (minRevealCount > 0) {
    const cappedTimer = Math.min(timerCount, minRevealCount + 1);
    return Math.max(cappedTimer, minRevealCount);
  }
  // No data yet — timer can show first stage as in-progress (waiting for backend)
  return Math.min(timerCount, 1);
}

// ---------------------------------------------------------------------------
// Minimum spin time hook
// ---------------------------------------------------------------------------

/**
 * Enforces a minimum spin duration per stage. A stage stays "in-progress"
 * for at least `minSpinMs` after it first appeared, even if revealedCount
 * has already moved past it. This gives each step a visible processing feel.
 *
 * Detail text still appears immediately on a spinning stage (StageRow
 * renders `detail` for both in-progress and completed statuses).
 *
 * Returns a function that computes the status for a given stage index.
 */
function useMinSpinStatuses(
  revealedCount: number,
  isStreaming: boolean,
  minSpinMs: number = 1500,
): (idx: number) => 'completed' | 'in-progress' | 'pending' {
  // Track when each stage was first revealed (index → timestamp).
  const revealTimestamps = useRef<number[]>([]);
  // Force re-render to transition spinning → completed after min time.
  const [, setTick] = useState(0);
  const pendingTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Record timestamps for newly revealed stages & schedule re-renders.
  useEffect(() => {
    if (!isStreaming) {
      revealTimestamps.current = [];
      pendingTimers.current.forEach(clearTimeout);
      pendingTimers.current = [];
      return;
    }

    const now = Date.now();
    for (let i = revealTimestamps.current.length; i < revealedCount; i++) {
      revealTimestamps.current[i] = now;
      // Schedule a re-render when this stage's min spin time expires
      // so it can transition from in-progress → completed.
      const timer = setTimeout(() => {
        setTick((n) => n + 1);
      }, minSpinMs + 20); // +20ms buffer for timing jitter
      pendingTimers.current.push(timer);
    }

    return () => {
      // Cleanup only on unmount / streaming stop (handled above)
    };
  }, [revealedCount, isStreaming, minSpinMs]);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      pendingTimers.current.forEach(clearTimeout);
    };
  }, []);

  const getStatus = useCallback(
    (idx: number): 'completed' | 'in-progress' | 'pending' => {
      if (!isStreaming) return 'completed';
      if (idx >= revealedCount) return 'pending';
      // Last revealed stage is always in-progress (current work)
      if (idx === revealedCount - 1) return 'in-progress';
      // Non-last revealed: check if min spin time has elapsed
      const revealedAt = revealTimestamps.current[idx];
      if (revealedAt && Date.now() - revealedAt < minSpinMs) {
        return 'in-progress'; // Still within min spin → keep spinning
      }
      return 'completed';
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [revealedCount, isStreaming, minSpinMs, /* setTick dependency via tick */],
  );

  return getStatus;
}

// ---------------------------------------------------------------------------
// Collapsed summary derivation
// ---------------------------------------------------------------------------

/**
 * Derive a one-line summary from completed stages.
 * Shows flow type + stage count + key details when available.
 */
function deriveCollapsedSummary(stages: ThoughtStage[]): string {
  // Count flow-specific stages (exclude pre-flow resolve/intent and respond)
  const flowStages = stages.filter(
    (s) => s.id !== 'resolve' && s.id !== 'intent' && s.id !== 'respond',
  );
  const stageCount = flowStages.length;

  // Collect detail strings for informative summary
  const details = stages
    .filter((s) => s.detail)
    .map((s) => s.detail!)
    .slice(0, 2); // At most 2 details

  if (stageCount === 0) {
    return `Complete: ${stages.length} steps`;
  }

  const parts = [`${stageCount} stages complete`];
  if (details.length > 0) {
    parts.push(details.join(', '));
  }
  return parts.join(' — ');
}

// ---------------------------------------------------------------------------
// ThoughtProcessPane
// ---------------------------------------------------------------------------

interface ThoughtProcessPaneProps {
  stages: ThoughtStage[];
  /** Whether the agent is still processing (stages animate in progress) */
  isStreaming?: boolean;
  /** If true, pane starts collapsed (historical messages) */
  startCollapsed?: boolean;
  /**
   * Data-driven minimum reveal count. When streaming state shows a stage
   * has completed (e.g. intent populated), this jumps the reveal ahead
   * of the timer so details appear on the correct stage.
   */
  minRevealCount?: number;
}

/**
 * Collapsible pane showing the agent's processing stages.
 *
 * Design decisions (from UAT-4 + Phase 23.3):
 * - Universal: shown on every AI response for a standardized professional feel
 * - During streaming: stages reveal progressively to reflect graph execution
 * - Each stage spins for a minimum time before completing (deliberate feel)
 * - Detail text (live subtitles) appears immediately when available
 * - When all stages complete: collapses to informative one-line summary
 * - User can expand collapsed summary to see full stage list
 * - Historical messages: show collapsed pane, don't hide
 * - Stages derived from flow-declared stage_definitions (dynamic) or graph architecture (static)
 */
export function ThoughtProcessPane({
  stages,
  isStreaming = false,
  startCollapsed = false,
  minRevealCount = 0,
}: ThoughtProcessPaneProps) {
  const [isOpen, setIsOpen] = useState(!startCollapsed && isStreaming);
  const revealedCount = useProgressiveReveal(stages, isStreaming, minRevealCount);
  const getStageStatus = useMinSpinStatuses(revealedCount, isStreaming);

  // Auto-collapse when streaming ends
  useEffect(() => {
    if (!isStreaming && isOpen && !startCollapsed) {
      const timer = setTimeout(() => setIsOpen(false), 800);
      return () => clearTimeout(timer);
    }
  }, [isStreaming]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-open when streaming starts
  useEffect(() => {
    if (isStreaming && stages.length > 0 && !startCollapsed) {
      setIsOpen(true);
    }
  }, [isStreaming, stages.length, startCollapsed]);

  if (stages.length === 0) return null;

  // When not streaming, collapse to one-line summary (user can expand)
  const allComplete = !isStreaming;
  const summaryText = allComplete
    ? deriveCollapsedSummary(stages)
    : 'Thinking...';

  const statusText = isStreaming
    ? 'Thinking...'
    : summaryText;

  return (
    <div
      className="my-1 rounded-md border border-border/60 bg-muted/20"
      data-testid="thought-process-pane"
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
        )}
        <Brain className="h-3 w-3 flex-shrink-0" />
        {allComplete && !isOpen ? (
          <span className="truncate">{summaryText}</span>
        ) : (
          <span>{isStreaming ? 'Thinking...' : `${stages.length} steps`}</span>
        )}
        {isStreaming && (
          <Loader2 className="ml-auto h-3 w-3 animate-spin text-blue-500" />
        )}
        {allComplete && (
          <Check className="ml-auto h-3 w-3 text-emerald-500 flex-shrink-0" />
        )}
      </button>

      {isOpen && (
        <div className="border-t border-border/40 px-3 py-2 space-y-0.5">
          {stages.map((stage, idx) => (
            <StageRow
              key={stage.id}
              stage={stage}
              status={getStageStatus(idx)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ThinkingIndicator - shown during streaming before response arrives
// ---------------------------------------------------------------------------

interface ThinkingIndicatorProps {
  stages: ThoughtStage[];
  /** Data-driven minimum reveal count from streaming state. */
  minRevealCount?: number;
}

/**
 * Standalone thinking indicator shown during streaming before the response arrives.
 * Stages are progressively revealed to reflect the agent's graph execution.
 */
export function ThinkingIndicator({ stages, minRevealCount = 0 }: ThinkingIndicatorProps) {
  if (stages.length === 0) return null;

  return (
    <div className="mr-auto flex w-full items-start gap-2" data-testid="thinking-indicator">
      <div className="flex w-full flex-col gap-2">
        <ThoughtProcessPane stages={stages} isStreaming startCollapsed={false} minRevealCount={minRevealCount} />
      </div>
    </div>
  );
}
