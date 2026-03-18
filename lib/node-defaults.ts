import { NodeType, type NodeConfig, type BaseNodeConfig } from "./engine/models";

interface NodeDefinition {
  type: NodeType;
  label: string;
  category: string;
  color: string;
  defaultConfig: NodeConfig;
}

const base: BaseNodeConfig = {
  concurrencyLimit: 100, maxQueueSize: 1000,
  processingLatency: { type: "constant", value: 5 }, errorRate: 0,
};

export const NODE_DEFINITIONS: NodeDefinition[] = [
  { type: NodeType.CLIENT, label: "Client", category: "Entry", color: "#6366f1",
    defaultConfig: { ...base, requestRate: 10, requestDistribution: [{ type: "GET /api", weight: 1 }] } },
  { type: NodeType.DNS, label: "DNS", category: "Entry", color: "#6366f1",
    defaultConfig: { ...base, resolutionLatency: { type: "constant", value: 5 }, ttl: 300000, failureRate: 0.01 } },
  { type: NodeType.CDN, label: "CDN", category: "Entry", color: "#6366f1",
    defaultConfig: { ...base, cacheHitRate: 0.9, originFallbackLatency: { type: "constant", value: 50 }, ttl: 86400000 } },
  { type: NodeType.LOAD_BALANCER, label: "Load Balancer", category: "Load Balancer", color: "#f59e0b",
    defaultConfig: { ...base, strategy: "round-robin", maxConnections: 10000, healthCheckInterval: 5000, healthCheckFailureThreshold: 3 } },
  { type: NodeType.WEB_SERVER, label: "Web Server", category: "Compute", color: "#10b981",
    defaultConfig: { ...base, concurrencyLimit: 50, processingLatency: { type: "lognormal", mu: 2.3, sigma: 0.5 } } },
  { type: NodeType.MICROSERVICE, label: "Microservice", category: "Compute", color: "#10b981",
    defaultConfig: { ...base, concurrencyLimit: 30, processingLatency: { type: "lognormal", mu: 2, sigma: 0.4 } } },
  { type: NodeType.DISTRIBUTED_CACHE, label: "Cache (Redis)", category: "Cache", color: "#ef4444",
    defaultConfig: { ...base, capacity: 100000, hitRate: 0.85, evictionPolicy: "LRU", ttl: 300000, replicationLag: 0 } },
  { type: NodeType.SQL_DB, label: "SQL DB", category: "Database", color: "#3b82f6",
    defaultConfig: { ...base, connectionPoolSize: 20, queryLatency: { type: "lognormal", mu: 2.7, sigma: 0.6 }, replicationLag: 10, maxIOPS: 5000 } },
  { type: NodeType.NOSQL_DB, label: "NoSQL DB", category: "Database", color: "#3b82f6",
    defaultConfig: { ...base, partitionCount: 8, readLatency: { type: "lognormal", mu: 1.6, sigma: 0.3 }, writeLatency: { type: "lognormal", mu: 2, sigma: 0.4 }, consistencyModel: "eventual" } },
  { type: NodeType.MESSAGE_QUEUE, label: "Message Queue", category: "Queue", color: "#a855f7",
    defaultConfig: { ...base, maxDepth: 100000, consumerThroughput: 1000, deliveryGuarantee: "at-least-once" } },
  { type: NodeType.EVENT_STREAM, label: "Event Stream", category: "Queue", color: "#a855f7",
    defaultConfig: { ...base, partitionCount: 12, consumerGroupLag: 0, retention: 86400000 } },
  { type: NodeType.OBJECT_STORAGE, label: "Object Storage", category: "Storage", color: "#64748b",
    defaultConfig: { ...base, readLatency: { type: "constant", value: 20 }, writeLatency: { type: "constant", value: 50 }, throughputLimit: 5000 } },
  { type: NodeType.SEARCH_INDEX, label: "Search Index", category: "Search", color: "#f97316",
    defaultConfig: { ...base, queryLatency: { type: "lognormal", mu: 2.3, sigma: 0.4 }, indexingLag: 1000 } },
  { type: NodeType.API_GATEWAY, label: "API Gateway", category: "Gateway", color: "#14b8a6",
    defaultConfig: { ...base, rateLimit: 1000, authLatency: { type: "constant", value: 3 } } },
];

export function getNodeDefinition(type: NodeType): NodeDefinition | undefined {
  return NODE_DEFINITIONS.find((d) => d.type === type);
}
