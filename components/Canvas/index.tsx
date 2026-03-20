"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";
import { ReactFlow, Controls, Background, BackgroundVariant,
  type Node as RFNode, type Edge as RFEdge, type OnNodesChange, type OnEdgesChange } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import SimNode from "./SimNode";
import AnimatedEdge from "./AnimatedEdge";
import { useCanvas } from "./useCanvas";

// === Custom Node/Edge Registration ===

const nodeTypes = { simNode: SimNode };
const edgeTypes = { animated: AnimatedEdge };

// === Types ===

interface CanvasProps {
  nodes: RFNode[];
  edges: RFEdge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  setNodes: Dispatch<SetStateAction<RFNode[]>>;
  setEdges: Dispatch<SetStateAction<RFEdge[]>>;
  onNodeSelect: (node: RFNode | undefined) => void;
}

/**
 * Interactive node-graph canvas powered by React Flow.
 * Supports drag-and-drop node creation, edge wiring, and node selection.
 */
export default function Canvas({
  nodes, edges, onNodesChange, onEdgesChange,
  setNodes, setEdges, onNodeSelect,
}: CanvasProps) {
  const { wrapperRef, onConnect, onDragOver, onDrop } = useCanvas(setNodes, setEdges);

  const handleNodeClick = useCallback((_: unknown, node: RFNode) => {
    onNodeSelect(node);
  }, [onNodeSelect]);

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
