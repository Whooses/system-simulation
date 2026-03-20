"use client";

import { NodeType, type NodeConfig, type BaseNodeConfig } from "@/lib/engine/models";
import { getNodeDefinition } from "@/lib/node-defaults";

// === Types ===

interface NodeConfigPanelProps {
  nodeId: string;
  nodeType: NodeType;
  config: NodeConfig;
  onConfigChange: (nodeId: string, config: Partial<NodeConfig>) => void;
  onClose: () => void;
}

/** Describes a single editable field in the config panel. */
interface ConfigField {
  key: string;
  label: string;
  type: "number" | "range" | "select";
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: string }[];
}

// === Field Definitions ===

/** Return the editable config fields for a given node type (base fields + type-specific extras). */
function getFieldsForType(nodeType: NodeType): ConfigField[] {
  const base: ConfigField[] = [
    { key: "concurrencyLimit", label: "Concurrency Limit", type: "number", min: 1, max: 10000 },
    { key: "maxQueueSize", label: "Max Queue Size", type: "number", min: 0, max: 100000 },
    { key: "errorRate", label: "Error Rate", type: "range", min: 0, max: 1, step: 0.01 },
  ];

  const extra: Record<string, ConfigField[]> = {
    [NodeType.CLIENT]: [
      { key: "requestRate", label: "Request Rate (rps)", type: "number", min: 1, max: 10000 },
    ],
    [NodeType.LOAD_BALANCER]: [
      { key: "strategy", label: "Strategy", type: "select", options: [
        { label: "Round Robin", value: "round-robin" },
        { label: "Least Connections", value: "least-connections" },
        { label: "IP Hash", value: "ip-hash" },
      ]},
      { key: "maxConnections", label: "Max Connections", type: "number", min: 1, max: 100000 },
      { key: "healthCheckInterval", label: "Health Check Interval (ms)", type: "number", min: 100, max: 60000 },
    ],
    [NodeType.DISTRIBUTED_CACHE]: [
      { key: "hitRate", label: "Hit Rate", type: "range", min: 0, max: 1, step: 0.01 },
      { key: "capacity", label: "Capacity", type: "number", min: 100, max: 10000000 },
      { key: "ttl", label: "TTL (ms)", type: "number", min: 1000, max: 86400000 },
    ],
    [NodeType.SQL_DB]: [
      { key: "connectionPoolSize", label: "Connection Pool Size", type: "number", min: 1, max: 1000 },
      { key: "maxIOPS", label: "Max IOPS", type: "number", min: 100, max: 100000 },
    ],
    [NodeType.NOSQL_DB]: [
      { key: "partitionCount", label: "Partition Count", type: "number", min: 1, max: 256 },
      { key: "consistencyModel", label: "Consistency", type: "select", options: [
        { label: "Eventual", value: "eventual" }, { label: "Strong", value: "strong" },
      ]},
    ],
    [NodeType.MESSAGE_QUEUE]: [
      { key: "maxDepth", label: "Max Queue Depth", type: "number", min: 100, max: 10000000 },
      { key: "consumerThroughput", label: "Consumer Throughput", type: "number", min: 1, max: 100000 },
    ],
    [NodeType.API_GATEWAY]: [
      { key: "rateLimit", label: "Rate Limit (rps)", type: "number", min: 0, max: 100000 },
    ],
  };

  return [...base, ...(extra[nodeType] ?? [])];
}

// === Component ===

/**
 * Right sidebar panel for editing a selected node's configuration.
 * Renders dynamic form fields based on the node type.
 * Changes are applied immediately (live hot-patching if simulation is running).
 */
export default function NodeConfigPanel({ nodeId, nodeType, config, onConfigChange, onClose }: NodeConfigPanelProps) {
  const def = getNodeDefinition(nodeType);
  const fields = getFieldsForType(nodeType);

  const handleChange = (key: string, value: string | number) => {
    onConfigChange(nodeId, { [key]: value } as Partial<NodeConfig>);
  };

  return (
    <div className="flex h-full w-72 flex-col border-l border-zinc-800 bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">{def?.label ?? nodeType}</h3>
          <p className="text-[10px] text-zinc-500">{nodeId}</p>
        </div>
        <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4">
          {fields.map((field) => {
            const value = (config as unknown as Record<string, unknown>)[field.key];
            return (
              <div key={field.key} className="flex flex-col gap-1">
                <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{field.label}</label>
                {field.type === "select" ? (
                  <select className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-300"
                    value={String(value ?? "")} onChange={(e) => handleChange(field.key, e.target.value)}>
                    {field.options?.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                ) : field.type === "range" ? (
                  <div className="flex items-center gap-2">
                    <input type="range" className="flex-1" min={field.min} max={field.max} step={field.step}
                      value={Number(value ?? 0)} onChange={(e) => handleChange(field.key, Number(e.target.value))} />
                    <span className="w-12 text-right text-xs text-zinc-400">{Number(value ?? 0).toFixed(2)}</span>
                  </div>
                ) : (
                  <input type="number" className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-300"
                    min={field.min} max={field.max} step={field.step ?? 1}
                    value={Number(value ?? 0)} onChange={(e) => handleChange(field.key, Number(e.target.value))} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
