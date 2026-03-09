import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { PIPELINE_STAGES, type PipelineStage } from '@/lib/db/models/Church';
import { CARRIER_TYPES } from '@/lib/db/models/SampleShipment';

const createSampleSchema = z.object({
  churchId: z.number().int().positive(),
  shipDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  trackingNumber: z.string().max(100).nullish(),
  carrier: z.enum(CARRIER_TYPES).optional().default('usps'),
  braceletType: z.string().max(255).nullish(),
  quantity: z.number().int().positive().nullish(),
  shippingAddress: z.string().nullish(),
  notes: z.string().nullish(),
});

/**
 * Pipeline stage ordering for auto-advance logic.
 * A sample shipment only advances the church if its current stage
 * is 'sample_requested' or earlier in the pipeline.
 */
const STAGE_INDEX = Object.fromEntries(
  PIPELINE_STAGES.map((s, i) => [s, i])
) as Record<PipelineStage, number>;

/**
 * GET /api/admin/church-outreach/samples - List all sample shipments
 *
 * Returns shipments with church name, cursor pagination, ordered by ship_date DESC.
 */
export const GET = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const { SampleShipment, Church } = await import('@/lib/db/models');
    const { Op } = await import('sequelize');

    const url = new URL(req.url);
    const cursor = url.searchParams.get('cursor');
    const limit = Math.min(Number(url.searchParams.get('limit')) || 25, 100);

    const where: Record<string, unknown> = {};
    if (cursor) {
      where.id = { [Op.lt]: Number(cursor) };
    }

    const shipments = await SampleShipment.findAll({
      where,
      include: [
        {
          model: Church,
          as: 'church',
          attributes: ['id', 'name', 'pipeline_stage'],
        },
      ],
      order: [['ship_date', 'DESC'], ['id', 'DESC']],
      limit: limit + 1,
    });

    const hasMore = shipments.length > limit;
    const results = hasMore ? shipments.slice(0, limit) : shipments;
    const nextCursor = hasMore ? results[results.length - 1].id : null;

    return successResponse({ shipments: results, nextCursor });
  } catch (error) {
    return serverError(error, 'Failed to fetch sample shipments');
  }
});

/**
 * POST /api/admin/church-outreach/samples - Create a sample shipment
 *
 * Auto-advances church pipeline_stage to 'sample_sent' if current stage
 * is 'sample_requested' or earlier. Triggers drip enrollment fire-and-forget.
 */
export const POST = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const body = await req.json();
    const parsed = createSampleSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues.map((e: { message: string }) => e.message).join(', '));
    }

    const { churchId, shipDate, trackingNumber, carrier, braceletType, quantity, shippingAddress, notes } = parsed.data;

    const { SampleShipment, Church, ChurchActivity } = await import('@/lib/db/models');

    // Verify church exists
    const church = await Church.findByPk(churchId);
    if (!church) {
      return errorResponse('Church not found', 404);
    }

    // Create shipment record
    const shipment = await SampleShipment.create({
      church_id: churchId,
      ship_date: shipDate,
      tracking_number: trackingNumber ?? null,
      carrier: carrier!,
      bracelet_type: braceletType ?? null,
      quantity: quantity ?? null,
      shipping_address: shippingAddress ?? null,
      notes: notes ?? null,
      created_by: context.user.id,
    });

    // Auto-advance pipeline stage to 'sample_sent' if at 'sample_requested' or earlier
    const sampleSentIndex = STAGE_INDEX['sample_sent'];
    const currentIndex = STAGE_INDEX[church.pipeline_stage];
    if (currentIndex < sampleSentIndex) {
      await church.update({ pipeline_stage: 'sample_sent' });
    }

    // Log activity
    await ChurchActivity.create({
      church_id: churchId,
      activity_type: 'sample_shipped',
      description: `Sample shipped via ${carrier}: ${quantity ?? '?'} bracelets`,
      metadata: {
        shipment_id: shipment.id,
        tracking_number: trackingNumber ?? null,
        carrier,
        bracelet_type: braceletType ?? null,
        quantity: quantity ?? null,
      },
      admin_id: context.user.id,
    });

    // Fire-and-forget: enroll in drip sequence for sample_shipped trigger
    import('@/lib/church-outreach/drip-scheduler').then(({ enrollInDripSequence }) => {
      enrollInDripSequence(churchId, 'sample_shipped').catch((err: unknown) => {
        console.error('[Samples API] Drip enrollment error:', err);
      });
    });

    return successResponse(shipment, 201);
  } catch (error) {
    return serverError(error, 'Failed to create sample shipment');
  }
});
