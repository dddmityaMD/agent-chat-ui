'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AvailableModel } from '@/lib/types';

/**
 * Resolve the Cases API base URL.
 * Mirrors the pattern in Cases.tsx / LLMHealth.tsx.
 */
function getBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_CASES_API_URL;

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (
      envUrl &&
      envUrl.includes('localhost') &&
      host !== 'localhost' &&
      host !== '127.0.0.1'
    ) {
      return 'http://api:8000';
    }
  }

  return (envUrl || 'http://localhost:8000').replace(/\/$/, '');
}

interface ModelPickerProps {
  onSelect: (model: AvailableModel) => void;
  currentProvider?: string;
}

/**
 * ModelPicker -- dropdown showing available LLM models fetched from
 * GET /api/llm/models. Displays "model (Provider)" for each option.
 */
export function ModelPicker({ onSelect, currentProvider }: ModelPickerProps) {
  const [models, setModels] = useState<AvailableModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchModels() {
      try {
        const res = await fetch(`${getBaseUrl()}/api/llm/models`);
        if (!res.ok) return;
        const data = (await res.json()) as AvailableModel[];
        if (!cancelled) {
          setModels(data);
        }
      } catch {
        // Silently ignore -- picker will show "No models" state
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchModels();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const idx = parseInt(e.target.value, 10);
      if (!isNaN(idx) && models[idx]) {
        onSelect(models[idx]);
      }
    },
    [models, onSelect],
  );

  if (loading) {
    return (
      <span className="text-xs opacity-60">Loading models...</span>
    );
  }

  if (models.length === 0) {
    return (
      <span className="text-xs opacity-60">No alternative models available</span>
    );
  }

  return (
    <select
      data-testid="model-picker"
      className="rounded-md border border-current/20 bg-white px-2 py-1 text-sm dark:bg-gray-900"
      defaultValue=""
      onChange={handleChange}
    >
      <option value="" disabled>
        Switch model...
      </option>
      {models.map((m, idx) => {
        const isCurrent =
          currentProvider &&
          m.provider.toLowerCase() === currentProvider.toLowerCase() &&
          m.is_primary;
        const label = `${m.model} (${m.provider})${m.is_primary ? ' [primary]' : ''}${m.is_fallback ? ' [fallback]' : ''}`;
        return (
          <option key={`${m.provider}-${m.model}-${idx}`} value={idx} disabled={!!isCurrent}>
            {isCurrent ? `${label} (current)` : label}
          </option>
        );
      })}
    </select>
  );
}

export default ModelPicker;
