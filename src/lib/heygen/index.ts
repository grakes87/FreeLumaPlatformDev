/**
 * HeyGen REST API client for AI avatar video generation.
 *
 * Creates portrait (1080x1920) AI videos from script text using
 * HeyGen avatars. Supports async generation with webhook callbacks.
 */

const HEYGEN_BASE_URL = 'https://api.heygen.com';

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class HeygenError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public apiError?: string,
  ) {
    super(message);
    this.name = 'HeygenError';
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateVideoParams {
  /** HeyGen avatar ID (from creator profile) */
  avatarId: string;
  /** Script text for the avatar to speak */
  scriptText: string;
  /** HeyGen API key */
  apiKey: string;
  /** Optional webhook URL for completion callback */
  callbackUrl?: string;
  /** Optional voice ID override (defaults to avatar's voice) */
  voiceId?: string;
}

export interface VideoStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  video_url?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Create a portrait AI video using a HeyGen avatar.
 *
 * @returns The HeyGen video ID for tracking
 * @throws HeygenError on API failure
 */
export async function createHeygenVideo(params: CreateVideoParams): Promise<string> {
  const { avatarId, scriptText, apiKey, callbackUrl, voiceId } = params;

  // Build voice config - always text-to-speech, optionally with a specific voice ID
  const voiceConfig = voiceId
    ? { type: 'text', voice_id: voiceId, input_text: scriptText }
    : { type: 'text', input_text: scriptText };

  const body = {
    video_inputs: [
      {
        character: {
          type: 'avatar',
          avatar_id: avatarId,
          avatar_style: 'normal',
        },
        voice: voiceConfig,
        background: {
          type: 'color',
          value: '#000000',
        },
      },
    ],
    dimension: { width: 1080, height: 1920 },
    ...(callbackUrl ? { callback_url: callbackUrl } : {}),
  };

  console.log('[HeyGen] Request body:', JSON.stringify(body, null, 2));

  const response = await fetch(`${HEYGEN_BASE_URL}/v2/video/generate`, {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error');
    console.error('[HeyGen] Error response:', response.status, text);
    let errorMessage: string;
    try {
      const parsed = JSON.parse(text);
      errorMessage = parsed.error?.message || parsed.message || text;
    } catch {
      errorMessage = text;
    }
    throw new HeygenError(
      `HeyGen video creation failed: ${errorMessage}`,
      response.status,
      errorMessage,
    );
  }

  const data = await response.json();
  const videoId = data?.data?.video_id;

  if (!videoId) {
    throw new HeygenError(
      'HeyGen response missing video_id',
      200,
      'No video_id in response',
    );
  }

  return videoId as string;
}

/**
 * Check the status of a HeyGen video generation job.
 *
 * @returns Normalized status object
 * @throws HeygenError on API failure
 */
export async function checkHeygenStatus(videoId: string, apiKey: string): Promise<VideoStatus> {
  const response = await fetch(
    `${HEYGEN_BASE_URL}/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`,
    {
      method: 'GET',
      headers: {
        'X-API-KEY': apiKey,
      },
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error');
    throw new HeygenError(
      `HeyGen status check failed: ${text}`,
      response.status,
      text,
    );
  }

  const data = await response.json();
  const videoData = data?.data;

  // Normalize HeyGen status values to our known set
  const rawStatus: string = videoData?.status ?? 'pending';
  const normalizedStatus = normalizeStatus(rawStatus);

  return {
    status: normalizedStatus,
    ...(videoData?.video_url ? { video_url: videoData.video_url as string } : {}),
    ...(videoData?.error ? { error: videoData.error as string } : {}),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeStatus(raw: string): VideoStatus['status'] {
  switch (raw.toLowerCase()) {
    case 'completed':
    case 'done':
      return 'completed';
    case 'processing':
    case 'rendering':
      return 'processing';
    case 'failed':
    case 'error':
      return 'failed';
    default:
      return 'pending';
  }
}
