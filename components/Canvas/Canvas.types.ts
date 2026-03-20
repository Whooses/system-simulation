import { NodeType, type NodeConfig } from "@/lib/engine/models";

/** Data payload attached to each React Flow node on the canvas. */
export interface NodeData extends Record<string, unknown> {
  label: string;
  nodeType: NodeType;
  config: NodeConfig;
}
