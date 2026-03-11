import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import { renderTemplate, renderSubject } from './template-renderer';
import { generatePersonalizedEmail } from './ai-email-writer';

let initialized = false;

/**
 * Initialize the drip sequence cron scheduler.
 * Call once from server.js startup (via globalThis pattern).
 * Guards against multiple initializations (e.g., HMR in dev).
 */
export function initDripScheduler(): void {
  if (initialized || globalThis.__dripSchedulerReady) {
    return;
  }

  // Every 15 minutes: process pending drip steps
  cron.schedule('*/15 * * * *', async () => {
    try {
      await processPendingDripSteps();
    } catch (err) {
      console.error('[Drip Scheduler] Error:', err);
    }
  });

  initialized = true;
  globalThis.__dripSchedulerReady = true;
  console.log('[Drip Scheduler] Cron initialized');
}

/**
 * Process all pending drip enrollment steps.
 * Finds enrollments with next_step_at <= NOW(), sends the corresponding
 * template email, and advances to the next step or completes the sequence.
 */
export async function processPendingDripSteps(): Promise<void> {
  const { DripEnrollment, DripStep, DripSequence, Church, OutreachTemplate, OutreachEmail, OutreachUnsubscribe, ChurchActivity } =
    await import('@/lib/db/models');
  const { sequelize } = await import('@/lib/db');
  const { Op, QueryTypes } = await import('sequelize');

  // Find all active enrollments where next_step_at has passed
  const pendingEnrollments = await DripEnrollment.findAll({
    where: {
      status: 'active',
      next_step_at: { [Op.lte]: new Date() },
    },
  });

  if (pendingEnrollments.length === 0) return;

  let processedCount = 0;

  for (const enrollment of pendingEnrollments) {
    try {
      await sequelize.transaction(async (t) => {
        // Lock the enrollment row to prevent race conditions
        const lockedEnrollment = await DripEnrollment.findByPk(enrollment.id, {
          lock: t.LOCK.UPDATE,
          transaction: t,
        });

        if (!lockedEnrollment || lockedEnrollment.status !== 'active') {
          return; // Already processed or status changed
        }

        // Load the church
        const church = await Church.findByPk(lockedEnrollment.church_id, { transaction: t });
        if (!church) {
          console.warn(`[Drip Scheduler] Church ${lockedEnrollment.church_id} not found, skipping enrollment ${lockedEnrollment.id}`);
          return;
        }

        // Check if church email is unsubscribed
        if (church.contact_email) {
          const unsubscribed = await OutreachUnsubscribe.findOne({
            where: { email: church.contact_email.toLowerCase() },
            transaction: t,
          });

          if (unsubscribed) {
            // Cancel enrollment for unsubscribed church
            await lockedEnrollment.update(
              { status: 'cancelled', next_step_at: null },
              { transaction: t }
            );
            console.log(`[Drip Scheduler] Cancelled enrollment ${lockedEnrollment.id} - church ${church.id} is unsubscribed`);
            return;
          }
        }

        // If church has no contact email, skip (don't cancel -- they might add one later)
        if (!church.contact_email) {
          console.log(`[Drip Scheduler] Skipping enrollment ${lockedEnrollment.id} - church ${church.id} has no contact email`);
          return;
        }

        // Get the current drip step (step_order = current_step + 1)
        const currentStepOrder = lockedEnrollment.current_step + 1;
        const dripStep = await DripStep.findOne({
          where: {
            sequence_id: lockedEnrollment.sequence_id,
            step_order: currentStepOrder,
          },
          transaction: t,
        });

        if (!dripStep) {
          // No step found -- mark as completed
          await lockedEnrollment.update(
            { status: 'completed', completed_at: new Date(), next_step_at: null },
            { transaction: t }
          );
          return;
        }

        // Load the template for this step
        const template = await OutreachTemplate.findByPk(dripStep.template_id, { transaction: t });
        if (!template) {
          console.warn(`[Drip Scheduler] Template ${dripStep.template_id} not found for step ${dripStep.id}, skipping`);
          return;
        }

        // Render template with church data (used as fallback + reference)
        const renderedHtml = renderTemplate(template.html_body, {
          id: church.id,
          name: church.name,
          pastor_name: church.pastor_name,
          city: church.city,
          state: church.state,
          denomination: church.denomination,
          contact_email: church.contact_email,
        }, template.template_assets);
        const renderedSubject = renderSubject(template.subject, {
          id: church.id,
          name: church.name,
          pastor_name: church.pastor_name,
          city: church.city,
          state: church.state,
          denomination: church.denomination,
          contact_email: church.contact_email,
        });

        // Load sequence for metadata
        const sequence = await DripSequence.findByPk(lockedEnrollment.sequence_id, {
          attributes: ['id', 'name'],
          transaction: t,
        });

        // Count total steps in sequence
        const totalSteps = await DripStep.count({
          where: { sequence_id: lockedEnrollment.sequence_id },
          transaction: t,
        });

        // Generate tracking ID
        const trackingId = uuidv4();

        // Generate AI-personalized email (outside transaction for API call)
        let aiResult = { subject: renderedSubject, html: renderedHtml };
        try {
          aiResult = await generatePersonalizedEmail(
            {
              name: church.name,
              pastor_name: church.pastor_name,
              denomination: church.denomination,
              congregation_size_estimate: church.congregation_size_estimate,
              city: church.city,
              state: church.state,
              youth_programs: church.youth_programs,
              ai_summary: church.ai_summary,
              outreach_fit_score: church.outreach_fit_score,
              outreach_fit_reason: church.outreach_fit_reason,
              has_youth_ministry: church.has_youth_ministry,
              has_young_adult_ministry: church.has_young_adult_ministry,
              has_small_groups: church.has_small_groups,
              has_missions_focus: church.has_missions_focus,
            },
            renderedSubject,
            renderedHtml,
            {
              stepOrder: currentStepOrder,
              totalSteps,
              sequenceName: sequence?.name || 'Outreach',
            },
            template.template_assets,
          );
        } catch (aiErr) {
          console.warn(`[Drip Scheduler] AI email generation failed for enrollment ${lockedEnrollment.id}, using template fallback`);
        }

        // Create OutreachEmail record as pending_review (NOT sent)
        await OutreachEmail.create(
          {
            church_id: church.id,
            drip_enrollment_id: lockedEnrollment.id,
            template_id: template.id,
            to_email: church.contact_email,
            subject: aiResult.subject,
            status: 'pending_review',
            tracking_id: trackingId,
            rendered_html: renderedHtml,
            ai_html: aiResult.html,
            ai_subject: aiResult.subject,
          },
          { transaction: t }
        );

        // Pause enrollment until admin reviews (next_step_at = null)
        await lockedEnrollment.update(
          { next_step_at: null },
          { transaction: t }
        );

        processedCount++;
      });
    } catch (error) {
      // Log error for individual enrollment but continue processing others
      console.error(`[Drip Scheduler] Error processing enrollment ${enrollment.id}:`, error);
    }
  }

  if (processedCount > 0 || pendingEnrollments.length > 0) {
    console.log(`[Drip Scheduler] Processed ${processedCount}/${pendingEnrollments.length} enrollments`);
  }
}

/**
 * Auto-enroll a church in all active drip sequences matching a trigger type.
 * Used by external events (e.g., sample_shipped) to automatically start drip sequences.
 */
export async function enrollInDripSequence(
  churchId: number,
  triggerType: 'manual' | 'sample_shipped' | 'stage_change'
): Promise<void> {
  const { DripSequence, DripStep, DripEnrollment, Church, OutreachUnsubscribe } =
    await import('@/lib/db/models');
  const { Op } = await import('sequelize');

  // Find all active sequences with matching trigger
  const sequences = await DripSequence.findAll({
    where: {
      trigger: triggerType,
      is_active: true,
    },
  });

  if (sequences.length === 0) return;

  // Check if church exists
  const church = await Church.findByPk(churchId, { attributes: ['id', 'contact_email'] });
  if (!church) return;

  // Check unsubscribe status
  if (church.contact_email) {
    const unsubscribed = await OutreachUnsubscribe.findOne({
      where: { email: church.contact_email.toLowerCase() },
    });
    if (unsubscribed) return;
  }

  for (const sequence of sequences) {
    // Skip if already enrolled (active or paused)
    const existingEnrollment = await DripEnrollment.findOne({
      where: {
        church_id: churchId,
        sequence_id: sequence.id,
        status: { [Op.in]: ['active', 'paused'] },
      },
    });

    if (existingEnrollment) continue;

    // Get first step for delay calculation
    const firstStep = await DripStep.findOne({
      where: { sequence_id: sequence.id },
      order: [['step_order', 'ASC']],
    });

    if (!firstStep) continue;

    // Calculate next_step_at
    const nextStepAt = new Date();
    nextStepAt.setDate(nextStepAt.getDate() + firstStep.delay_days);

    await DripEnrollment.create({
      church_id: churchId,
      sequence_id: sequence.id,
      current_step: 0,
      status: 'active',
      next_step_at: nextStepAt,
      enrolled_at: new Date(),
    });

    console.log(`[Drip Scheduler] Auto-enrolled church ${churchId} in sequence "${sequence.name}" (trigger: ${triggerType})`);
  }
}

// Extend globalThis for HMR guard
declare global {
  // eslint-disable-next-line no-var
  var __dripSchedulerReady: boolean | undefined;
  // eslint-disable-next-line no-var
  var __initDripScheduler: (() => void) | undefined;
}

// Store on globalThis so server.js (plain JS) can call it
globalThis.__initDripScheduler = initDripScheduler;
