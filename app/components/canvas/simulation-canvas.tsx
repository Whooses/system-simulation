"use client";

import { useCallback } from "react";
import {
  ReactFlow, addEdge, useNodesState, useEdgesState, Controls, Background,
  BackgroundVariant, type Connection as RFConnection, type Node as RFNode, type Edge as RFEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const initialNodes: RFNode[] = [];
const initialEdges: RFEdge[] = [];

export default function SimulationCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (connection: RFConnection) => { setEdges((eds) => addEdge(connection, eds)); },
    [setEdges],
  );

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes} edges={edges}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        onConnect={onConnect} fitView
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      </ReactFlow>
    </div>
  );
}
