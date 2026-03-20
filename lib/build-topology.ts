import { type Node as RFNode, type Edge as RFEdge } from "@xyflow/react";
import { HealthStatus, Protocol } from "@/lib/engine/models";

// === Types ===

interface NodeData {
  label: string;
  nodeType: string;
  config: Record<string, unknown>;
}

// === Builder ===

/**
 * Convert React Flow nodes and edges into the engine's simulation topology.
 *
 * Maps each RF node to a {@link SimulationNode} with fresh state, and
 * each RF edge to a {@link Connection} with default HTTP/5ms settings.
 * Called before POST /api/simulation/create to prepare the payload.
 */
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
      // Each node tracks its outgoing edge IDs
      connections: edges.filter((e) => e.source === n.id).map((e) => e.id),
    };
  });

  const simConnections = edges.map((e) => ({
    id: e.id,
    sourceNodeId: e.source,
    targetNodeId: e.target,
    protocol: Protocol.HTTP,
    latency: { type: "constant" as const, value: 5 }, // Default 5ms connection latency
    timeout: 5000,
  }));

  return { nodes: simNodes, connections: simConnections };
}
