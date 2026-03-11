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

/**
 * GET /api/sample-request?cid=<churchId>
 * Load church info for the sample request form (public, limited fields).
 */
export async function GET(req: NextRequest) {
  try {
    const cid = Number(new URL(req.url).searchParams.get('cid'));
    if (!cid || isNaN(cid)) {
      return errorResponse('Missing church ID', 400);
    }

    const church = await Church.findByPk(cid, {
      attributes: ['id', 'name', 'pastor_name', 'contact_email', 'contact_phone',
                   'address_line1', 'address_line2', 'city', 'state', 'zip_code'],
    });

    if (!church) {
      return errorResponse('Church not found', 404);
    }

    return successResponse({
      id: church.id,
      name: church.name,
      pastorName: church.pastor_name,
      email: church.contact_email,
      phone: church.contact_phone,
      addressLine1: church.address_line1,
      addressLine2: church.address_line2,
      city: church.city,
      state: church.state,
      zipCode: church.zip_code,
    });
  } catch (error) {
    return serverError(error, 'Failed to load church');
  }
}

// Schema for submissions WITH a known church ID (from email CTA)
const knownChurchSchema = z.object({
  churchId: z.number().int().positive(),
  addressLine1: z.string().min(2, 'Street address is required').max(255),
  addressLine2: z.string().max(255).optional().or(z.literal('')),
  city: z.string().min(2, 'City is required').max(100),
  state: z.string().min(2, 'State is required').max(50),
  zipCode: z.string().min(3, 'ZIP code is required').max(20),
  phone: z.string().max(50).optional().or(z.literal('')),
  honeypot: z.string().optional(),
});

// Schema for organic submissions (no church ID — new visitor)
const newChurchSchema = z.object({
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
    const ip = getClientIP(req);
    const rateLimitResult = rateLimit(`sample-request:${ip}`, 5, 60 * 60 * 1000);
    if (!rateLimitResult.success) {
      return errorResponse('Too many requests. Please try again later.', 429);
    }

    const body = await req.json();

    // ---- Known church flow (from email CTA with ?cid=) ----
    if (body.churchId) {
      const parsed = knownChurchSchema.safeParse(body);
      if (!parsed.success) {
        const firstError = parsed.error.issues[0];
        return errorResponse(firstError?.message || 'Invalid input', 400);
      }

      if (parsed.data.honeypot) {
        return successResponse({ success: true });
      }

      const { SampleShipment } = await import('@/lib/db/models');

      const church = await Church.findByPk(parsed.data.churchId);
      if (!church) {
        return errorResponse('Church not found', 404);
      }

      // Update church shipping address
      await church.update({
        address_line1: parsed.data.addressLine1,
        address_line2: parsed.data.addressLine2 || null,
        city: parsed.data.city,
        state: parsed.data.state,
        zip_code: parsed.data.zipCode,
        contact_phone: parsed.data.phone || church.contact_phone,
        pipeline_stage: 'sample_requested',
      });

      // Create a pending sample shipment
      const address = [
        parsed.data.addressLine1,
        parsed.data.addressLine2,
        `${parsed.data.city}, ${parsed.data.state} ${parsed.data.zipCode}`,
      ].filter(Boolean).join('\n');

      await SampleShipment.create({
        church_id: church.id,
        ship_date: new Date().toISOString().slice(0, 10),
        status: 'pending',
        shipping_address: address,
        created_by: null, // system-created (public form)
      });

      await ChurchActivity.create({
        church_id: church.id,
        activity_type: 'created',
        description: 'Submitted sample request via email CTA',
      });

      // Confirmation email
      try {
        await sendConfirmationEmail(church.contact_email || '', church.name);
      } catch {
        // fire-and-forget
      }

      return successResponse({ success: true });
    }

    // ---- Organic flow (new visitor, no church ID) ----
    const parsed = newChurchSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return errorResponse(firstError?.message || 'Invalid input', 400);
    }

    const {
      churchName, pastorName, email, phone,
      addressLine1, addressLine2, city, state, zipCode,
      howHeardAboutUs, honeypot,
    } = parsed.data;

    if (honeypot) {
      return successResponse({ success: true });
    }

    // Duplicate detection
    const existing = await Church.findOne({
      where: {
        name: { [Op.like]: `%${churchName}%` },
        zip_code: zipCode,
      },
    });

    if (existing) {
      await ChurchActivity.create({
        church_id: existing.id,
        activity_type: 'created',
        description: 'Duplicate sample request received',
        metadata: { email, pastorName, source: 'sample_request_duplicate' },
      });

      try {
        await sendConfirmationEmail(email, churchName);
      } catch {
        // fire-and-forget
      }

      return successResponse({ success: true });
    }

    const { SampleShipment } = await import('@/lib/db/models');

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

    // Create pending shipment
    const address = [
      addressLine1, addressLine2,
      `${city}, ${state} ${zipCode}`,
    ].filter(Boolean).join('\n');

    await SampleShipment.create({
      church_id: church.id,
      ship_date: new Date().toISOString().slice(0, 10),
      status: 'pending',
      shipping_address: address,
      created_by: 0,
    });

    await ChurchActivity.create({
      church_id: church.id,
      activity_type: 'created',
      description: 'Submitted sample request via landing page',
    });

    try {
      await sendConfirmationEmail(email, churchName);
    } catch {
      // fire-and-forget
    }

    return successResponse({ success: true });
  } catch (error) {
    return serverError(error, 'Failed to process sample request');
  }
}
