/**
 * Agora Cloud Recording REST API wrapper.
 *
 * Manages the full recording lifecycle: acquire -> start -> stop -> query.
 * Recordings are stored in Backblaze B2 via S3-compatible API (vendor 11).
 *
 * @see https://docs.agora.io/en/cloud-recording/develop/composite-mode
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecordingFile {
  fileName: string;
  trackType: string;
}

interface StartRecordingResult {
  sid: string;
}

interface StopRecordingResult {
  fileList: RecordingFile[];
}

interface QueryRecordingResult {
  status: number;
  fileList?: Array<{ fileName: string }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEnvOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} environment variable is not set. Required for Agora Cloud Recording.`
    );
  }
  return value;
}

function getAuthHeader(): string {
  const customerId = getEnvOrThrow('AGORA_CUSTOMER_ID');
  const customerSecret = getEnvOrThrow('AGORA_CUSTOMER_SECRET');
  return `Basic ${Buffer.from(`${customerId}:${customerSecret}`).toString('base64')}`;
}

function getBaseUrl(): string {
  const appId = getEnvOrThrow('AGORA_APP_ID');
  return `https://api.agora.io/v1/apps/${appId}/cloud_recording`;
}

/**
 * Compute a unique recording UID for a given workshop.
 * Uses 900000 + workshopId to avoid collision with real user IDs.
 */
export function getRecordingUid(workshopId: number): number {
  return 900000 + workshopId;
}

// ---------------------------------------------------------------------------
// Cloud Recording Lifecycle
// ---------------------------------------------------------------------------

/**
 * Step 1: Acquire a recording resource ID.
 * The resource ID is valid for 5 minutes -- call startCloudRecording immediately after.
 *
 * @param channelName - The Agora channel to record (e.g., "workshop-123")
 * @param recordingUid - Unique UID for the recording bot (use getRecordingUid())
 * @returns The resource ID needed for start/stop/query
 */
export async function acquireRecordingResource(
  channelName: string,
  recordingUid: number
): Promise<string> {
  const baseUrl = getBaseUrl();
  const authHeader = getAuthHeader();

  const response = await fetch(`${baseUrl}/acquire`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      cname: channelName,
      uid: String(recordingUid),
      clientRequest: {
        resourceExpiredHour: 24,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Agora Cloud Recording acquire failed (${response.status}): ${body}`
    );
  }

  const data = (await response.json()) as { resourceId: string };
  return data.resourceId;
}

/**
 * Step 2: Start composite-mode cloud recording.
 * Mixes all video streams into a single 720p/30fps recording.
 *
 * @param channelName - The Agora channel to record
 * @param recordingUid - Unique UID for the recording bot
 * @param token - A valid Agora RTC token for the recording bot
 * @param resourceId - Resource ID from acquireRecordingResource()
 * @returns The recording session ID (sid)
 */
export async function startCloudRecording(
  channelName: string,
  recordingUid: number,
  token: string,
  resourceId: string
): Promise<StartRecordingResult> {
  const baseUrl = getBaseUrl();
  const authHeader = getAuthHeader();

  // B2 storage configuration
  const bucket = getEnvOrThrow('B2_BUCKET_NAME');
  const accessKey = getEnvOrThrow('B2_KEY_ID');
  const secretKey = getEnvOrThrow('B2_APP_KEY');
  const region = getEnvOrThrow('B2_REGION');

  const response = await fetch(
    `${baseUrl}/resourceid/${resourceId}/mode/mix/start`,
    {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cname: channelName,
        uid: String(recordingUid),
        clientRequest: {
          token,
          recordingConfig: {
            channelType: 1, // 1 = live broadcast
            streamTypes: 2, // audio + video
            maxIdleTime: 300, // 5 min idle timeout
            transcodingConfig: {
              width: 1280,
              height: 720,
              fps: 30,
              bitrate: 1500,
              mixedVideoLayout: 1, // Best fit layout
            },
          },
          recordingFileConfig: {
            avFileType: ['hls', 'mp4'],
          },
          storageConfig: {
            vendor: 11, // S3-compatible (Backblaze B2)
            region: 0, // Required field, 0 for S3-compatible
            bucket,
            accessKey,
            secretKey,
            fileNamePrefix: ['workshop-recordings'],
            extensionParams: {
              sse: 'none',
              tag: 'workshop',
              endpoint: `https://s3.${region}.backblazeb2.com`,
            },
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Agora Cloud Recording start failed (${response.status}): ${body}`
    );
  }

  const data = (await response.json()) as { sid: string };
  return { sid: data.sid };
}

/**
 * Step 3: Stop cloud recording and retrieve the file list.
 *
 * @param channelName - The Agora channel being recorded
 * @param recordingUid - Unique UID for the recording bot
 * @param resourceId - Resource ID from acquireRecordingResource()
 * @param sid - Session ID from startCloudRecording()
 * @returns The list of recorded files (HLS + MP4)
 */
export async function stopCloudRecording(
  channelName: string,
  recordingUid: number,
  resourceId: string,
  sid: string
): Promise<StopRecordingResult> {
  const baseUrl = getBaseUrl();
  const authHeader = getAuthHeader();

  const response = await fetch(
    `${baseUrl}/resourceid/${resourceId}/sid/${sid}/mode/mix/stop`,
    {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cname: channelName,
        uid: String(recordingUid),
        clientRequest: {},
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Agora Cloud Recording stop failed (${response.status}): ${body}`
    );
  }

  const data = (await response.json()) as {
    serverResponse?: {
      fileList?: RecordingFile[];
    };
  };

  return {
    fileList: data.serverResponse?.fileList ?? [],
  };
}

/**
 * Query the current status of a cloud recording session.
 *
 * Status codes:
 * - 0: Not started
 * - 1: Initialization
 * - 2: Started (actively recording)
 * - 3: Stopped
 * - 4: Exit (recording finished uploading)
 * - 5: Exit abnormally
 *
 * @param resourceId - Resource ID from acquireRecordingResource()
 * @param sid - Session ID from startCloudRecording()
 * @returns Recording status and optional file list
 */
export async function queryRecordingStatus(
  resourceId: string,
  sid: string
): Promise<QueryRecordingResult> {
  const baseUrl = getBaseUrl();
  const authHeader = getAuthHeader();

  const response = await fetch(
    `${baseUrl}/resourceid/${resourceId}/sid/${sid}/mode/mix/query`,
    {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Agora Cloud Recording query failed (${response.status}): ${body}`
    );
  }

  const data = (await response.json()) as {
    serverResponse?: {
      status?: number;
      fileList?: Array<{ fileName: string }>;
    };
  };

  return {
    status: data.serverResponse?.status ?? 0,
    fileList: data.serverResponse?.fileList,
  };
}
