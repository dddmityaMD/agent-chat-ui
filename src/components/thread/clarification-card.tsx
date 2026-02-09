'use client';

import { CheckCircle2, HelpCircle } from 'lucide-react';

// --- Types ---

export interface ClarificationOption {
  /** Display text for the option */
  label: string;
  /** Message to send when clicked */
  value: string;
  /** Brief explanation of what this option means */
  description?: string;
}

export interface ClarificationData {
  /** What the agent is confident about */
  understood: string[];
  /** What needs clarification */
  ambiguous: string[];
  /** Clickable clarification choices */
  options: ClarificationOption[];
}

interface ClarificationCardProps {
  data: ClarificationData;
  /** Called when user clicks an option; sends value as message */
  onSelect: (value: string) => void;
}

// --- Helper ---

/**
 * Extract clarification data from sais_ui.clarification.
 * Returns null if absent or malformed.
 */
export function getClarification(saisUi?: unknown): ClarificationData | null {
  if (!saisUi || typeof saisUi !== 'object') return null;
  const obj = saisUi as Record<string, unknown>;
  const clar = obj.clarification;
  if (!clar || typeof clar !== 'object') return null;
  const c = clar as Record<string, unknown>;

  // Validate required arrays
  if (!Array.isArray(c.understood) || !Array.isArray(c.ambiguous) || !Array.isArray(c.options)) {
    return null;
  }

  // Validate options have label and value
  const validOptions = c.options.every(
    (opt: unknown) =>
      opt &&
      typeof opt === 'object' &&
      typeof (opt as Record<string, unknown>).label === 'string' &&
      typeof (opt as Record<string, unknown>).value === 'string',
  );
  if (!validOptions) return null;

  return {
    understood: c.understood as string[],
    ambiguous: c.ambiguous as string[],
    options: c.options as ClarificationOption[],
  };
}

// --- Component ---

/**
 * ClarificationCard renders a structured clarification request from the agent.
 *
 * Shows what the agent understood (green), what is ambiguous (yellow),
 * and clickable options for the user to clarify. No text parsing fallback --
 * clarification is a deterministic backend contract (sais_ui.clarification).
 */
export function ClarificationCard({ data, onSelect }: ClarificationCardProps) {
  return (
    <div
      data-testid="clarification-card"
      className="my-2 rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-950"
    >
      {/* What I understood */}
      {data.understood.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-sm font-medium text-green-700 dark:text-green-400">
            What I understood
          </p>
          <ul className="space-y-1">
            {data.understood.map((item, idx) => (
              <li
                key={`understood-${idx}`}
                className="flex items-start gap-2 text-sm text-green-800 dark:text-green-300"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500 dark:text-green-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* What's ambiguous */}
      {data.ambiguous.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-sm font-medium text-yellow-700 dark:text-yellow-400">
            What needs clarification
          </p>
          <ul className="space-y-1">
            {data.ambiguous.map((item, idx) => (
              <li
                key={`ambiguous-${idx}`}
                className="flex items-start gap-2 text-sm text-yellow-800 dark:text-yellow-300"
              >
                <HelpCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-500 dark:text-yellow-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Clickable options */}
      {data.options.length > 0 && (
        <div className="mt-3 border-t border-purple-200 pt-3 dark:border-purple-700">
          <p className="mb-2 text-sm font-medium text-purple-700 dark:text-purple-300">
            Choose a clarification
          </p>
          <div className="flex flex-wrap gap-2">
            {data.options.map((opt, idx) => (
              <button
                key={`option-${idx}`}
                type="button"
                onClick={() => onSelect(opt.value)}
                className="inline-flex flex-col items-start rounded-full border border-purple-300 bg-white px-3 py-1.5 text-left text-sm font-medium text-purple-700 transition-colors hover:bg-purple-100 dark:border-purple-600 dark:bg-purple-900 dark:text-purple-200 dark:hover:bg-purple-800"
                data-testid="clarification-option"
                title={opt.description}
              >
                <span>{opt.label}</span>
                {opt.description && (
                  <span className="text-xs font-normal text-purple-500 dark:text-purple-400">
                    {opt.description}
                  </span>
                )}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-purple-400 dark:text-purple-500">
            Or type your own clarification below
          </p>
        </div>
      )}
    </div>
  );
}

export default ClarificationCard;
