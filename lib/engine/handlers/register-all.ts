import { NodeType } from "../models";
import { registerHandler } from "./registry";
import { ClientHandler } from "./client-handler";
import { WebServerHandler } from "./web-server-handler";
import { LoadBalancerHandler } from "./load-balancer-handler";
import { CacheHandler } from "./cache-handler";
import { SQLDBHandler } from "./sql-db-handler";
import { DNSHandler } from "./dns-handler";
import { CDNHandler } from "./cdn-handler";
import { MessageQueueHandler } from "./message-queue-handler";
import { APIGatewayHandler } from "./api-gateway-handler";
import { NoSQLDBHandler } from "./nosql-db-handler";
import { ObjectStorageHandler } from "./object-storage-handler";
import { SearchIndexHandler } from "./search-index-handler";
import { EventStreamHandler } from "./event-stream-handler";

/**
 * Bootstrap function that wires every node type to its handler.
 * Must be called once before the engine processes any events.
 * Note: MICROSERVICE reuses WebServerHandler (same request/response behavior).
 */
export function registerAllHandlers(): void {
  registerHandler(NodeType.CLIENT, new ClientHandler());
  registerHandler(NodeType.WEB_SERVER, new WebServerHandler());
  registerHandler(NodeType.MICROSERVICE, new WebServerHandler());
  registerHandler(NodeType.LOAD_BALANCER, new LoadBalancerHandler());
  registerHandler(NodeType.IN_PROCESS_CACHE, new CacheHandler());
  registerHandler(NodeType.DISTRIBUTED_CACHE, new CacheHandler());
  registerHandler(NodeType.SQL_DB, new SQLDBHandler());
  registerHandler(NodeType.NOSQL_DB, new NoSQLDBHandler());
  registerHandler(NodeType.DNS, new DNSHandler());
  registerHandler(NodeType.CDN, new CDNHandler());
  registerHandler(NodeType.MESSAGE_QUEUE, new MessageQueueHandler());
  registerHandler(NodeType.EVENT_STREAM, new EventStreamHandler());
  registerHandler(NodeType.API_GATEWAY, new APIGatewayHandler());
  registerHandler(NodeType.OBJECT_STORAGE, new ObjectStorageHandler());
  registerHandler(NodeType.SEARCH_INDEX, new SearchIndexHandler());
}
