import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { SHIPMENT_STATUSES } from '@/lib/db/models/SampleShipment';
import { CARRIER_TYPES } from '@/lib/db/models/SampleShipment';

const updateSchema = z.object({
  trackingNumber: z.string().max(100).nullish(),
  carrier: z.enum(CARRIER_TYPES).optional(),
  status: z.enum(SHIPMENT_STATUSES).optional(),
  notes: z.string().nullish(),
});

/**
 * PATCH /api/admin/church-outreach/samples/[id]
 * Update a sample shipment (tracking, status, etc.)
 */
export const PATCH = withAdmin(async (req: NextRequest, context: AuthContext) => {
  try {
    const id = Number(req.url.split('/samples/')[1]);
    if (!id || isNaN(id)) return errorResponse('Invalid shipment ID', 400);

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues.map((e: { message: string }) => e.message).join(', '));
    }

    const { SampleShipment, Church, ChurchActivity } = await import('@/lib/db/models');

    const shipment = await SampleShipment.findByPk(id, {
      include: [{ model: Church, as: 'church', attributes: ['id', 'name', 'pipeline_stage'] }],
    });
    if (!shipment) return errorResponse('Shipment not found', 404);

    const updates: Record<string, unknown> = {};
    if (parsed.data.trackingNumber !== undefined) updates.tracking_number = parsed.data.trackingNumber;
    if (parsed.data.carrier) updates.carrier = parsed.data.carrier;
    if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;

    // Status transitions
    if (parsed.data.status && parsed.data.status !== shipment.status) {
      updates.status = parsed.data.status;

      if (parsed.data.status === 'delivered') {
        updates.delivered_at = new Date();

        // Log activity
        await ChurchActivity.create({
          church_id: shipment.church_id,
          activity_type: 'sample_shipped',
          description: 'Sample marked as delivered',
          metadata: { shipment_id: shipment.id },
          admin_id: context.user.id,
        });
      }

      if (parsed.data.status === 'shipped' && shipment.status === 'pending') {
        // Log activity
        await ChurchActivity.create({
          church_id: shipment.church_id,
          activity_type: 'sample_shipped',
          description: `Sample shipped via ${parsed.data.carrier || shipment.carrier}`,
          metadata: {
            shipment_id: shipment.id,
            tracking_number: parsed.data.trackingNumber ?? shipment.tracking_number,
          },
          admin_id: context.user.id,
        });
      }
    }

    if (Object.keys(updates).length === 0) {
      return successResponse(shipment);
    }

    await shipment.update(updates);

    // Reload with association
    await shipment.reload({
      include: [{ model: Church, as: 'church', attributes: ['id', 'name', 'pipeline_stage'] }],
    });

    return successResponse(shipment);
  } catch (error) {
    return serverError(error, 'Failed to update shipment');
  }
});
