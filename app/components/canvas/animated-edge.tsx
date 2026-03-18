"use client";

import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";

export default function AnimatedEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd,
}: EdgeProps) {
  const [edgePath] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      <circle r="4" fill="#22c55e" opacity="0.8">
        <animateMotion dur="1.5s" repeatCount="indefinite" path={edgePath} />
      </circle>
    </>
  );
}
