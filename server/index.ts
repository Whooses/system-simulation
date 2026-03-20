/**
 * Custom server entry point.
 *
 * Starts a Node HTTP server that handles both Next.js pages/API routes
 * and a WebSocket server (on /ws) for real-time simulation control.
 * Run via `npm run dev:ws` or the production start script.
 */
import { createServer } from "http";
import next from "next";
import { createWSServer } from "./ws-server";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => { handle(req, res); });
  createWSServer(server);
  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> WebSocket server on ws://${hostname}:${port}/ws`);
  });
});
