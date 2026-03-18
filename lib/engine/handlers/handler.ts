import { SimulationNode, SimEvent } from "../models";
import { SimContext } from "../sim-context";

export interface NodeHandler {
  onEvent(node: SimulationNode, event: SimEvent, context: SimContext): SimEvent[];
}
