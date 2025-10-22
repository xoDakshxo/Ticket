/**
 * Gemini AI Summarization Layer
 * Processes Reddit posts into concise, actionable feedback
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { RedditPost, SummarizedPost } from './types';
import * as functions from 'firebase-functions/v1';

interface GeminiSummaryItem {
  post_id: string;
  summary?: string;
  key_points?: string[];
  sentiment?: string;
}

// Initialize Gemini
let genAI: GoogleGenerativeAI;
const GEMINI_MODEL = functions.config().gemini?.model
  || process.env.GEMINI_MODEL
  || 'gemini-2.5-flash';

function getGeminiClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = functions.config().gemini?.api_key || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key not configured. Set it with: firebase functions:config:set gemini.api_key="AIzaSyAqC7_Ss9Cu4StgzEnurlV6KyR6h8_ou0s"');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

/**
 * Batch size for Gemini processing (to stay within rate limits)
 */
const BATCH_SIZE = 5;

/**
 * Summarizes a single Reddit post using Gemini
 */
async function summarizeSinglePost(post: RedditPost): Promise<SummarizedPost> {
  const gemini = getGeminiClient();
  console.log('[gemini] summarizeSinglePost model', GEMINI_MODEL);
  const model = gemini.getGenerativeModel({ model: GEMINI_MODEL });

  const fullText = `${post.title}\n\n${post.selftext || ''}`.trim();

  const prompt = `Analyze this Reddit post and provide a structured summary:

Title: ${post.title}
Content: ${post.selftext || '(No additional content)'}
Score: ${post.score} upvotes
Comments: ${post.num_comments}

Provide a JSON response with:
1. summary: A concise 2-3 sentence summary of the main feedback/issue/discussion
2. key_points: Array of 2-4 key points or insights (actionable items if applicable)
3. sentiment: Overall sentiment (positive/negative/neutral/mixed)

Focus on extracting actionable product feedback or user pain points. Be concise and clear.

Return ONLY valid JSON, no markdown formatting.`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Remove markdown code blocks if present
    const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const parsed = JSON.parse(cleanText);

    return {
      original_title: post.title,
      summary: parsed.summary || fullText.substring(0, 500),
      key_points: Array.isArray(parsed.key_points) ? parsed.key_points : [],
      sentiment: ['positive', 'negative', 'neutral', 'mixed'].includes(parsed.sentiment)
        ? parsed.sentiment
        : 'neutral'
    };
  } catch (error) {
    console.error(`Error summarizing post ${post.id}:`, error);

    // Fallback: use original content with basic formatting
    return {
      original_title: post.title,
      summary: fullText.substring(0, 500) + (fullText.length > 500 ? '...' : ''),
      key_points: [post.title],
      sentiment: 'neutral'
    };
  }
}

/**
 * Summarizes multiple posts in batches using Gemini
 */
export async function summarizeRedditPosts(posts: RedditPost[]): Promise<Map<string, SummarizedPost>> {
  const summaries = new Map<string, SummarizedPost>();

  console.log(`Starting summarization of ${posts.length} posts using Gemini model ${GEMINI_MODEL}...`);

  // Process in batches to avoid rate limits
  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(posts.length / BATCH_SIZE)} (${batch.length} posts)`);

    // Process batch in parallel
    const batchPromises = batch.map(async (post) => {
      const summary = await summarizeSinglePost(post);
      return { id: post.id, summary };
    });

    const batchResults = await Promise.all(batchPromises);

    // Store results
    batchResults.forEach(({ id, summary }) => {
      summaries.set(id, summary);
    });

    // Small delay between batches to respect rate limits
    if (i + BATCH_SIZE < posts.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`Successfully summarized ${summaries.size} posts`);
  return summaries;
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

/**
 * Alternative: Bulk summarization with context (more efficient for large batches)
 */
export async function bulkSummarizeWithContext(posts: RedditPost[]): Promise<Map<string, SummarizedPost>> {
  const gemini = getGeminiClient();
  console.log('[gemini] bulkSummarizeWithContext model', GEMINI_MODEL);
  const model = gemini.getGenerativeModel({ model: GEMINI_MODEL });

  const summaries = new Map<string, SummarizedPost>();

  // Process in larger batches for bulk context
  const BULK_BATCH_SIZE = 10;

  for (let i = 0; i < posts.length; i += BULK_BATCH_SIZE) {
    const batch = posts.slice(i, i + BULK_BATCH_SIZE);

    const postsText = batch.map((post, idx) =>
      `POST ${idx + 1} (ID: ${post.id}):\nTitle: ${post.title}\nContent: ${post.selftext || '(No content)'}\nScore: ${post.score} | Comments: ${post.num_comments}\n`
    ).join('\n---\n\n');

    const prompt = `Analyze these Reddit posts and provide summaries for each. Extract actionable product feedback and user pain points.

${postsText}

Return a JSON array where each object has:
- post_id: The post ID (from "ID: xxx")
- summary: 2-3 sentence summary
- key_points: Array of 2-4 key insights
- sentiment: positive/negative/neutral/mixed

Return ONLY valid JSON array, no markdown.`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      const parsed = JSON.parse(cleanText) as unknown;

      if (Array.isArray(parsed)) {
        (parsed as GeminiSummaryItem[]).forEach((item) => {
          const post = batch.find(p => p.id === item.post_id);
          if (post) {
            const sentiment = (item.sentiment ?? 'neutral') as SummarizedPost['sentiment'];
            summaries.set(post.id, {
              original_title: post.title,
              summary: item.summary || post.title,
              key_points: item.key_points || [],
              sentiment
            });
          }
        });
      }
    } catch (error) {
      console.error('Bulk summarization failed, falling back to individual:', error);
      // Fallback to individual summarization for this batch
      for (const post of batch) {
        const summary = await summarizeSinglePost(post);
        summaries.set(post.id, summary);
      }
    }

    // Rate limiting delay
    if (i + BULK_BATCH_SIZE < posts.length) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }

  return summaries;
}
