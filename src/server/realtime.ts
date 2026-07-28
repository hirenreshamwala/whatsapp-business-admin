/**
 * Realtime hub (WebSocket fan-out).
 *
 * A single hub instance is stored on globalThis so that both the custom Node
 * server (server.ts) and Next.js route handlers — which Next compiles into a
 * separate module graph — share the exact same object. Route handlers call
 * `publish()` after DB writes; the custom server owns the WebSocketServer and
 * relays messages to authenticated browser clients.
 */
import type { Server as HttpServer } from "node:http";
import type { Socket } from "node:net";
import { WebSocketServer, WebSocket } from "ws";
import { verifySessionToken } from "@/lib/auth-token";

export type RealtimeEvent = {
  /** Event channel, e.g. "message:new", "message:status", "template:status". */
  type: string;
  /** Arbitrary JSON payload. */
  payload: unknown;
};

type Hub = {
  wss: WebSocketServer | null;
  /** userId -> set of sockets (a user may have several open tabs). */
  clients: Map<string, Set<WebSocket>>;
  publish: (event: RealtimeEvent) => void;
};

const g = globalThis as unknown as { __waRealtime?: Hub };

function createHub(): Hub {
  const hub: Hub = {
    wss: null,
    clients: new Map(),
    publish(event: RealtimeEvent) {
      const data = JSON.stringify(event);
      for (const set of hub.clients.values()) {
        for (const ws of set) {
          if (ws.readyState === WebSocket.OPEN) ws.send(data);
        }
      }
    },
  };
  return hub;
}

function getHub(): Hub {
  if (!g.__waRealtime) g.__waRealtime = createHub();
  return g.__waRealtime;
}

/** Publish an event to every connected browser (all authenticated users). */
export function publish(event: RealtimeEvent): void {
  getHub().publish(event);
}

/** Wire the WebSocketServer onto the shared HTTP server. Called once from server.ts. */
export function attachRealtime(server: HttpServer): void {
  const hub = getHub();
  if (hub.wss) return;

  const wss = new WebSocketServer({ noServer: true });
  hub.wss = wss;

  server.on("upgrade", (req, socket: Socket, head) => {
    const { url } = req;
    if (!url || !url.startsWith("/ws")) return; // let Next/HMR handle other upgrades

    // Authenticate via the NextAuth session cookie on the upgrade request.
    verifySessionToken(req.headers.cookie || "")
      .then((session) => {
        if (!session) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }
        wss.handleUpgrade(req, socket, head, (ws) => {
          registerClient(hub, session.userId, ws);
        });
      })
      .catch(() => {
        socket.destroy();
      });
  });
}

function registerClient(hub: Hub, userId: string, ws: WebSocket) {
  let set = hub.clients.get(userId);
  if (!set) {
    set = new Set();
    hub.clients.set(userId, set);
  }
  set.add(ws);

  ws.on("close", () => {
    set!.delete(ws);
    if (set!.size === 0) hub.clients.delete(userId);
  });
  ws.on("error", () => ws.close());

  ws.send(JSON.stringify({ type: "connected", payload: { userId } }));
}
