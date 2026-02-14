import { createServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handler);

  // Initialize Socket.IO (namespace setup happens lazily in src/lib/socket/index.ts)
  if (!globalThis.__io) {
    const io = new SocketServer(httpServer, {
      connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      },
    });

    // Memory leak prevention: drop large request objects after handshake
    io.engine.on("connection", (rawSocket) => {
      rawSocket.request = null;
    });

    // Register namespaces so client connections are accepted immediately.
    // Full auth middleware + handlers are added lazily by setupNamespaces()
    // when the first API route calls getIO().
    io.of('/chat');
    io.of('/notifications');

    globalThis.__io = io;
    console.log("> Socket.IO server initialized");
  }

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);

    // Initialize cron schedulers after a brief delay to allow Next.js module compilation.
    // Each scheduler self-registers on globalThis when imported.
    // Email scheduler also initialized from socket/index.ts setupNamespaces() as a fallback.
    setTimeout(() => {
      if (globalThis.__initEmailScheduler) {
        globalThis.__initEmailScheduler();
      }
      if (globalThis.__initAccountCleanup) {
        globalThis.__initAccountCleanup();
      }
    }, 5000);
  });
});
