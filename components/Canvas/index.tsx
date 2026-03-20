"use client";

import { type Dispatch, type SetStateAction } from "react";
import { ReactFlow, Controls, Background, BackgroundVariant,
  type Node as RFNode, type Edge as RFEdge, type OnNodesChange, type OnEdgesChange } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import SimNode from "./SimNode";
import AnimatedEdge from "./AnimatedEdge";
import { useCanvas } from "./useCanvas";

const nodeTypes = { simNode: SimNode };
const edgeTypes = { animated: AnimatedEdge };

interface CanvasProps {
  nodes: RFNode[];
  edges: RFEdge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  setNodes: Dispatch<SetStateAction<RFNode[]>>;
  setEdges: Dispatch<SetStateAction<RFEdge[]>>;
  onNodeSelect: (node: RFNode | undefined) => void;
}

export default function Canvas({
  nodes, edges, onNodesChange, onEdgesChange,
  setNodes, setEdges, onNodeSelect,
}: CanvasProps) {
  const { wrapperRef, onConnect, onDragOver, onDrop, onNodeClick } = useCanvas(setNodes, setEdges);

  const handleNodeClick = (_: unknown, node: RFNode) => {
    onNodeClick(_, node);
    onNodeSelect(node);
  };

  return (
    <main ref={wrapperRef} className="flex-1" onDragOver={onDragOver} onDrop={onDrop}>
      <div className="h-full w-full">
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onConnect={onConnect} onNodeClick={handleNodeClick} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
          defaultEdgeOptions={{ type: "animated" }} fitView>
          <Controls />
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        </ReactFlow>
      </div>
    </main>
  );
}
