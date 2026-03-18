"use client";

import { useCallback } from "react";
import {
  ReactFlow, addEdge, useNodesState, useEdgesState, Controls, Background,
  BackgroundVariant, type Connection as RFConnection, type Node as RFNode, type Edge as RFEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import SimNode from "./sim-node";
import AnimatedEdge from "./animated-edge";

const initialNodes: RFNode[] = [];
const initialEdges: RFEdge[] = [];
const nodeTypes = { simNode: SimNode };
const edgeTypes = { animated: AnimatedEdge };

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
        onConnect={onConnect} fitView nodeTypes={nodeTypes} edgeTypes={edgeTypes} defaultEdgeOptions={{ type: "animated" }}
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      </ReactFlow>
    </div>
  );
}
