'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { DisambiguationPayload, DisambiguationSelection } from '@/lib/types';

interface DisambiguationCardProps {
  payload: DisambiguationPayload;
  onSelect: (selection: DisambiguationSelection) => void;
}

/**
 * DisambiguationCard shows entity disambiguation options to the user.
 *
 * Per CONTEXT.md: up to 4 clickable options + free text input.
 * User can either click an option or type a clarification.
 */
export function DisambiguationCard({ payload, onSelect }: DisambiguationCardProps) {
  const [freeText, setFreeText] = useState('');

  const handleOptionClick = (index: number) => {
    onSelect({ index });
  };

  const handleFreeTextSubmit = () => {
    if (freeText.trim()) {
      onSelect({ freeText: freeText.trim() });
      setFreeText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && freeText.trim()) {
      e.preventDefault();
      handleFreeTextSubmit();
    }
  };

  return (
    <div
      data-testid="disambiguation-card"
      className="rounded-lg border border-blue-200 bg-blue-50 p-4 my-2 dark:border-blue-800 dark:bg-blue-950"
    >
      <p className="font-medium text-blue-900 dark:text-blue-100 mb-3">
        {payload.question}
      </p>
      <div className="space-y-2">
        {payload.options.map((opt) => (
          <Button
            key={opt.index}
            variant="outline"
            className="w-full justify-start text-left h-auto py-2 px-3 bg-white dark:bg-blue-900 hover:bg-blue-100 dark:hover:bg-blue-800 border-blue-200 dark:border-blue-700"
            onClick={() => handleOptionClick(opt.index)}
          >
            <div className="flex flex-col items-start gap-0.5 w-full">
              <div className="flex items-center gap-2 w-full">
                <span className="font-medium text-blue-900 dark:text-blue-100">
                  {opt.index}. {opt.label}
                </span>
                <span className="text-gray-500 dark:text-gray-400 text-sm">
                  ({opt.type_label})
                </span>
              </div>
              {opt.context_hint && (
                <span className="text-gray-400 dark:text-gray-500 text-xs">
                  {opt.context_hint}
                </span>
              )}
            </div>
          </Button>
        ))}

        {payload.allow_free_text && (
          <div className="flex gap-2 mt-3 pt-2 border-t border-blue-200 dark:border-blue-700">
            <Input
              placeholder="Or type something else..."
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-white dark:bg-blue-900 border-blue-200 dark:border-blue-700"
            />
            <Button
              variant="secondary"
              disabled={!freeText.trim()}
              onClick={handleFreeTextSubmit}
              className="bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300 dark:bg-blue-500 dark:hover:bg-blue-600 dark:disabled:bg-blue-800"
            >
              Submit
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default DisambiguationCard;
