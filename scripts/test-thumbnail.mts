/**
 * Test script: runs the FULL AI thumbnail pipeline on a specific video.
 * Usage: npx tsx scripts/test-thumbnail.mts
 */
import 'dotenv/config';
import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });

import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import sharp from 'sharp';
import { existsSync } from 'fs';
import { Writable } from 'stream';

if (ffmpegStatic && existsSync(ffmpegStatic)) {
  ffmpeg.setFfmpegPath(ffmpegStatic as string);
}

const videoUrl = 'https://f005.backblazeb2.com/file/FreeLumaPlatform/videos/2/1771098089788-dg2jpb.mp4';
const description = 'Discover the story of Job and what real patience looks like when life falls apart.';

function getVideoDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(url, (err, metadata) => {
      if (err) { console.error('ffprobe error:', err.message); resolve(0); return; }
      resolve(metadata?.format?.duration || 0);
    });
  });
}

function extractSingleFrame(url: string, seekTime: number): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    const writable = new Writable({
      write(chunk: Buffer, _enc, cb) { chunks.push(chunk); cb(); },
    });
    ffmpeg(url)
      .seekInput(seekTime)
      .frames(1)
      .outputFormat('image2')
      .outputOptions(['-vcodec', 'mjpeg'])
      .on('error', (err) => { console.error('Frame error at ' + seekTime + 's:', err.message); resolve(null); })
      .on('end', () => { resolve(chunks.length > 0 ? Buffer.concat(chunks) : null); })
      .pipe(writable, { end: true });
  });
}

(async () => {
  const startTime = Date.now();

  // ---- STEP 1: Frame extraction ----
  console.log('=== STEP 1: Frame Extraction ===');
  console.log('Getting video duration...');
  const duration = await getVideoDuration(videoUrl);
  console.log('Duration:', duration.toFixed(1) + 's');

  const timestamps: number[] = [];
  for (let t = 0; t < duration && timestamps.length < 8; t += 15) {
    timestamps.push(t);
  }

  const frames: Buffer[] = [];
  for (const ts of timestamps) {
    const frame = await extractSingleFrame(videoUrl, ts);
    if (frame) {
      const resized = await sharp(frame).resize(512, 288, { fit: 'cover' }).jpeg({ quality: 70 }).toBuffer();
      frames.push(resized);
      console.log('  Frame at ' + ts + 's: ' + resized.length + ' bytes');
    }
  }
  console.log('Total frames: ' + frames.length);
  const step1Time = Date.now();
  console.log('Step 1 took: ' + ((step1Time - startTime) / 1000).toFixed(1) + 's\n');

  if (frames.length === 0) { console.error('No frames - aborting'); process.exit(1); }

  // ---- STEP 2: GPT-4o Vision Analysis ----
  console.log('=== STEP 2: GPT-4o Vision Analysis ===');
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const imageContentParts = frames.map((frame) => ({
    type: 'image_url' as const,
    image_url: {
      url: 'data:image/jpeg;base64,' + frame.toString('base64'),
      detail: 'low' as const,
    },
  }));

  const visionResponse = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 500,
    messages: [
      {
        role: 'system',
        content:
          'You are a thumbnail design consultant. Analyze these video screenshots and the description to create a detailed image generation prompt for a Pixar-style 3D animated video thumbnail. ' +
          'The thumbnail must look like a scene from a Pixar or Disney animated film — soft lighting, rich colors, stylized 3D-rendered characters and environments. ' +
          'Use the people, setting, and mood from the video frames as reference to recreate the scene in this animated style. ' +
          'Focus on the visual theme, mood, colors, key subjects, and composition. ' +
          'The thumbnail should NOT contain any text, words, letters, or numbers. ' +
          'Output ONLY the image generation prompt, nothing else.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Video description: "${description}"\n\nHere are screenshots from the video at regular intervals. Create a thumbnail generation prompt based on these:`,
          },
          ...imageContentParts,
        ],
      },
    ],
  });

  const imagePrompt = visionResponse.choices[0]?.message?.content?.trim();
  console.log('Image prompt:', imagePrompt);
  console.log('Prompt length:', imagePrompt?.length, 'chars');
  console.log('Vision tokens:', JSON.stringify(visionResponse.usage));
  const step2Time = Date.now();
  console.log('Step 2 took: ' + ((step2Time - step1Time) / 1000).toFixed(1) + 's\n');

  if (!imagePrompt) { console.error('No prompt returned - aborting'); process.exit(1); }

  // ---- STEP 3: gpt-image-1 Generation ----
  console.log('=== STEP 3: gpt-image-1 Generation ===');
  const fullPrompt = `Pixar-style 3D animated video thumbnail, soft cinematic lighting, rich vibrant colors, stylized characters, no text, no words, no letters, no numbers: ${imagePrompt}`;
  console.log('Full prompt length:', fullPrompt.length, 'chars');

  const imageResponse = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: fullPrompt,
    n: 1,
    size: '1024x1024',
  });

  console.log('\n--- Raw API Response ---');
  console.log('Response data length:', imageResponse.data?.length);
  const imageData = imageResponse.data?.[0];
  console.log('Has b64_json:', !!imageData?.b64_json);
  console.log('b64_json length:', imageData?.b64_json?.length || 0);
  console.log('Has url:', !!imageData?.url);
  console.log('Revised prompt:', (imageData as any)?.revised_prompt || 'none');
  const step3Time = Date.now();
  console.log('Step 3 took: ' + ((step3Time - step2Time) / 1000).toFixed(1) + 's\n');

  // Get the raw image buffer
  let rawBuffer: Buffer | null = null;
  if (imageData?.b64_json) {
    rawBuffer = Buffer.from(imageData.b64_json, 'base64');
    console.log('Raw image buffer:', rawBuffer.length, 'bytes');
  } else if (imageData?.url) {
    console.log('Fetching from URL:', imageData.url.substring(0, 80) + '...');
    const res = await fetch(imageData.url);
    if (res.ok) {
      rawBuffer = Buffer.from(await res.arrayBuffer());
      console.log('Fetched image buffer:', rawBuffer.length, 'bytes');
    } else {
      console.error('Fetch failed:', res.status);
    }
  } else {
    console.error('No image data in response!');
    console.log('Full response:', JSON.stringify(imageResponse, null, 2));
    process.exit(1);
  }

  if (!rawBuffer) { console.error('No raw buffer - aborting'); process.exit(1); }

  // ---- STEP 4: Resize to 640x360 WebP ----
  console.log('\n=== STEP 4: Resize to 640x360 WebP ===');
  const finalBuffer = await sharp(rawBuffer)
    .resize(640, 360, { fit: 'cover' })
    .webp({ quality: 80 })
    .toBuffer();

  console.log('Final WebP size:', finalBuffer.length, 'bytes');
  console.log('Final WebP size:', (finalBuffer.length / 1024).toFixed(1), 'KB');

  // Save to disk so we can visually inspect
  const outputPath = join(__dirname, '..', 'test-thumbnail-output.webp');
  writeFileSync(outputPath, finalBuffer);
  console.log('Saved to:', outputPath);

  // Also save the raw 1024x1024 for comparison
  const rawOutputPath = join(__dirname, '..', 'test-thumbnail-raw.png');
  writeFileSync(rawOutputPath, rawBuffer);
  console.log('Raw saved to:', rawOutputPath);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n=== SUMMARY ===');
  console.log('Frames extracted:  ', frames.length);
  console.log('Vision prompt:     ', imagePrompt?.length, 'chars');
  console.log('Raw image:         ', rawBuffer.length, 'bytes');
  console.log('Final WebP:        ', finalBuffer.length, 'bytes (' + (finalBuffer.length / 1024).toFixed(1) + ' KB)');
  console.log('Total time:        ', totalTime + 's');
  console.log('\nOpen test-thumbnail-output.webp to see the result!');
})();
