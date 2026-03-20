"use client";

import { useState, useCallback, useRef, type DragEvent, type Dispatch, type SetStateAction } from "react";
import {
  addEdge,
  type Connection as RFConnection,
  type Node as RFNode,
  type Edge as RFEdge,
} from "@xyflow/react";
import { getNodeDefinition } from "@/lib/node-defaults";
import { NodeType, type NodeConfig } from "@/lib/engine/models";
import { type NodeData } from "./Canvas.types";

export function useCanvas(
  setNodes: Dispatch<SetStateAction<RFNode[]>>,
  setEdges: Dispatch<SetStateAction<RFEdge[]>>,
) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const onConnect = useCallback(
    (connection: RFConnection) => {
      setEdges((eds) => addEdge({ ...connection, type: "animated" }, eds));
    },
    [setEdges]
  );

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/reactflow-type") as NodeType;
      if (!type) return;

      const def = getNodeDefinition(type);
      if (!def) return;

      const bounds = wrapperRef.current?.getBoundingClientRect();
      const position = {
        x: e.clientX - (bounds?.left ?? 0) - 70,
        y: e.clientY - (bounds?.top ?? 0) - 20,
      };

      const newNode: RFNode = {
        id: `${type}-${Date.now()}`,
        type: "simNode",
        position,
        data: { label: def.label, nodeType: type, config: def.defaultConfig } as NodeData,
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes]
  );

  const onNodeClick = useCallback((_: unknown, node: RFNode) => {
    setSelectedNodeId(node.id);
  }, []);

  const updateNodeConfig = useCallback(
    (id: string, config: Partial<NodeConfig>) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== id) return n;
          const data = n.data as NodeData;
          return { ...n, data: { ...data, config: { ...data.config, ...config } } };
        })
      );
    },
    [setNodes]
  );

  return {
    wrapperRef,
    onConnect,
    onDragOver,
    onDrop,
    onNodeClick,
    selectedNodeId,
    setSelectedNodeId,
    updateNodeConfig,
  };
}
