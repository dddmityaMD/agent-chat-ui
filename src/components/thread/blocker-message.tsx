'use client';

import { AlertCircle, AlertTriangle, Info, LucideIcon, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { AvailableModel, Blocker, BlockerSeverity } from '@/lib/types';
import { ModelPicker } from './model-picker';

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
  /**
   * Called when the user triggers a recovery action.
   * - For non-LLM_ERROR blockers: called with no args (backward compatible).
   * - For LLM_ERROR "retry": called with "retry".
   * - For LLM_ERROR "switch_model": called with "switch to {provider}:{model}".
   */
  onAction?: (action?: string) => void;
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
 * - Recovery actions for LLM_ERROR: retry button + model picker
 */
export function BlockerMessage({ blocker, onAction }: BlockerMessageProps) {
  const config = severityConfig[blocker.severity];
  const Icon = config.icon;

  const isLLMError = blocker.type === 'LLM_ERROR';
  const hasRecoveryActions = isLLMError && blocker.recovery_actions && blocker.recovery_actions.length > 0;
  const showRetry = hasRecoveryActions && blocker.recovery_actions!.includes('retry');
  const showModelPicker = hasRecoveryActions && blocker.recovery_actions!.includes('switch_model');

  const handleRetry = () => {
    onAction?.('retry');
  };

  const handleModelSelect = (model: AvailableModel) => {
    onAction?.(`switch to ${model.provider}:${model.model}`);
  };

  // Extract current provider from metadata if available (for model picker highlight)
  const currentProvider =
    blocker.metadata && typeof blocker.metadata.provider === 'string'
      ? blocker.metadata.provider
      : undefined;

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

          {/* LLM_ERROR recovery actions */}
          {hasRecoveryActions && (
            <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="llm-recovery-actions">
              {showRetry && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Try Again
                </Button>
              )}
              {showModelPicker && (
                <ModelPicker
                  onSelect={handleModelSelect}
                  currentProvider={currentProvider}
                />
              )}
            </div>
          )}

          {/* Existing next_action button for non-LLM_ERROR blockers (backward compatible) */}
          {!hasRecoveryActions && blocker.next_action && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => onAction?.()}
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
