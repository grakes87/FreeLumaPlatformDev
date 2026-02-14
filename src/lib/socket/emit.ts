import type { Namespace } from 'socket.io';

/**
 * Emit an event to each user's personal room (`user:${userId}`).
 * Used for broadcasting to conversation participants regardless of
 * whether they are actively viewing the conversation.
 *
 * This is the scale-friendly alternative to broadcasting to `conv:X` rooms,
 * which required auto-joining ALL conversation rooms on connect.
 */
export function emitToUsers(
  chatNsp: Namespace,
  userIds: number[],
  event: string,
  payload: unknown,
): void {
  for (const id of userIds) {
    chatNsp.to(`user:${id}`).emit(event, payload);
  }
}
