import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { withAdmin, type AuthContext } from '@/lib/auth/middleware';
import { successResponse, errorResponse, serverError } from '@/lib/utils/api';

interface VerseReviewResult {
  verse_id: number;
  verse_reference: string;
  content_text: string;
  flagged: boolean;
  reason: string;
  flag_type: 'age' | 'relevance' | 'both' | 'none';
}

/**
 * POST /api/admin/verse-categories/[id]/review
 * AI-powered review of all verses in a category for age appropriateness and relevance.
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

    // Extract category ID from URL
    const url = new URL(req.url);
    const segments = url.pathname.split('/');
    const idIdx = segments.indexOf('verse-categories') + 1;
    const categoryId = parseInt(segments[idIdx], 10);
    if (isNaN(categoryId) || categoryId <= 0) {
      return errorResponse('Invalid category ID');
    }

    const { VerseCategoryContent, VerseCategory } = await import('@/lib/db/models');

    // Verify category exists
    const category = await VerseCategory.findByPk(categoryId);
    if (!category) {
      return errorResponse('Category not found', 404);
    }

    // Fetch ALL verses in this category
    const verses = await VerseCategoryContent.findAll({
      where: { category_id: categoryId },
      attributes: ['id', 'verse_reference', 'content_text'],
      raw: true,
    });

    if (verses.length === 0) {
      return successResponse({
        results: [],
        summary: { total: 0, flagged: 0 },
      });
    }

    const client = new Anthropic({ apiKey });
    const allResults: VerseReviewResult[] = [];

    // Batch verses in groups of 50
    const BATCH_SIZE = 50;
    for (let i = 0; i < verses.length; i += BATCH_SIZE) {
      const batch = verses.slice(i, i + BATCH_SIZE);
      const versesForPrompt = batch.map((v: { id: number; verse_reference: string; content_text: string }) => ({
        id: v.id,
        ref: v.verse_reference,
        text: v.content_text,
      }));

      const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: `You are reviewing Bible verses in the category "${category.name}" for a faith-based app used by people of ALL ages, including children.

Review each verse for:
1. **Age Appropriateness**: Is this verse suitable for all ages, including children? Flag verses with graphic violence, sexual content, or disturbing imagery that would be inappropriate for young users.
2. **Category Relevance**: Does this verse actually relate to the theme "${category.name}"? Flag verses that seem completely unrelated to this category.

Be CONSERVATIVE — only flag verses that are genuinely problematic. Most Bible verses are fine. A verse about spiritual warfare or God's judgment is acceptable. Only flag truly graphic or disturbing content, or verses that clearly don't belong in this category.

Here are the verses to review:
${JSON.stringify(versesForPrompt)}

Return ONLY a valid JSON array with one object per verse:
[
  {
    "id": <verse_id>,
    "flagged": true/false,
    "reason": "<brief explanation if flagged, empty string if not>",
    "flag_type": "age" | "relevance" | "both" | "none"
  }
]

Return ONLY the JSON array, no other text.`,
          },
        ],
      });

      const responseText =
        message.content[0]?.type === 'text' ? message.content[0].text : '';

      // Parse JSON from response
      let batchResults: { id: number; flagged: boolean; reason: string; flag_type: string }[];
      try {
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          console.error('[verse-review] AI response did not contain JSON array for batch', i);
          // If AI fails on a batch, mark all as unflagged
          for (const v of batch) {
            allResults.push({
              verse_id: v.id,
              verse_reference: v.verse_reference,
              content_text: v.content_text,
              flagged: false,
              reason: '',
              flag_type: 'none',
            });
          }
          continue;
        }
        batchResults = JSON.parse(jsonMatch[0]);
      } catch {
        console.error('[verse-review] Failed to parse AI response for batch', i);
        for (const v of batch) {
          allResults.push({
            verse_id: v.id,
            verse_reference: v.verse_reference,
            content_text: v.content_text,
            flagged: false,
            reason: '',
            flag_type: 'none',
          });
        }
        continue;
      }

      // Merge AI results with verse data
      const resultMap = new Map(batchResults.map((r) => [r.id, r]));
      for (const v of batch) {
        const aiResult = resultMap.get(v.id);
        const flagType = aiResult?.flag_type || 'none';
        allResults.push({
          verse_id: v.id,
          verse_reference: v.verse_reference,
          content_text: v.content_text,
          flagged: aiResult?.flagged ?? false,
          reason: aiResult?.reason ?? '',
          flag_type: (flagType === 'age' || flagType === 'relevance' || flagType === 'both') ? flagType : 'none',
        });
      }
    }

    const flaggedCount = allResults.filter((r) => r.flagged).length;

    return successResponse({
      results: allResults,
      summary: { total: allResults.length, flagged: flaggedCount },
    });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error('[verse-review] Anthropic API error:', error.status, error.message);
      return errorResponse(`AI service error: ${error.message}`, 502);
    }
    return serverError(error, 'Failed to review verses');
  }
});
