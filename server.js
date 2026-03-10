import cluster from "node:cluster";
import { availableParallelism } from "node:os";
import { createServer } from "node:http";
import { setupMaster, setupWorker } from "@socket.io/sticky";
import { setupPrimary, createAdapter } from "@socket.io/cluster-adapter";
import { Server as SocketServer } from "socket.io";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);
const numWorkers = dev ? 1 : Math.min(availableParallelism(), 8);

if (cluster.isPrimary) {
  console.log(`> Primary ${process.pid} starting ${numWorkers} worker(s)`);

  // The primary listens on the real port and distributes connections to workers
  const httpServer = createServer();
  setupMaster(httpServer, { loadBalancingMethod: "least-connection" });
  setupPrimary();

  httpServer.listen(port, hostname, () => {
    console.log(`> Primary listening on http://${hostname}:${port}`);
  });

  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code) => {
    console.log(`> Worker ${worker.process.pid} exited (code ${code}), restarting...`);
    cluster.fork();
  });
} else {
  // ---- Worker process ----
  const app = next({ dev, hostname, port });
  const handler = app.getRequestHandler();

  app.prepare().then(() => {
    const httpServer = createServer(handler);

    if (!globalThis.__io) {
      const io = new SocketServer(httpServer, {
        cors: {
          origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          credentials: true,
          methods: ["GET", "POST"],
        },
        transports: ["websocket"],
        connectionStateRecovery: {
          maxDisconnectionDuration: 2 * 60 * 1000,
        },
        adapter: createAdapter(),
      });

      io.engine.on("connection", (rawSocket) => {
        rawSocket.request = null;
      });

      io.of("/chat");
      io.of("/notifications");

      io.engine.on("connection_error", (err) => {
        console.error("[Socket.IO] connection_error:", err.code, err.message);
      });

      globalThis.__io = io;
      setupWorker(io);
      console.log(`> Worker ${process.pid}: Socket.IO initialized`);
    }

    // Workers listen on random OS-assigned port; primary routes traffic to them
    httpServer.listen(0, () => {
      console.log(`> Worker ${process.pid} ready`);

      // Only first worker (id=1) runs cron jobs to avoid duplicates
      if (cluster.worker?.id === 1) {
        setTimeout(() => {
          if (globalThis.__initEmailScheduler) globalThis.__initEmailScheduler();
          if (globalThis.__initAccountCleanup) globalThis.__initAccountCleanup();
          if (globalThis.__initDripScheduler) globalThis.__initDripScheduler();
          if (globalThis.__initAutoDiscoveryScheduler) globalThis.__initAutoDiscoveryScheduler();
          console.log(`> Worker ${process.pid}: cron schedulers started`);
        }, 5000);
      }
    });
  });
}
