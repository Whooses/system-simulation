"use client";

import { ReactFlow, Controls, Background, BackgroundVariant,
  type Connection as RFConnection, type Node as RFNode, type Edge as RFEdge,
  type OnNodesChange, type OnEdgesChange } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import SimNode from "./sim-node";
import AnimatedEdge from "./animated-edge";

const nodeTypes = { simNode: SimNode };
const edgeTypes = { animated: AnimatedEdge };

interface SimulationCanvasProps {
  nodes: RFNode[];
  edges: RFEdge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: RFConnection) => void;
  onNodeClick?: (event: unknown, node: RFNode) => void;
}

export default function SimulationCanvas({ nodes, edges, onNodesChange, onEdgesChange, onConnect, onNodeClick }: SimulationCanvasProps) {
  return (
    <div className="h-full w-full">
      <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        onConnect={onConnect} onNodeClick={onNodeClick} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: "animated" }} fitView>
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      </ReactFlow>
    </div>
  );
}
