import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/lib/auth/jwt';
import {
  generateMonthContent,
  generateDayContent,
  type ProgressEvent,
} from '@/lib/content-pipeline/pipeline-runner';

/**
 * POST /api/admin/content-production/generate
 *
 * SSE streaming endpoint for content generation. Streams real-time progress
 * events back to the client as the pipeline generates content.
 *
 * Because SSE returns a streaming Response, we cannot use the withAdmin HOF.
 * Instead, we manually verify admin auth before creating the stream.
 *
 * Body:
 *   month: string (YYYY-MM)
 *   mode: 'bible' | 'positivity'
 *   day?: number (optional -- single day generation)
 */
export async function POST(req: NextRequest): Promise<Response> {
  // ---- Manual admin auth check (cannot use withAdmin with SSE) ----
  const cookieStore = await cookies();
  let token = cookieStore.get('auth_token')?.value;

  if (!token) {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await verifyJWT(token);
  if (!user) {
    return NextResponse.json(
      { error: 'Invalid or expired token' },
      { status: 401 }
    );
  }

  // Verify admin status
  const { User } = await import('@/lib/db/models');
  const dbUser = await User.findByPk(user.id, { attributes: ['id', 'is_admin'] });
  if (!dbUser || !dbUser.is_admin) {
    return NextResponse.json(
      { error: 'Forbidden: admin access required' },
      { status: 403 }
    );
  }

  // ---- Parse request body ----
  let body: { month?: string; mode?: string; day?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { month, mode, day } = body;

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: 'month is required (YYYY-MM format)' },
      { status: 400 }
    );
  }

  if (mode !== 'bible' && mode !== 'positivity') {
    return NextResponse.json(
      { error: 'mode must be "bible" or "positivity"' },
      { status: 400 }
    );
  }

  if (day !== undefined && (typeof day !== 'number' || day < 1 || day > 31)) {
    return NextResponse.json(
      { error: 'day must be a number 1-31 if provided' },
      { status: 400 }
    );
  }

  // ---- Create SSE stream ----
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: ProgressEvent) => {
        try {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch {
          // Stream may have been closed by client
        }
      };

      try {
        if (day) {
          // Single day generation
          const [yearStr, monthStr] = month.split('-');
          const date = `${yearStr}-${monthStr}-${String(day).padStart(2, '0')}`;

          sendEvent({
            type: 'progress',
            day: 1,
            total: 1,
            step: 'starting',
            message: `Generating content for ${date} (${mode})`,
          });

          const result = await generateDayContent(date, mode, sendEvent);

          sendEvent({
            type: 'complete',
            message: result.success
              ? `Day ${date} generated successfully`
              : `Day ${date} failed: ${result.error}`,
          });
        } else {
          // Full month generation
          sendEvent({
            type: 'progress',
            step: 'starting',
            message: `Generating ${mode} content for ${month}`,
          });

          const result = await generateMonthContent(month, mode, sendEvent);

          sendEvent({
            type: 'complete',
            message: `Month complete: ${result.generated} generated, ${result.failed} failed`,
          });
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        sendEvent({ type: 'error', error: errMsg, message: `Fatal error: ${errMsg}` });
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
