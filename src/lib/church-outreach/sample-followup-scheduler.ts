import cron from 'node-cron';
import { sendFollowUpEmail } from './email-sender';

let initialized = false;

/**
 * Initialize the sample follow-up cron scheduler.
 * Runs daily at 10am UTC — checks for delivered samples that need a follow-up email.
 * Call once from server.js startup (via globalThis pattern).
 */
export function initSampleFollowUpScheduler(): void {
  if (initialized || globalThis.__sampleFollowUpReady) {
    return;
  }

  // Run daily at 10:00 UTC (6am ET / 5am CT)
  cron.schedule('0 10 * * *', async () => {
    try {
      await processPendingFollowUps();
    } catch (err) {
      console.error('[Sample Follow-Up] Error:', err);
    }
  });

  initialized = true;
  globalThis.__sampleFollowUpReady = true;
  console.log('[Sample Follow-Up] Cron initialized (daily at 10:00 UTC)');
}

/**
 * Find delivered sample shipments where:
 * 1. delivered_at is at least 7 days ago
 * 2. follow_up_sent_at is NULL (not yet sent)
 * 3. Church has a contact email
 * 4. Church email is not unsubscribed
 *
 * Sends the follow-up email and marks follow_up_sent_at.
 */
export async function processPendingFollowUps(): Promise<void> {
  const { SampleShipment, Church, OutreachUnsubscribe, ChurchActivity } =
    await import('@/lib/db/models');
  const { Op } = await import('sequelize');

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const shipments = await SampleShipment.findAll({
    where: {
      status: 'delivered',
      delivered_at: { [Op.lte]: sevenDaysAgo },
      follow_up_sent_at: null,
    },
    include: [
      {
        model: Church,
        as: 'church',
        attributes: ['id', 'name', 'pastor_name', 'contact_email'],
      },
    ],
  });

  if (shipments.length === 0) return;

  let sentCount = 0;

  for (const shipment of shipments) {
    try {
      const church = (shipment as unknown as { church: { id: number; name: string; pastor_name: string | null; contact_email: string | null } }).church;
      if (!church?.contact_email) continue;

      // Check unsubscribe status
      const unsubscribed = await OutreachUnsubscribe.findOne({
        where: { email: church.contact_email.toLowerCase() },
      });
      if (unsubscribed) {
        // Mark as sent to prevent retries
        await shipment.update({ follow_up_sent_at: new Date() });
        continue;
      }

      await sendFollowUpEmail(church.contact_email, church.name, church.pastor_name);

      await shipment.update({ follow_up_sent_at: new Date() });

      // Log activity
      await ChurchActivity.create({
        church_id: church.id,
        activity_type: 'email_sent',
        description: 'Follow-up email sent (7 days post-delivery)',
        metadata: { shipment_id: shipment.id, type: 'sample_follow_up' },
      });

      sentCount++;
    } catch (err) {
      console.error(`[Sample Follow-Up] Error sending to shipment ${shipment.id}:`, err);
    }
  }

  if (sentCount > 0) {
    console.log(`[Sample Follow-Up] Sent ${sentCount}/${shipments.length} follow-up emails`);
  }
}

// Extend globalThis for HMR guard
declare global {
  // eslint-disable-next-line no-var
  var __sampleFollowUpReady: boolean | undefined;
  // eslint-disable-next-line no-var
  var __initSampleFollowUpScheduler: (() => void) | undefined;
}

// Store on globalThis so server.js (plain JS) can call it
globalThis.__initSampleFollowUpScheduler = initSampleFollowUpScheduler;
