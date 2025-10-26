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

  const fullText = `${post.title}\n\n${post.selftext || ''}`.trim();

  const prompt = `You are analyzing user feedback from Reddit to extract actionable product insights.

**POST DETAILS:**
Title: ${post.title}
Content: ${post.selftext || '(No additional content)'}
Engagement: ${post.score} upvotes | ${post.num_comments} comments

**YOUR TASK:**
Analyze this post and extract the core feedback, focusing on:
- What problem or need is the user expressing?
- What specific features or changes are mentioned?
- What pain points or frustrations are evident?
- What is the user trying to accomplish?

**OUTPUT FORMAT (JSON):**
{
  "summary": "2-3 sentence summary focusing on the actionable feedback or main issue",
  "key_points": [
    "Specific, actionable insight 1",
    "Specific, actionable insight 2",
    "Specific, actionable insight 3"
  ],
  "sentiment": "positive/negative/neutral/mixed"
}

**GUIDELINES:**
- Be specific and actionable (avoid vague statements)
- Focus on what can be built, fixed, or improved
- Extract the "why" behind requests when possible
- If it's a feature request, describe what they want to achieve
- If it's a complaint, identify the underlying problem

Return ONLY valid JSON, no markdown formatting.`;

  try {
    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });

    const text = response.text || '';

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

  const summaries = new Map<string, SummarizedPost>();

  // Process in larger batches for bulk context (increased to reduce API calls)
  const BULK_BATCH_SIZE = 25;

  for (let i = 0; i < posts.length; i += BULK_BATCH_SIZE) {
    const batch = posts.slice(i, i + BULK_BATCH_SIZE);

    const postsText = batch.map((post, idx) =>
      `POST ${idx + 1} (ID: ${post.id}):\nTitle: ${post.title}\nContent: ${post.selftext || '(No content)'}\nScore: ${post.score} | Comments: ${post.num_comments}\n`
    ).join('\n---\n\n');

    const prompt = `You are analyzing user feedback from Reddit to extract actionable product insights.

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

    try {
      const response = await gemini.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
      });

      const text = response.text || '';
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
      console.error('Bulk summarization failed for batch, using fallback content:', error);
      // Use basic fallback for failed batch (don't make more API calls!)
      for (const post of batch) {
        const fullText = `${post.title}\n\n${post.selftext || ''}`.trim();
        summaries.set(post.id, {
          original_title: post.title,
          summary: fullText.substring(0, 500) + (fullText.length > 500 ? '...' : ''),
          key_points: [post.title],
          sentiment: 'neutral'
        });
      }
    }

    // Rate limiting delay (increased to avoid hitting 20 RPM)
    if (i + BULK_BATCH_SIZE < posts.length) {
      await new Promise(resolve => setTimeout(resolve, 4000));
    }
  }

  return summaries;
}
