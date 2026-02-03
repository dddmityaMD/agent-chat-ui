/**
 * Custom animated edge for lineage graph.
 *
 * Renders a path with animated dashes flowing in the data direction
 * (from source to target). Uses SVG strokeDasharray with CSS animation.
 */
import React, { memo } from "react";
import {
  BaseEdge,
  getSmoothStepPath,
} from "@xyflow/react";
import type { EdgeProps } from "@xyflow/react";

function AnimatedEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  data,
  markerEnd,
}: EdgeProps) {
  const edgeColor = (data?.color as string) ?? "#94a3b8"; // slate-400

  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  });

  return (
    <>
      {/* Background path for hover area */}
      <BaseEdge
        id={`${id}-bg`}
        path={edgePath}
        style={{
          stroke: "transparent",
          strokeWidth: 12,
        }}
      />
      {/* Visible animated path */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={edgeColor}
        strokeWidth={1.5}
        strokeDasharray="6 4"
        markerEnd={markerEnd}
        style={{
          ...style,
          animation: "lineage-flow 1s linear infinite",
        }}
      />
      <style>{`
        @keyframes lineage-flow {
          to {
            stroke-dashoffset: -10;
          }
        }
      `}</style>
    </>
  );
}

export const AnimatedEdge = memo(AnimatedEdgeComponent);
