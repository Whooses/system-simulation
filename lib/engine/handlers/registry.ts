import { NodeType } from "../models";
import { NodeHandler } from "./handler";

const handlers = new Map<NodeType, NodeHandler>();

export function registerHandler(type: NodeType, handler: NodeHandler): void {
  handlers.set(type, handler);
}

export function getHandler(type: NodeType): NodeHandler {
  const handler = handlers.get(type);
  if (!handler) throw new Error(`No handler registered for node type: ${type}`);
  return handler;
}
