import { NextRequest } from 'next/server';

/**
 * GET /api/church-outreach/unsubscribe?email={encodedEmail}
 *
 * Public unsubscribe endpoint (no auth required).
 * Creates an OutreachUnsubscribe record, cancels active drip enrollments,
 * and returns a simple branded HTML confirmation page.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const email = url.searchParams.get('email');

  if (!email) {
    return new Response(buildHtmlPage('Invalid Request', 'No email address provided.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const { OutreachUnsubscribe, Church, DripEnrollment, ChurchActivity } =
      await import('@/lib/db/models');
    const { Op } = await import('sequelize');

    // Create or find unsubscribe record
    const [unsub, created] = await OutreachUnsubscribe.findOrCreate({
      where: { email: normalizedEmail },
      defaults: {
        email: normalizedEmail,
        unsubscribed_at: new Date(),
      },
    });

    // Try to find the church by contact_email and set church_id if not already set
    let churchId = unsub.church_id;
    if (!churchId) {
      const church = await Church.findOne({
        where: { contact_email: normalizedEmail },
        attributes: ['id'],
      });

      if (church) {
        churchId = church.id;
        await unsub.update({ church_id: church.id });
      }
    }

    if (churchId) {
      // Set pipeline_stage to 'unsubscribed'
      await Church.update(
        { pipeline_stage: 'unsubscribed' },
        { where: { id: churchId } }
      );

      // Cancel any active drip enrollments
      await DripEnrollment.update(
        { status: 'cancelled', next_step_at: null },
        {
          where: {
            church_id: churchId,
            status: { [Op.in]: ['active', 'paused'] },
          },
        }
      );

      // Log activity
      await ChurchActivity.create({
        church_id: churchId,
        activity_type: 'stage_change',
        description: 'Church unsubscribed via email link',
        metadata: { from_stage: 'unknown', to_stage: 'unsubscribed' },
      });
    }

    const message = created
      ? "You've been successfully unsubscribed from Free Luma Bracelets outreach emails. You will no longer receive marketing emails from us."
      : "You were already unsubscribed. You will not receive any outreach emails from Free Luma Bracelets.";

    return new Response(buildHtmlPage('Unsubscribed', message), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    console.error('[Unsubscribe] Error:', error);
    return new Response(
      buildHtmlPage('Error', 'Something went wrong processing your unsubscribe request. Please try again later.'),
      {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }
}

/**
 * Build a simple branded HTML page for the unsubscribe confirmation.
 */
function buildHtmlPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Free Luma Bracelets</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8f9fa;
      color: #333;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 12px;
      padding: 48px 40px;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    }
    .logo {
      font-size: 24px;
      font-weight: 700;
      color: #7c3aed;
      margin-bottom: 24px;
    }
    h1 {
      font-size: 22px;
      margin-bottom: 16px;
      color: #111;
    }
    p {
      font-size: 16px;
      line-height: 1.6;
      color: #555;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Free Luma Bracelets</div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
