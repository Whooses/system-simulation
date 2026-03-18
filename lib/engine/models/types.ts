// === Enums ===

export enum EventType {
  REQUEST_ARRIVE = "REQUEST_ARRIVE",
  PROCESS_COMPLETE = "PROCESS_COMPLETE",
  RESPONSE = "RESPONSE",
  CACHE_HIT = "CACHE_HIT",
  CACHE_MISS = "CACHE_MISS",
  TIMEOUT = "TIMEOUT",
  FAILURE = "FAILURE",
  HEALTH_CHECK = "HEALTH_CHECK",
  HEALTH_RESULT = "HEALTH_RESULT",
  QUEUE_ENQUEUE = "QUEUE_ENQUEUE",
  QUEUE_DEQUEUE = "QUEUE_DEQUEUE",
  CIRCUIT_OPEN = "CIRCUIT_OPEN",
  CIRCUIT_HALF_OPEN = "CIRCUIT_HALF_OPEN",
  CIRCUIT_CLOSE = "CIRCUIT_CLOSE",
  RETRY = "RETRY",
}

export enum Protocol {
  HTTP = "HTTP",
  GRPC = "GRPC",
  TCP = "TCP",
  ASYNC = "ASYNC",
  DNS = "DNS",
  INTERNAL = "INTERNAL",
}

export enum HealthStatus {
  HEALTHY = "HEALTHY",
  DEGRADED = "DEGRADED",
  UNHEALTHY = "UNHEALTHY",
}

export enum NodeType {
  CLIENT = "CLIENT",
  DNS = "DNS",
  CDN = "CDN",
  LOAD_BALANCER = "LOAD_BALANCER",
  WEB_SERVER = "WEB_SERVER",
  MICROSERVICE = "MICROSERVICE",
  IN_PROCESS_CACHE = "IN_PROCESS_CACHE",
  DISTRIBUTED_CACHE = "DISTRIBUTED_CACHE",
  SQL_DB = "SQL_DB",
  NOSQL_DB = "NOSQL_DB",
  MESSAGE_QUEUE = "MESSAGE_QUEUE",
  EVENT_STREAM = "EVENT_STREAM",
  OBJECT_STORAGE = "OBJECT_STORAGE",
  SEARCH_INDEX = "SEARCH_INDEX",
  API_GATEWAY = "API_GATEWAY",
}

export enum ResultStatus {
  SUCCESS = "SUCCESS",
  FAILURE = "FAILURE",
  PENDING = "PENDING",
}

// === Latency Distribution ===

export type LatencyDistribution =
  | { type: "constant"; value: number }
  | { type: "normal"; mean: number; stddev: number }
  | { type: "exponential"; mean: number }
  | { type: "uniform"; min: number; max: number }
  | { type: "lognormal"; mu: number; sigma: number };

// === Core Data Types ===

export interface Message {
  method: string;
  path: string;
  payload?: unknown;
}

export interface Result {
  status: ResultStatus;
  statusCode: number;
  latency: number;
  error?: string;
}

export interface Transaction {
  id: string;
  message: Message;
  protocol: Protocol;
  result: Result | null;
  parentTransactionId?: string;
  metadata: Record<string, unknown>;
}

export interface SimEvent {
  id: string;
  timestamp: number;
  type: EventType;
  sourceNodeId: string;
  targetNodeId: string;
  transaction: Transaction | null;
}

// === Connection ===

export interface Connection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  protocol: Protocol;
  latency: LatencyDistribution;
  timeout: number;
  retryConfig?: RetryConfig;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

// === Node Config (union per type) ===

export interface BaseNodeConfig {
  concurrencyLimit: number;
  maxQueueSize: number;
  processingLatency: LatencyDistribution;
  errorRate: number;
}

export interface ClientConfig extends BaseNodeConfig {
  requestRate: number;
  requestDistribution: { type: string; weight: number }[];
}

export interface DNSConfig extends BaseNodeConfig {
  resolutionLatency: LatencyDistribution;
  ttl: number;
  failureRate: number;
}

export interface CDNConfig extends BaseNodeConfig {
  cacheHitRate: number;
  originFallbackLatency: LatencyDistribution;
  ttl: number;
}

export interface LoadBalancerConfig extends BaseNodeConfig {
  strategy: "round-robin" | "least-connections" | "ip-hash";
  maxConnections: number;
  healthCheckInterval: number;
  healthCheckFailureThreshold: number;
}

export interface WebServerConfig extends BaseNodeConfig {}

export interface CacheConfig extends BaseNodeConfig {
  capacity: number;
  hitRate: number;
  evictionPolicy: "LRU" | "LFU";
  ttl: number;
  replicationLag?: number;
}

export interface SQLDBConfig extends BaseNodeConfig {
  connectionPoolSize: number;
  queryLatency: LatencyDistribution;
  replicationLag: number;
  maxIOPS: number;
}

export interface NoSQLDBConfig extends BaseNodeConfig {
  partitionCount: number;
  readLatency: LatencyDistribution;
  writeLatency: LatencyDistribution;
  consistencyModel: "eventual" | "strong";
}

export interface MessageQueueConfig extends BaseNodeConfig {
  maxDepth: number;
  consumerThroughput: number;
  deliveryGuarantee: "at-least-once" | "exactly-once";
}

export interface EventStreamConfig extends BaseNodeConfig {
  partitionCount: number;
  consumerGroupLag: number;
  retention: number;
}

export interface ObjectStorageConfig extends BaseNodeConfig {
  readLatency: LatencyDistribution;
  writeLatency: LatencyDistribution;
  throughputLimit: number;
}

export interface SearchIndexConfig extends BaseNodeConfig {
  queryLatency: LatencyDistribution;
  indexingLag: number;
}

export interface APIGatewayConfig extends BaseNodeConfig {
  rateLimit: number;
  authLatency: LatencyDistribution;
}

export type NodeConfig =
  | ClientConfig
  | DNSConfig
  | CDNConfig
  | LoadBalancerConfig
  | WebServerConfig
  | CacheConfig
  | SQLDBConfig
  | NoSQLDBConfig
  | MessageQueueConfig
  | EventStreamConfig
  | ObjectStorageConfig
  | SearchIndexConfig
  | APIGatewayConfig;

// === Node State ===

export interface NodeState {
  queueDepth: number;
  activeConnections: number;
  health: HealthStatus;
  requestCount: number;
  errorCount: number;
  totalLatency: number;
  crashed: boolean;
}

// === Simulation Node ===

export interface SimulationNode {
  id: string;
  type: NodeType;
  label: string;
  config: NodeConfig;
  state: NodeState;
  position: { x: number; y: number };
  connections: string[];
}

// === Scenario ===

export interface Phase {
  startTime: number;
  duration: number;
  requestRate: number;
  rampUp?: number;
  requestDistribution: { type: string; weight: number }[];
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  duration: number;
  phases: Phase[];
}

// === Simulation Config (for localStorage persistence) ===

export interface SimulationConfig {
  version: 1;
  name: string;
  nodes: SimulationNode[];
  connections: Connection[];
  scenario: Scenario;
}

// === WebSocket Messages ===

export type ServerMessage =
  | { type: "TRANSACTION"; data: Transaction }
  | { type: "NODE_STATE"; data: { nodeId: string; state: NodeState } }
  | { type: "NODE_HEALTH"; data: { nodeId: string; status: HealthStatus } }
  | { type: "SIM_STATUS"; data: { time: number; speed: number; running: boolean } }
  | { type: "ALERT"; data: { message: string; severity: "info" | "warning" | "critical" } }
  | { type: "BATCH"; data: ServerMessage[] };

export type ClientMessage =
  | { type: "START"; data: { simulationId: string } }
  | { type: "STOP" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "SPEED"; data: { multiplier: number } }
  | { type: "UPDATE_CONFIG"; data: { nodeId: string; config: Partial<NodeConfig> } }
  | { type: "INJECT_CHAOS"; data: { chaosType: string; target: string } };
