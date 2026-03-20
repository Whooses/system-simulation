import { NodeType } from "../models";
import { NodeHandler } from "./handler";

/**
 * Global handler registry mapping each {@link NodeType} to its handler instance.
 * Populated at startup by {@link registerAllHandlers}.
 */
const handlers = new Map<NodeType, NodeHandler>();

/** Register a handler for a given node type. */
export function registerHandler(type: NodeType, handler: NodeHandler): void {
  handlers.set(type, handler);
}

/** Retrieve the handler for a node type. Throws if none is registered. */
export function getHandler(type: NodeType): NodeHandler {
  const handler = handlers.get(type);
  if (!handler) throw new Error(`No handler registered for node type: ${type}`);
  return handler;
}
