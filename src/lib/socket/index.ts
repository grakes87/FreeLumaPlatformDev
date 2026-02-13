import { Server as SocketIOServer } from 'socket.io';
import type { Namespace } from 'socket.io';
import { authMiddleware } from '@/lib/socket/auth';
import { presenceManager } from '@/lib/socket/presence';
import { registerChatHandlers } from '@/lib/socket/chat';
import { registerNotificationHandlers } from '@/lib/socket/notifications';

// Extend globalThis for the Socket.IO instance
declare global {
  // eslint-disable-next-line no-var
  var __io: SocketIOServer | undefined;
  // eslint-disable-next-line no-var
  var __ioNamespacesReady: boolean | undefined;
}

let namespacesReady = false;

/**
 * Set up /chat and /notifications namespaces with auth middleware.
 * Called lazily on first getIO() access. Idempotent (runs once).
 */
function setupNamespaces(io: SocketIOServer): void {
  if (namespacesReady || globalThis.__ioNamespacesReady) return;

  // --- /chat namespace ---
  const chatNs: Namespace = io.of('/chat');
  chatNs.use(authMiddleware);
  chatNs.on('connection', (socket) => {
    const userId = socket.data.userId as number;
    presenceManager.addUser(userId, socket.id);

    // Join user-specific room for targeted messages
    socket.join(`user:${userId}`);

    // Register all chat event handlers (typing, read receipts, presence, rooms)
    registerChatHandlers(chatNs, socket);
  });

  // --- /notifications namespace ---
  const notifNs: Namespace = io.of('/notifications');
  notifNs.use(authMiddleware);
  notifNs.on('connection', (socket) => {
    const userId = socket.data.userId as number;

    // Join user-specific room for targeted notifications
    socket.join(`user:${userId}`);

    // Register notification event handlers (mark-read, mark-all-read)
    registerNotificationHandlers(notifNs, socket);

    socket.on('disconnect', () => {
      // Presence is tracked on the chat namespace; notifications just needs room membership
    });
  });

  namespacesReady = true;
  if (process.env.NODE_ENV !== 'production') {
    globalThis.__ioNamespacesReady = true;
  }
}

/**
 * Initialize Socket.IO on the given HTTP server.
 * Can be called from server.js or from within Next.js code.
 * In this project, server.js creates the SocketServer and stores on globalThis.__io;
 * this function provides an alternative programmatic init path.
 */
export function initSocketServer(httpServer: import('node:http').Server): SocketIOServer {
  // Avoid double-init in dev with HMR
  if (globalThis.__io) {
    return globalThis.__io;
  }

  const io = new SocketIOServer(httpServer, {
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    },
  });

  // Memory leak prevention: drop large request objects after handshake
  io.engine.on('connection', (rawSocket: { request: unknown }) => {
    rawSocket.request = null;
  });

  // Store globally for getIO() access from API routes
  globalThis.__io = io;

  // Set up namespaces immediately
  setupNamespaces(io);

  console.log('> Socket.IO server initialized');
  return io;
}

/**
 * Get the Socket.IO server instance from anywhere in Next.js code.
 * Throws if the server hasn't been initialized yet (server.js must run first).
 */
export function getIO(): SocketIOServer {
  const io = globalThis.__io;
  if (!io) {
    throw new Error(
      'Socket.IO not initialized. Ensure server.js creates the SocketServer before this code runs.'
    );
  }

  // Ensure namespaces are set up (handles dev HMR where module state resets)
  if (!namespacesReady && !globalThis.__ioNamespacesReady) {
    setupNamespaces(io);
  }

  return io;
}
