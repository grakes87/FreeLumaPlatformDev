import { NextRequest } from 'next/server';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';
import { fetchPassage } from '@/lib/bible-api';

const postSchema = z.object({
  category_id: z.number().int().positive(),
  category_name: z.string().min(1).max(200),
  count: z.number().int().min(1).max(50).optional().default(20),
});

/**
 * POST /api/admin/verse-generation
 * AI-generated verse references via Anthropic Claude API.
 * Returns suggestions for admin review -- saving happens via POST /verses endpoint.
 */
export const POST = withAdmin(async (req: NextRequest, _context: AuthContext) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return errorResponse(
        'Anthropic API key not configured. Set ANTHROPIC_API_KEY in environment.',
        503
      );
    }

    const body = await req.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid input');
    }

    const { category_id, category_name, count } = parsed.data;

    const { VerseCategoryContent, VerseCategory } = await import('@/lib/db/models');

    // Verify category exists
    const category = await VerseCategory.findByPk(category_id);
    if (!category) {
      return errorResponse('Category not found', 404);
    }

    // Fetch existing verse references for exclusion
    const existingVerses = await VerseCategoryContent.findAll({
      where: { category_id },
      attributes: ['verse_reference'],
      raw: true,
    });
    const existingRefs = existingVerses.map((v) => v.verse_reference);

    // Call Anthropic API
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `Generate exactly ${count} Bible verse references related to the theme "${category_name}".
Return ONLY a valid JSON array of strings. Each string should be a verse reference like "John 3:16" or "Psalms 23:1-2".
Use standard book names (e.g., "Psalms" not "Psalm", "1 Corinthians" not "I Corinthians", "Genesis" not "Gen").
Do NOT include any of these existing verses: ${JSON.stringify(existingRefs.slice(0, 200))}
Return ONLY the JSON array, no other text.`,
        },
      ],
    });

    // Extract text from response
    const responseText =
      message.content[0]?.type === 'text' ? message.content[0].text : '';

    // Parse JSON array from response
    let suggestions: string[];
    try {
      // Try to extract JSON array from the response (handle possible markdown wrapping)
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return errorResponse(
          `AI response did not contain a JSON array. Raw response: ${responseText.slice(0, 500)}`,
          422
        );
      }
      suggestions = JSON.parse(jsonMatch[0]);

      if (!Array.isArray(suggestions) || !suggestions.every((s) => typeof s === 'string')) {
        return errorResponse(
          `AI response was not an array of strings. Raw response: ${responseText.slice(0, 500)}`,
          422
        );
      }
    } catch {
      return errorResponse(
        `Failed to parse AI response as JSON. Raw response: ${responseText.slice(0, 500)}`,
        422
      );
    }

    // Filter out references that match existing verses (case-insensitive)
    const existingSet = new Set(existingRefs.map((r) => r.toLowerCase().trim()));
    const filtered = suggestions.filter(
      (s) => !existingSet.has(s.toLowerCase().trim())
    );

    // Fetch KJV text for each suggestion so admin can review
    const withText: { ref: string; text: string | null }[] = [];
    for (const ref of filtered) {
      const text = await fetchPassage(ref, 'KJV', 'verse');
      withText.push({ ref, text });
    }

    return successResponse({
      suggestions: withText,
      existing_count: existingRefs.length,
      filtered_count: suggestions.length - filtered.length,
    });
  } catch (error) {
    // Handle Anthropic-specific errors
    if (error instanceof Anthropic.APIError) {
      console.error('[verse-generation] Anthropic API error:', error.status, error.message);
      return errorResponse(`AI service error: ${error.message}`, 502);
    }
    return serverError(error, 'Failed to generate verse suggestions');
  }
});
