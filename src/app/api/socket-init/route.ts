import { getIO } from '@/lib/socket/index';

/**
 * GET /api/socket-init
 * Triggers Socket.IO namespace setup (auth middleware + event handlers).
 * Called by SocketContext before creating socket connections.
 */
export function GET() {
  try {
    getIO();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
