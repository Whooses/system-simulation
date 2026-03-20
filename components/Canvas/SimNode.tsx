"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { NodeType, HealthStatus } from "@/lib/engine/models";
import { getNodeDefinition } from "@/lib/node-defaults";

interface SimNodeData {
  label: string;
  nodeType: NodeType;
  health?: HealthStatus;
  requestCount?: number;
  errorRate?: number;
  avgLatency?: number;
  queueDepth?: number;
}

export default function SimNode({ data }: NodeProps) {
  const nodeData = data as unknown as SimNodeData;
  const def = getNodeDefinition(nodeData.nodeType);
  const color = def?.color ?? "#666";

  const healthColor =
    nodeData.health === HealthStatus.UNHEALTHY ? "#ef4444" :
    nodeData.health === HealthStatus.DEGRADED ? "#f59e0b" : "#22c55e";

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-lg"
      style={{ borderTopColor: color, borderTopWidth: 3, minWidth: 140 }}>
      <Handle type="target" position={Position.Left} className="!bg-zinc-500" />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-zinc-100">{nodeData.label}</span>
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: healthColor }} />
      </div>
      <p className="text-[10px] text-zinc-500">{def?.label ?? nodeData.nodeType}</p>
      {nodeData.requestCount !== undefined && (
        <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-zinc-400">
          <span>reqs: {nodeData.requestCount}</span>
          <span>err: {((nodeData.errorRate ?? 0) * 100).toFixed(1)}%</span>
          <span>lat: {(nodeData.avgLatency ?? 0).toFixed(1)}ms</span>
          <span>q: {nodeData.queueDepth ?? 0}</span>
        </div>
      )}
      <Handle type="source" position={Position.Right} className="!bg-zinc-500" />
    </div>
  );
}
