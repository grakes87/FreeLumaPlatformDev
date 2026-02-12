import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { isB2Configured } from '@/lib/storage/b2';
import { getUploadUrl, getPublicUrl, generateKey } from '@/lib/storage/presign';

/**
 * Allowed content types per upload type.
 */
const ALLOWED_CONTENT_TYPES: Record<string, string[]> = {
  avatar: ['image/jpeg', 'image/png', 'image/webp'],
  'daily-content': [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
  ],
};

/**
 * Upload types that require admin privileges.
 */
const ADMIN_ONLY_TYPES = new Set(['daily-content']);

/**
 * GET /api/upload/presigned
 *
 * Generate a presigned URL for direct browser-to-B2 upload.
 *
 * Query params:
 *   - type: Upload type (e.g., 'avatar', 'daily-content')
 *   - contentType: MIME type of the file
 *
 * Returns:
 *   - uploadUrl: Presigned PUT URL for B2
 *   - key: The object key in the bucket
 *   - publicUrl: The public CDN URL for the uploaded file
 */
export const GET = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    // Check if B2 is configured
    if (!isB2Configured) {
      return NextResponse.json(
        { error: 'Storage not configured' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const contentType = searchParams.get('contentType');

    // Validate required params
    if (!type || !contentType) {
      return NextResponse.json(
        { error: 'Missing required query parameters: type, contentType' },
        { status: 400 }
      );
    }

    // Validate upload type
    const allowedTypes = ALLOWED_CONTENT_TYPES[type];
    if (!allowedTypes) {
      return NextResponse.json(
        { error: `Invalid upload type: ${type}` },
        { status: 400 }
      );
    }

    // Check admin-only types
    if (ADMIN_ONLY_TYPES.has(type)) {
      // We need to check if user is admin - fetch from DB
      const { User } = await import('@/lib/db/models/User');
      const user = await User.findByPk(context.user.id);
      if (!user?.is_admin) {
        return NextResponse.json(
          { error: 'Forbidden: admin access required' },
          { status: 403 }
        );
      }
    }

    // Validate content type for this upload type
    if (!allowedTypes.includes(contentType)) {
      return NextResponse.json(
        {
          error: `Invalid content type "${contentType}" for upload type "${type}". Allowed: ${allowedTypes.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Generate unique key and presigned URL
    const key = generateKey(
      type === 'avatar' ? 'avatars' : type,
      context.user.id,
      contentType
    );

    try {
      const uploadUrl = await getUploadUrl(key, contentType);
      const publicUrl = getPublicUrl(key);

      return NextResponse.json({ uploadUrl, key, publicUrl });
    } catch (err) {
      console.error('[Presigned URL] Error generating URL:', err);
      return NextResponse.json(
        { error: 'Failed to generate upload URL' },
        { status: 500 }
      );
    }
  }
);
