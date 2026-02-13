import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a unique tracking ID for email open tracking via pixel.
 */
export function generateTrackingId(): string {
  return uuidv4();
}

/**
 * Mark an email log as sent.
 */
export async function markSent(emailLogId: number): Promise<void> {
  const { EmailLog } = await import('@/lib/db/models');
  await EmailLog.update(
    { status: 'sent', sent_at: new Date() },
    { where: { id: emailLogId } }
  );
}

/**
 * Mark an email log as bounced.
 */
export async function markBounced(emailLogId: number): Promise<void> {
  const { EmailLog } = await import('@/lib/db/models');
  await EmailLog.update(
    { status: 'bounced' },
    { where: { id: emailLogId } }
  );
}

/**
 * Mark an email log as opened (via tracking pixel).
 * Only updates if the current status is 'sent' (don't re-open bounced).
 */
export async function markOpened(trackingId: string): Promise<boolean> {
  const { EmailLog } = await import('@/lib/db/models');
  const [affectedCount] = await EmailLog.update(
    { status: 'opened', opened_at: new Date() },
    {
      where: {
        tracking_id: trackingId,
        status: 'sent', // only upgrade from sent -> opened
      },
    }
  );
  return affectedCount > 0;
}
