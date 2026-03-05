import { NextRequest, NextResponse } from 'next/server';
import { Op } from 'sequelize';
import { withCreator, type CreatorContext } from '@/lib/auth/middleware';

/**
 * GET /api/creator/stats
 * Returns lifetime and current-month stats for the authenticated creator.
 */
export const GET = withCreator(async (req: NextRequest, context: CreatorContext) => {
  const { DailyContent } = await import('@/lib/db/models');

  // Get all assignments for this creator
  const allAssignments = await DailyContent.findAll({
    where: { creator_id: context.creator.id },
    attributes: ['status', 'post_date'],
    raw: true,
  });

  // Lifetime stats
  const total = {
    assigned: allAssignments.length,
    completed: allAssignments.filter((a) => a.status === 'submitted' || a.status === 'approved').length,
    pending: allAssignments.filter((a) => a.status === 'assigned' || a.status === 'rejected').length,
    approved: allAssignments.filter((a) => a.status === 'approved').length,
    rejected: allAssignments.filter((a) => a.status === 'rejected').length,
  };

  // Selected month from query param, or current month
  const monthParam = req.nextUrl.searchParams.get('month');
  let year: number, month: number;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split('-').map(Number);
    year = y;
    month = m;
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const selectedMonthAssignments = allAssignments.filter((a) => {
    const d = String(a.post_date);
    return d >= startDate && d <= endDate;
  });

  const current_month = {
    assigned: selectedMonthAssignments.length,
    completed: selectedMonthAssignments.filter((a) => a.status === 'submitted' || a.status === 'approved').length,
    pending: selectedMonthAssignments.filter((a) => a.status === 'assigned' || a.status === 'rejected').length,
  };

  return NextResponse.json({ total, current_month });
});
