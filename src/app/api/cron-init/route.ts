/**
 * GET /api/cron-init
 * Called once by server.js worker #1 on startup to initialize cron schedulers.
 * Uses dynamic imports so Next.js module resolution handles @/ aliases.
 * Only accessible from localhost (127.0.0.1).
 */
export async function GET(request: Request) {
  // Only allow from localhost
  const forwarded = request.headers.get('x-forwarded-for');
  const host = request.headers.get('host') || '';
  if (forwarded && !forwarded.startsWith('127.0.0.1') && !host.startsWith('127.0.0.1')) {
    return Response.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  if (globalThis.__cronSchedulersStarted) {
    return Response.json({ ok: true, status: 'already_started' });
  }
  globalThis.__cronSchedulersStarted = true;

  const started: string[] = [];
  const failed: string[] = [];

  try {
    const { initEmailScheduler } = await import('@/lib/email/scheduler');
    initEmailScheduler();
    started.push('email');
  } catch (err) {
    console.error('[Cron] Email scheduler init failed:', err);
    failed.push('email');
  }

  try {
    const { initAccountCleanup } = await import('@/lib/cron/accountCleanup');
    initAccountCleanup();
    started.push('accountCleanup');
  } catch (err) {
    console.error('[Cron] Account cleanup init failed:', err);
    failed.push('accountCleanup');
  }

  try {
    const { initDripScheduler } = await import('@/lib/church-outreach/drip-scheduler');
    initDripScheduler();
    started.push('drip');
  } catch (err) {
    console.error('[Cron] Drip scheduler init failed:', err);
    failed.push('drip');
  }

  try {
    const { initAutoDiscoveryScheduler } = await import('@/lib/church-outreach/auto-discovery-scheduler');
    initAutoDiscoveryScheduler();
    started.push('autoDiscovery');
  } catch (err) {
    console.error('[Cron] Auto-discovery init failed:', err);
    failed.push('autoDiscovery');
  }

  try {
    const { initSampleFollowUpScheduler } = await import('@/lib/church-outreach/sample-followup-scheduler');
    initSampleFollowUpScheduler();
    started.push('sampleFollowUp');
  } catch (err) {
    console.error('[Cron] Sample follow-up init failed:', err);
    failed.push('sampleFollowUp');
  }

  try {
    const { initWorkshopCrons } = await import('@/lib/workshop/reminders');
    initWorkshopCrons();
    started.push('workshop');
  } catch (err) {
    console.error('[Cron] Workshop crons init failed:', err);
    failed.push('workshop');
  }

  console.log(`[Cron] Schedulers initialized — started: [${started.join(', ')}], failed: [${failed.join(', ')}]`);

  return Response.json({ ok: true, started, failed });
}
