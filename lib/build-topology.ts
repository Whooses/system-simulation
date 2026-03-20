import { type Node as RFNode, type Edge as RFEdge } from "@xyflow/react";
import { HealthStatus, Protocol } from "@/lib/engine/models";

interface NodeData {
  label: string;
  nodeType: string;
  config: Record<string, unknown>;
}

export function buildTopology(nodes: RFNode[], edges: RFEdge[]) {
  const simNodes = nodes.map((n) => {
    const data = n.data as unknown as NodeData;
    return {
      id: n.id,
      type: data.nodeType,
      label: data.label,
      config: data.config,
      state: {
        queueDepth: 0,
        activeConnections: 0,
        health: HealthStatus.HEALTHY,
        requestCount: 0,
        errorCount: 0,
        totalLatency: 0,
        crashed: false,
      },
      position: n.position,
      connections: edges.filter((e) => e.source === n.id).map((e) => e.id),
    };
  });

  const simConnections = edges.map((e) => ({
    id: e.id,
    sourceNodeId: e.source,
    targetNodeId: e.target,
    protocol: Protocol.HTTP,
    latency: { type: "constant" as const, value: 5 },
    timeout: 5000,
  }));

  return { nodes: simNodes, connections: simConnections };
}
