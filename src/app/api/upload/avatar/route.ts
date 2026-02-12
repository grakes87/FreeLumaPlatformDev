import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import { isB2Configured } from '@/lib/storage/b2';
import { getPublicUrl } from '@/lib/storage/presign';

/**
 * POST /api/upload/avatar
 *
 * Confirm avatar upload and update the user's avatar_url.
 * Called after the client has uploaded the cropped avatar to B2 via presigned URL.
 *
 * Body: { key: string } - The B2 object key where the avatar was uploaded
 *
 * Returns: Updated user data with new avatar_url
 */
export const POST = withAuth(
  async (req: NextRequest, context: AuthContext) => {
    // Check if B2 is configured
    if (!isB2Configured) {
      return NextResponse.json(
        { error: 'Storage not configured' },
        { status: 503 }
      );
    }

    let body: { key?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { key } = body;

    if (!key || typeof key !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: key' },
        { status: 400 }
      );
    }

    // Validate key format: should start with avatars/{userId}/
    const expectedPrefix = `avatars/${context.user.id}/`;
    if (!key.startsWith(expectedPrefix)) {
      return NextResponse.json(
        { error: 'Invalid avatar key: does not match authenticated user' },
        { status: 403 }
      );
    }

    // Generate the public URL for the uploaded avatar
    const avatarUrl = getPublicUrl(key);

    // Update the user's avatar_url in the database
    try {
      const { User } = await import('@/lib/db/models/User');
      const user = await User.findByPk(context.user.id);

      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      await user.update({ avatar_url: avatarUrl });

      return NextResponse.json({
        user: {
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          username: user.username,
          avatar_url: user.avatar_url,
          avatar_color: user.avatar_color,
          bio: user.bio,
          mode: user.mode,
          onboarding_complete: user.onboarding_complete,
          is_admin: user.is_admin,
          preferred_translation: user.preferred_translation,
          language: user.language,
          timezone: user.timezone,
        },
      });
    } catch (err) {
      console.error('[Avatar] Error updating avatar:', err);
      return NextResponse.json(
        { error: 'Failed to update avatar' },
        { status: 500 }
      );
    }
  }
);
