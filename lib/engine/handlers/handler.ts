import { SimulationNode, SimEvent } from "../models";
import { SimContext } from "../sim-context";

/**
 * Contract that every node-type handler must implement.
 *
 * The engine calls {@link onEvent} for each event routed to a node.
 * The handler processes the event and returns zero or more follow-on
 * events to be enqueued.
 */
export interface NodeHandler {
  /** Process an incoming event and return any new events to schedule. */
  onEvent(node: SimulationNode, event: SimEvent, context: SimContext): SimEvent[];
}
