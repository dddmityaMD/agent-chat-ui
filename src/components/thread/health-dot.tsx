'use client';

import { useLLMHealth, OverallStatus } from '@/providers/LLMHealth';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/** Map overall status to a Tailwind color class */
const statusColors: Record<OverallStatus, string> = {
  healthy: 'bg-green-500',
  degraded: 'bg-yellow-500',
  unhealthy: 'bg-red-500',
};

/** Capitalize first letter for display */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * HealthDot -- 8x8px colored circle showing LLM provider health.
 *
 * Green = healthy, Yellow = degraded, Red = unhealthy.
 * Hover tooltip shows per-provider details.
 * Red status triggers a subtle pulse animation.
 */
export function HealthDot() {
  const { statuses, overallStatus } = useLLMHealth();
  const entries = Object.entries(statuses);

  const colorClass = statusColors[overallStatus];
  const isUnhealthy = overallStatus === 'unhealthy';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          data-testid="health-dot"
          className={`inline-block h-2 w-2 shrink-0 rounded-full ${colorClass} ${isUnhealthy ? 'animate-pulse' : ''}`}
          role="status"
          aria-label={`LLM health: ${overallStatus}`}
        />
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {entries.length === 0 ? (
          <p className="text-xs">No provider data</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {entries.map(([provider, health]) => (
              <p key={provider} className="text-xs">
                {capitalize(provider)}: {health.status}
                {health.last_error ? ` -- ${health.last_error}` : ''}
              </p>
            ))}
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

export default HealthDot;
