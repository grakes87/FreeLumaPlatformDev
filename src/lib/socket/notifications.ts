import type { Namespace, Socket } from 'socket.io';

/**
 * Register notification-related Socket.IO event handlers on the /notifications namespace.
 * Called during namespace connection setup in index.ts.
 */
export function registerNotificationHandlers(nsp: Namespace, socket: Socket): void {
  const userId = socket.data.userId as number;

  // Mark a single notification as read
  socket.on('notification:mark-read', async (data: { notificationId: number }) => {
    try {
      const { Notification } = await import('@/lib/db/models');

      await Notification.update(
        { is_read: true },
        {
          where: {
            id: data.notificationId,
            recipient_id: userId,
          },
        }
      );

      // Acknowledge back to the client
      socket.emit('notification:marked-read', {
        notificationId: data.notificationId,
        success: true,
      });
    } catch (error) {
      console.error('[Socket] notification:mark-read error:', error);
    }
  });

  // Mark all unread notifications as read
  socket.on('notification:mark-all-read', async () => {
    try {
      const { Notification } = await import('@/lib/db/models');

      const [affectedCount] = await Notification.update(
        { is_read: true },
        {
          where: {
            recipient_id: userId,
            is_read: false,
          },
        }
      );

      socket.emit('notification:all-marked-read', {
        success: true,
        count: affectedCount,
      });
    } catch (error) {
      console.error('[Socket] notification:mark-all-read error:', error);
    }
  });

  // Optional: acknowledge subscription ready
  socket.on('notifications:subscribe', () => {
    socket.emit('notifications:subscribed', { userId });
  });
}
