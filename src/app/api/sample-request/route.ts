import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Op } from 'sequelize';
import { Church, ChurchActivity } from '@/lib/db/models';
import { sendConfirmationEmail } from '@/lib/church-outreach/email-sender';
import { rateLimit } from '@/lib/utils/rate-limit';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

function getClientIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

const sampleRequestSchema = z.object({
  churchName: z.string().min(2, 'Church name must be at least 2 characters').max(255),
  pastorName: z.string().min(2, 'Pastor/leader name must be at least 2 characters').max(255),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().max(50).optional().or(z.literal('')),
  addressLine1: z.string().min(2, 'Street address must be at least 2 characters').max(255),
  addressLine2: z.string().max(255).optional().or(z.literal('')),
  city: z.string().min(2, 'City must be at least 2 characters').max(100),
  state: z.string().min(2, 'State is required').max(50),
  zipCode: z.string().min(3, 'ZIP code must be at least 3 characters').max(20),
  howHeardAboutUs: z.string().max(500).optional().or(z.literal('')),
  honeypot: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Rate limiting: 5 submissions per IP per hour
    const ip = getClientIP(req);
    const rateLimitResult = rateLimit(`sample-request:${ip}`, 5, 60 * 60 * 1000);
    if (!rateLimitResult.success) {
      return errorResponse('Too many requests. Please try again later.', 429);
    }

    const body = await req.json();

    // Validate input
    const parsed = sampleRequestSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return errorResponse(firstError?.message || 'Invalid input', 400);
    }

    const {
      churchName,
      pastorName,
      email,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      zipCode,
      howHeardAboutUs,
      honeypot,
    } = parsed.data;

    // Honeypot check: if filled, silently accept (don't reveal bot detection)
    if (honeypot) {
      return successResponse({ success: true });
    }

    // Duplicate detection: church name LIKE match + same ZIP code
    const existing = await Church.findOne({
      where: {
        name: { [Op.like]: `%${churchName}%` },
        zip_code: zipCode,
      },
    });

    if (existing) {
      // Don't create duplicate, but log the attempt
      await ChurchActivity.create({
        church_id: existing.id,
        activity_type: 'created',
        description: 'Duplicate sample request received',
        metadata: { email, pastorName, source: 'sample_request_duplicate' },
      });

      // Still send confirmation email (submitter doesn't know about duplicate)
      try {
        await sendConfirmationEmail(email, churchName);
      } catch {
        // Fire-and-forget: don't fail the request
      }

      return successResponse({ success: true });
    }

    // Create new church record
    const church = await Church.create({
      name: churchName,
      pastor_name: pastorName,
      contact_email: email,
      contact_phone: phone || null,
      address_line1: addressLine1,
      address_line2: addressLine2 || null,
      city,
      state,
      zip_code: zipCode,
      pipeline_stage: 'sample_requested',
      source: 'sample_request',
      notes: howHeardAboutUs || null,
    });

    // Log activity
    await ChurchActivity.create({
      church_id: church.id,
      activity_type: 'created',
      description: 'Submitted sample request via landing page',
    });

    // Send confirmation email (fire-and-forget)
    try {
      await sendConfirmationEmail(email, churchName);
    } catch {
      // Don't fail the request if email fails
    }

    return successResponse({ success: true });
  } catch (error) {
    return serverError(error, 'Failed to process sample request');
  }
}
