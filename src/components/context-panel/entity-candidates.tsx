"use client";

/**
 * Entity Candidates - Entity resolution results display.
 *
 * Shows selected entity highlighted (green border/background),
 * alternative candidates with similarity scores, entity type badges
 * with deterministic namespace-derived colors, and canonical keys
 * in monospace.
 */

import { cn } from "@/lib/utils";

interface EntityCandidate {
  node_id: string;
  canonical_key: string;
  name: string;
  entity_type: string;
  score: number;
  selected: boolean;
}

interface EntityCandidatesProps {
  entityCandidates: EntityCandidate[];
  focusEntities: Array<Record<string, unknown>>;
  resolvedEntities: Record<string, unknown>;
}

/** Deterministic badge color from entity type namespace. */
function getTypeBadgeColor(type: string): string {
  const namespace = type.split(".")[0] || type;
  const palette = [
    "bg-blue-100 text-blue-800",
    "bg-orange-100 text-orange-800",
    "bg-emerald-100 text-emerald-800",
    "bg-indigo-100 text-indigo-800",
    "bg-teal-100 text-teal-800",
    "bg-purple-100 text-purple-800",
    "bg-rose-100 text-rose-800",
    "bg-amber-100 text-amber-800",
  ];
  let hash = 0;
  for (let i = 0; i < namespace.length; i++) {
    hash = ((hash << 5) - hash + namespace.charCodeAt(i)) | 0;
  }
  return palette[Math.abs(hash) % palette.length];
}

function TypeBadge({ type }: { type: string }) {
  const color = getTypeBadgeColor(type);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        color,
      )}
    >
      {type}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(Math.max(score * 100, 0), 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-gray-200">
        <div
          className={cn(
            "h-1.5 rounded-full",
            pct >= 80
              ? "bg-green-500"
              : pct >= 50
                ? "bg-yellow-500"
                : "bg-red-400",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-muted-foreground text-xs">{score.toFixed(2)}</span>
    </div>
  );
}

export function EntityCandidates({
  entityCandidates,
  focusEntities,
}: EntityCandidatesProps) {
  if (entityCandidates.length === 0 && focusEntities.length === 0) {
    return null;
  }

  const selected = entityCandidates.filter((c) => c.selected);
  const alternatives = entityCandidates.filter((c) => !c.selected);

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">Entity Resolution</h3>

      {/* Focus entities */}
      {focusEntities.length > 0 && (
        <div className="mb-2">
          <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
            Focus Entities
          </p>
          <div className="flex flex-wrap gap-1">
            {focusEntities.map((fe, i) => {
              const name =
                typeof fe.name === "string"
                  ? fe.name
                  : typeof fe.canonical_key === "string"
                    ? fe.canonical_key
                    : `entity-${i}`;
              return (
                <span
                  key={name}
                  className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800"
                >
                  {name}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected entities */}
      {selected.map((candidate) => (
        <div
          key={candidate.node_id}
          className="mb-2 rounded-md border-2 border-green-300 bg-green-50 p-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-green-700 uppercase">
                Selected
              </span>
              <span className="text-sm font-medium">{candidate.name}</span>
              <TypeBadge type={candidate.entity_type} />
            </div>
            <ScoreBar score={candidate.score} />
          </div>
          <p className="mt-1 font-mono text-xs text-gray-500">
            {candidate.canonical_key}
          </p>
        </div>
      ))}

      {/* Alternative candidates */}
      {alternatives.length > 0 && (
        <div>
          <p className="text-muted-foreground mb-1 text-xs font-medium">
            Alternatives
          </p>
          <div className="flex flex-col gap-1">
            {alternatives.map((candidate) => (
              <div
                key={candidate.node_id}
                className="flex items-center justify-between rounded-md border border-gray-200 px-2 py-1.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{candidate.name}</span>
                  <TypeBadge type={candidate.entity_type} />
                </div>
                <ScoreBar score={candidate.score} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
