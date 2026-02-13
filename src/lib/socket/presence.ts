/**
 * In-memory presence manager for tracking online users.
 * Maps userId -> Set of socketIds (a user may have multiple tabs/devices).
 */
class PresenceManager {
  private onlineUsers = new Map<number, Set<string>>();

  /** Register a socket connection for a user */
  addUser(userId: number, socketId: string): void {
    const existing = this.onlineUsers.get(userId);
    if (existing) {
      existing.add(socketId);
    } else {
      this.onlineUsers.set(userId, new Set([socketId]));
    }
  }

  /** Remove a socket connection. Returns true if user went fully offline. */
  removeSocket(userId: number, socketId: string): boolean {
    const sockets = this.onlineUsers.get(userId);
    if (!sockets) return false;

    sockets.delete(socketId);
    if (sockets.size === 0) {
      this.onlineUsers.delete(userId);
      return true;
    }
    return false;
  }

  /** Check if a specific user is online (has at least one socket) */
  isOnline(userId: number): boolean {
    const sockets = this.onlineUsers.get(userId);
    return sockets !== undefined && sockets.size > 0;
  }

  /** Get all currently online user IDs */
  getOnlineUserIds(): number[] {
    return Array.from(this.onlineUsers.keys());
  }

  /** Bulk check: returns a Map of userId -> online boolean */
  getOnlineStatusBulk(userIds: number[]): Map<number, boolean> {
    const result = new Map<number, boolean>();
    for (const id of userIds) {
      result.set(id, this.isOnline(id));
    }
    return result;
  }

  /** Get total number of online users (for admin/stats) */
  getOnlineCount(): number {
    return this.onlineUsers.size;
  }

  /** Get all socket IDs for a specific user */
  getSocketIds(userId: number): Set<string> {
    return this.onlineUsers.get(userId) ?? new Set();
  }
}

export const presenceManager = new PresenceManager();
