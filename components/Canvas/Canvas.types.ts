import { NodeType, type NodeConfig } from "@/lib/engine/models";

export interface NodeData extends Record<string, unknown> {
  label: string;
  nodeType: NodeType;
  config: NodeConfig;
}
