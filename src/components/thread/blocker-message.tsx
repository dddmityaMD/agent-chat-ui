'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, Info, LucideIcon, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PermissionModal } from '@/components/permission-modal';
import type {
  AvailableModel,
  Blocker,
  BlockerSeverity,
  PermissionBlockerMetadata,
} from '@/lib/types';
import {
  blockerSeverityConfig,
  blockerTypeSeverityOverrides,
} from '@/lib/types';
import { ModelPicker } from './model-picker';

interface SeverityConfig {
  icon: LucideIcon;
  className: string;
}

const severityConfig: Record<BlockerSeverity, SeverityConfig> = {
  INFO: {
    icon: Info,
    className: blockerSeverityConfig.INFO.className,
  },
  WARNING: {
    icon: AlertTriangle,
    className: blockerSeverityConfig.WARNING.className,
  },
  ERROR: {
    icon: AlertCircle,
    className: blockerSeverityConfig.ERROR.className,
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
  const severity = blockerTypeSeverityOverrides[blocker.type] ?? blocker.severity;
  const config = severityConfig[severity];
  const Icon = config.icon;
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const isLLMError = blocker.type === 'LLM_ERROR';
  const isPermissionRequired = blocker.type === 'PERMISSION_REQUIRED';
  const isPolicyViolation = blocker.type === 'POLICY_VIOLATION';
  const hasRecoveryActions = isLLMError && blocker.recovery_actions && blocker.recovery_actions.length > 0;
  const showRetry = hasRecoveryActions && blocker.recovery_actions!.includes('retry');
  const showModelPicker = hasRecoveryActions && blocker.recovery_actions!.includes('switch_model');

  const permissionMetadata = useMemo<PermissionBlockerMetadata>(() => {
    if (!blocker.metadata || typeof blocker.metadata !== 'object') return {};
    return blocker.metadata as PermissionBlockerMetadata;
  }, [blocker.metadata]);

  useEffect(() => {
    if (isPermissionRequired && !permissionGranted) {
      setPermissionModalOpen(true);
    }
  }, [isPermissionRequired, permissionGranted]);

  const handleRetry = () => {
    onAction?.('retry');
  };

  const handleModelSelect = (model: AvailableModel) => {
    onAction?.(`switch to ${model.provider}:${model.model}`);
  };

  const handlePermissionGrant = ({
    scope,
    reason,
    pending_action_id,
  }: {
    scope: string;
    reason: string | null;
    pending_action_id: string | null;
  }) => {
    const reasonText = reason ? ` reason="${reason.replace(/"/g, '\\"')}"` : '';
    const pendingActionText = pending_action_id ? ` pending_action_id=${pending_action_id}` : '';
    onAction?.(`grant write scope=${scope}${pendingActionText}${reasonText}`);
    setPermissionGranted(true);
    setPermissionModalOpen(false);
  };

  const handlePermissionDeny = () => {
    const pendingActionText = permissionMetadata.pending_action_id
      ? ` pending_action_id=${permissionMetadata.pending_action_id}`
      : '';
    onAction?.(`deny write${pendingActionText}`);
    setPermissionModalOpen(false);
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

          {isPermissionRequired && permissionMetadata.summary && (
            <p className="mt-2 text-sm font-medium text-amber-800 dark:text-amber-200">
              {permissionMetadata.summary}
            </p>
          )}

          {isPolicyViolation && (
            <div className="mt-2 rounded-md border border-red-200 bg-red-50/70 p-2 text-sm dark:border-red-800 dark:bg-red-900/20">
              <p>
                <span className="font-semibold">Rule violated:</span>{' '}
                {permissionMetadata.rule_violated || 'Policy restriction triggered'}
              </p>
              <p className="mt-1">
                <span className="font-semibold">Suggestion:</span>{' '}
                {permissionMetadata.suggestion || 'Rephrase the request with read-only intent.'}
              </p>
            </div>
          )}

          {isPermissionRequired && permissionGranted && (
            <div className="mt-3 rounded-md border border-amber-300 bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900">
              WRITE granted -- executing...
            </div>
          )}

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
          {!hasRecoveryActions && blocker.next_action && !isPermissionRequired && !isPolicyViolation && (
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

      {isPermissionRequired && (
        <PermissionModal
          isOpen={permissionModalOpen}
          onClose={() => setPermissionModalOpen(false)}
          blockerMetadata={permissionMetadata}
          onGrant={handlePermissionGrant}
          onDeny={handlePermissionDeny}
        />
      )}
    </div>
  );
}

export default BlockerMessage;
