import { NextRequest } from 'next/server';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

/**
 * GET /api/admin/church-outreach/unsubscribed
 * List churches with pipeline_stage = 'unsubscribed'
 */
export const GET = withAdmin(async (_req: NextRequest, _ctx: AuthContext) => {
  try {
    const { Church, OutreachUnsubscribe } = await import('@/lib/db/models');

    const churches = await Church.findAll({
      where: { pipeline_stage: 'unsubscribed' },
      attributes: [
        'id', 'name', 'pastor_name', 'contact_email', 'city', 'state',
        'source', 'denomination', 'created_at',
      ],
      order: [['updated_at', 'DESC']],
    });

    // Fetch unsubscribe dates for these churches
    const churchIds = churches.map((c) => c.id);
    const unsubRecords = churchIds.length > 0
      ? await OutreachUnsubscribe.findAll({
          where: { church_id: churchIds },
          attributes: ['church_id', 'unsubscribed_at'],
        })
      : [];

    const unsubMap = new Map(
      unsubRecords.map((u) => [u.church_id, u.unsubscribed_at])
    );

    const data = churches.map((c) => ({
      id: c.id,
      name: c.name,
      pastor_name: c.pastor_name,
      contact_email: c.contact_email,
      city: c.city,
      state: c.state,
      source: c.source,
      denomination: c.denomination,
      created_at: c.created_at,
      unsubscribed_at: unsubMap.get(c.id) || c.updated_at,
    }));

    return successResponse({ churches: data });
  } catch (err) {
    return serverError(err);
  }
});

/**
 * PATCH /api/admin/church-outreach/unsubscribed
 * Re-subscribe a church: set pipeline_stage back to 'new_lead', delete unsubscribe record
 */
export const PATCH = withAdmin(async (req: NextRequest, _ctx: AuthContext) => {
  try {
    const body = await req.json();
    const churchId = body.churchId;

    if (!churchId || typeof churchId !== 'number') {
      return errorResponse('churchId is required', 400);
    }

    const { Church, OutreachUnsubscribe, ChurchActivity } = await import('@/lib/db/models');

    const church = await Church.findByPk(churchId);
    if (!church) {
      return errorResponse('Church not found', 404);
    }

    if (church.pipeline_stage !== 'unsubscribed') {
      return errorResponse('Church is not unsubscribed', 400);
    }

    // Move back to new_lead
    await church.update({ pipeline_stage: 'new_lead' });

    // Delete the unsubscribe record
    await OutreachUnsubscribe.destroy({ where: { church_id: churchId } });

    // Log activity
    await ChurchActivity.create({
      church_id: churchId,
      activity_type: 'stage_change',
      description: 'Church re-subscribed by admin',
      metadata: { from_stage: 'unsubscribed', to_stage: 'new_lead' },
    });

    return successResponse({ message: 'Church re-subscribed successfully' });
  } catch (err) {
    return serverError(err);
  }
});
