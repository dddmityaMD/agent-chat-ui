'use client';

import { AlertCircle, AlertTriangle, Info, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { Blocker, BlockerSeverity } from '@/lib/types';

interface SeverityConfig {
  icon: LucideIcon;
  className: string;
}

const severityConfig: Record<BlockerSeverity, SeverityConfig> = {
  INFO: {
    icon: Info,
    className: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200',
  },
  WARNING: {
    icon: AlertTriangle,
    className: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-200',
  },
  ERROR: {
    icon: AlertCircle,
    className: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200',
  },
};

interface BlockerMessageProps {
  blocker: Blocker;
  onAction?: () => void;
}

/**
 * BlockerMessage renders a blocker with severity-appropriate styling.
 *
 * Shows:
 * - Icon based on severity (info, warning, error)
 * - Main message
 * - Recovery hint
 * - "What I tried" expandable section
 * - Action button (if next_action provided)
 */
export function BlockerMessage({ blocker, onAction }: BlockerMessageProps) {
  const config = severityConfig[blocker.severity];
  const Icon = config.icon;

  return (
    <div
      data-testid="blocker-message"
      className={cn('rounded-lg border p-4 my-2', config.className)}
    >
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium">{blocker.message}</p>
          <p className="mt-1 text-sm opacity-90">{blocker.hint}</p>

          {blocker.what_i_tried && blocker.what_i_tried.length > 0 && (
            <details className="mt-2">
              <summary className="text-xs cursor-pointer hover:underline">
                What I tried
              </summary>
              <ul className="mt-1 text-xs list-disc list-inside opacity-75 space-y-0.5">
                {blocker.what_i_tried.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </details>
          )}

          {blocker.next_action && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={onAction}
            >
              {blocker.next_action}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default BlockerMessage;
