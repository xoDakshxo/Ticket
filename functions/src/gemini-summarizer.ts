/**
 * Gemini AI Summarization Layer
 * Processes Reddit posts into concise, actionable feedback
 */

import { GoogleGenAI } from '@google/genai';
import { RedditPost, SummarizedPost } from './types';
import * as functions from 'firebase-functions/v1';

interface GeminiSummaryItem {
  post_id: string;
  summary?: string;
  key_points?: string[];
  sentiment?: string;
}

// Initialize Gemini
let genAI: GoogleGenAI;
const GEMINI_MODEL = functions.config().gemini?.model
  || process.env.GEMINI_MODEL
  || 'gemini-2.5-flash';

function getGeminiClient(): GoogleGenAI {
  if (!genAI) {
    const apiKey = functions.config().gemini?.api_key || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key not configured. Set it with: firebase functions:config:set gemini.api_key="YOUR_API_KEY"');
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

const BULK_BATCH_SIZE = Math.max(1, Number(functions.config().gemini?.batch_size) || 20);
const BULK_MAX_CONCURRENCY = Math.max(1, Number(functions.config().gemini?.batch_concurrency) || 3);
const BULK_INTER_BATCH_DELAY_MS = Math.max(0, Number(functions.config().gemini?.batch_delay_ms) || 800);
const GEMINI_REQUEST_TIMEOUT_MS = Math.max(1000, Number(functions.config().gemini?.request_timeout_ms) || 60000);
const MAX_CONTENT_LENGTH = Math.max(500, Number(functions.config().gemini?.content_max_chars) || 2000);
const FALLBACK_SUMMARY_LENGTH = 500;
const ALLOWED_SENTIMENTS: SummarizedPost['sentiment'][] = ['positive', 'negative', 'neutral', 'mixed'];

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const chunkArray = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const truncateText = (value: string, maxLength: number): string => {
  if (!value) return '';
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
};

const runWithTimeout = async <T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
  let timeoutHandle: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
};

export async function summarizeRedditPosts(posts: RedditPost[]): Promise<Map<string, SummarizedPost>> {
  return bulkSummarizeWithContext(posts);
}

/**
 * Formats a Reddit post with its summary into the content string expected by UI
 */
export function formatPostContent(post: RedditPost, summary: SummarizedPost): string {
  const sections: string[] = [];

  // Title and summary
  sections.push(`**${summary.original_title}**`);
  sections.push('');
  sections.push(summary.summary);

  // Key points if available
  if (summary.key_points && summary.key_points.length > 0) {
    sections.push('');
    sections.push('**Key Points:**');
    summary.key_points.forEach(point => {
      sections.push(`• ${point}`);
    });
  }

  // Engagement metrics
  sections.push('');
  sections.push(`📊 ${post.score} upvotes • ${post.num_comments} comments`);

  return sections.join('\n');
}

export function createFallbackSummary(post: RedditPost, overrides: Partial<SummarizedPost> = {}): SummarizedPost {
  const fullText = `${post.title}\n\n${post.selftext || ''}`.trim();
  const summaryText = overrides.summary
    ?? (fullText ? truncateText(fullText, FALLBACK_SUMMARY_LENGTH) : post.title);

  const keyPoints = Array.isArray(overrides.key_points) && overrides.key_points.length > 0
    ? overrides.key_points
    : [post.title];

  const sentiment = overrides.sentiment && ALLOWED_SENTIMENTS.includes(overrides.sentiment as SummarizedPost['sentiment'])
    ? overrides.sentiment as SummarizedPost['sentiment']
    : 'neutral';

  return {
    original_title: overrides.original_title ?? post.title,
    summary: summaryText,
    key_points: keyPoints,
    sentiment,
    source: overrides.source ?? 'fallback'
  };
}

const buildBatchPrompt = (batch: RedditPost[]): string => {
  const postsText = batch.map((post, idx) => {
    const content = truncateText(post.selftext || '', MAX_CONTENT_LENGTH);
    const sanitizedContent = content || '(No content)';
    return `POST ${idx + 1} (ID: ${post.id}):
Title: ${post.title}
Content: ${sanitizedContent}
Score: ${post.score} | Comments: ${post.num_comments}`;
  }).join('\n---\n\n');

  return `You are analyzing user feedback from Reddit to extract actionable product insights.

**POSTS TO ANALYZE:**
${postsText}

**YOUR TASK:**
For each post, identify:
1. The core problem, request, or feedback
2. Specific actionable insights (features, fixes, improvements)
3. User pain points and their underlying causes
4. What the user is trying to accomplish

**OUTPUT FORMAT:**
Return a JSON array where each object has:
- **post_id**: The post ID (from "ID: xxx")
- **summary**: 2-3 sentence summary focusing on actionable feedback
- **key_points**: Array of 2-4 specific, actionable insights
- **sentiment**: positive/negative/neutral/mixed

**GUIDELINES:**
- Be specific (avoid "users want improvements" - say WHAT improvement)
- Focus on buildable, fixable, improvable items
- Extract the "why" behind requests
- Identify patterns if multiple users mention similar things
- If discussing bugs, describe the impact

Return ONLY valid JSON array, no markdown formatting or code blocks.`;
};

const processGeminiBatch = async (batch: RedditPost[]): Promise<Map<string, SummarizedPost>> => {
  const gemini = getGeminiClient();
  const prompt = buildBatchPrompt(batch);

  const response = await runWithTimeout(
    gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    }),
    GEMINI_REQUEST_TIMEOUT_MS,
    `Gemini batch request timed out after ${GEMINI_REQUEST_TIMEOUT_MS}ms`
  );

  const text = response.text || '';
  const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  let parsed: GeminiSummaryItem[];
  try {
    const json = JSON.parse(cleanText) as unknown;
    parsed = Array.isArray(json)
      ? (json as GeminiSummaryItem[])
      : [json as GeminiSummaryItem];
  } catch (error) {
    throw new Error(`Failed to parse Gemini response: ${(error as Error)?.message ?? error}`);
  }

  const batchSummaries = new Map<string, SummarizedPost>();

  parsed.forEach((item) => {
    if (!item?.post_id) {
      return;
    }

    const post = batch.find((p) => p.id === item.post_id);
    if (!post) {
      return;
    }

    const fallbackSummary = createFallbackSummary(post);

    const summaryText = item.summary && item.summary.trim().length > 0
      ? truncateText(item.summary.trim(), FALLBACK_SUMMARY_LENGTH)
      : fallbackSummary.summary;

    const sentiment = item.sentiment && ALLOWED_SENTIMENTS.includes(item.sentiment as SummarizedPost['sentiment'])
      ? item.sentiment as SummarizedPost['sentiment']
      : fallbackSummary.sentiment;

    const keyPoints = Array.isArray(item.key_points) && item.key_points.length > 0
      ? item.key_points
      : fallbackSummary.key_points;

    batchSummaries.set(post.id, {
      original_title: post.title,
      summary: summaryText,
      key_points: keyPoints,
      sentiment,
      source: 'gemini',
    });
  });

  batch.forEach((post) => {
    if (!batchSummaries.has(post.id)) {
      batchSummaries.set(post.id, createFallbackSummary(post));
    }
  });

  return batchSummaries;
};

export async function bulkSummarizeWithContext(posts: RedditPost[]): Promise<Map<string, SummarizedPost>> {
  console.log('[gemini] bulkSummarizeWithContext model', GEMINI_MODEL);

  const summaries = new Map<string, SummarizedPost>();
  if (posts.length === 0) {
    return summaries;
  }

  posts.forEach((post) => {
    summaries.set(post.id, createFallbackSummary(post));
  });

  const batches = chunkArray(posts, BULK_BATCH_SIZE);
  console.log(`[gemini] Processing ${posts.length} posts in ${batches.length} batches (size=${BULK_BATCH_SIZE}, concurrency=${BULK_MAX_CONCURRENCY})`);

  for (let i = 0; i < batches.length; i += BULK_MAX_CONCURRENCY) {
    const slice = batches.slice(i, i + BULK_MAX_CONCURRENCY);
    const results = await Promise.allSettled(slice.map(processGeminiBatch));

    results.forEach((result, idx) => {
      const batch = slice[idx];
      if (result.status === 'fulfilled') {
        result.value.forEach((summary, postId) => {
          summaries.set(postId, summary);
        });
      } else {
        console.error('Gemini batch failed, falling back to raw content', {
          error: result.reason instanceof Error ? result.reason.message : result.reason,
          batchSize: batch.length,
        });
        batch.forEach((post) => {
          summaries.set(post.id, createFallbackSummary(post));
        });
      }
    });

    if (i + BULK_MAX_CONCURRENCY < batches.length && BULK_INTER_BATCH_DELAY_MS > 0) {
      await delay(BULK_INTER_BATCH_DELAY_MS);
    }
  }

  console.log(`Successfully generated summaries for ${summaries.size} posts (requested ${posts.length})`);
  return summaries;
}
