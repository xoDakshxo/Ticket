/**
 * Loopd Cloud Functions
 * Main entry point for Firebase Cloud Functions
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { RedditSyncRequest, FeedbackSource } from './types';
import {
  fetchRedditPosts,
  validateSubreddit,
  cleanSubredditName
} from './reddit-api';
import {
  bulkSummarizeWithContext,
  formatPostContent,
  createFallbackSummary
} from './gemini-summarizer';

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

const MAX_POST_LIMIT = 400;
const MAX_SUMMARY_COUNT = 400;
const MAX_DATE_RANGE_DAYS = 90;
const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Reddit Sync Function
 * Fetches posts from Reddit, summarizes them with Gemini, and stores in Firestore
 */
export const redditSync = functions
  .region('asia-south1')
  .runWith({
    timeoutSeconds: 540, // 9 minutes max
    memory: '1GB'
  })
  .https.onCall(async (data, context) => {
    // Authentication check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be logged in to sync Reddit data'
      );
    }

    // Extract parameters (handle both data.body and direct data)
    const requestBody = (data.body || data) as RedditSyncRequest;
    const {
      subreddit: rawSubreddit,
      start_date,
      end_date,
      limit = 1000,
      source_config_id
    } = requestBody;

    // Validate inputs
    if (!rawSubreddit || typeof rawSubreddit !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Subreddit name is required'
      );
    }

    if (!start_date || !end_date) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Start date and end date are required'
      );
    }

    if (!source_config_id) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Source config ID is required'
      );
    }

    // Clean subreddit name
    const subreddit = cleanSubredditName(rawSubreddit);
    console.log(`Starting Reddit sync for r/${subreddit}`);

    try {
      const jobStartedAt = Date.now();

      // Step 1: Validate subreddit exists
      console.log('Validating subreddit...');
      const isValid = await validateSubreddit(subreddit);
      if (!isValid) {
        throw new functions.https.HttpsError(
          'not-found',
          `Subreddit r/${subreddit} not found or is private`
        );
      }

      // Step 2: Parse date range
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Invalid date format. Use YYYY-MM-DD'
        );
      }

      if (startDate > endDate) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Start date must be before end date'
        );
      }

      const rangeDays = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / MILLIS_PER_DAY) + 1);
      if (rangeDays > MAX_DATE_RANGE_DAYS) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          `Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days`
        );
      }

      const requestedLimit = typeof limit === 'number' ? limit : Number(limit);
      const normalizedLimit = Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.floor(requestedLimit)
        : Math.min(100, MAX_POST_LIMIT);
      const effectiveLimit = Math.min(normalizedLimit, MAX_POST_LIMIT);
      const limitCapped = effectiveLimit !== normalizedLimit;

      if (limitCapped) {
        console.log(`Requested limit ${normalizedLimit} capped at ${effectiveLimit} (max ${MAX_POST_LIMIT})`);
      }

      // Step 3: Fetch Reddit posts
      console.log(`Fetching up to ${effectiveLimit} posts from r/${subreddit} between ${start_date} and ${end_date}`);
      const posts = await fetchRedditPosts(subreddit, startDate, endDate, effectiveLimit);

      if (posts.length === 0) {
        return {
          posts_synced: 0,
          message: `No posts found in r/${subreddit} for the specified date range`
        };
      }

      console.log(`Fetched ${posts.length} posts from Reddit`);

      // Step 4: Summarize posts with Gemini
      console.log('Summarizing posts with Gemini AI...');
      const postsForSummaries = posts.slice(0, MAX_SUMMARY_COUNT);
      const summaryLimitHit = posts.length > MAX_SUMMARY_COUNT;

      if (summaryLimitHit) {
        console.log(`Summary limit reached: processing first ${MAX_SUMMARY_COUNT} posts out of ${posts.length}`);
      }

      const summaries: Map<string, ReturnType<typeof createFallbackSummary>> = postsForSummaries.length > 0
        ? await bulkSummarizeWithContext(postsForSummaries)
        : new Map();

      console.log(`Summarized ${postsForSummaries.length} posts (map size: ${summaries.size})`);

      let aiSummaryCount = 0;
      let fallbackSummaryCount = 0;

      // Step 5: Store in Firestore
      console.log('Storing feedback in Firestore...');
      let batch = db.batch();
      let batchCount = 0;
      let totalSynced = 0;

      for (const post of posts) {
        const summaryRecord = summaries.get(post.id);
        const finalSummary = summaryRecord ?? createFallbackSummary(post);
        const usedAiSummary = summaryRecord?.source === 'gemini';

        if (!usedAiSummary && summaries.has(post.id)) {
          console.warn(`Gemini summary unavailable for post ${post.id}, falling back to quick summary`);
        }

        if (usedAiSummary) {
          aiSummaryCount++;
        } else {
          fallbackSummaryCount++;
        }

        // Format content with summary
        const formattedContent = formatPostContent(post, finalSummary);

        // Create feedback source document
        const feedbackData: Omit<FeedbackSource, 'created_at'> & { created_at: admin.firestore.FieldValue } = {
          content: formattedContent,
          author: post.author,
          channel: subreddit,
          source: 'reddit',
          external_id: post.id,
          engagement: post.score,
          created_at: admin.firestore.Timestamp.fromMillis(post.created_utc * 1000),
          metadata: {
            post_type: 'post',
            permalink: `https://reddit.com${post.permalink}`,
            num_comments: post.num_comments,
            url: post.url,
            original_title: post.title,
            summarized: usedAiSummary,
            summary_source: finalSummary.source,
            summary_generated_at: admin.firestore.FieldValue.serverTimestamp()
          },
          user_id: context.auth.uid,
          source_config_id: source_config_id
        };

        const docRef = db.collection('feedback_sources').doc();
        batch.set(docRef, feedbackData);

        batchCount++;
        totalSynced++;

        // Firestore batch limit is 500 operations
        if (batchCount >= 500) {
          console.log(`Committing batch of ${batchCount} documents...`);
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }

      // Commit remaining documents
      if (batchCount > 0) {
        console.log(`Committing final batch of ${batchCount} documents...`);
        await batch.commit();
      }

      const processingTimeMs = Date.now() - jobStartedAt;

      console.log(`✅ Successfully synced ${totalSynced} posts from r/${subreddit}`, {
        totalPostsFetched: posts.length,
        aiSummaryCount,
        fallbackSummaryCount,
        processingTimeMs,
        limitCapped,
        summaryLimitHit
      });

      const messageSegments: string[] = [
        `Synced ${totalSynced} posts from r/${subreddit}.`
      ];

      if (limitCapped) {
        messageSegments.push(`Requested limit ${normalizedLimit} capped at ${effectiveLimit}.`);
      }

      if (summaryLimitHit) {
        messageSegments.push(`AI summaries applied to ${aiSummaryCount} posts; ${fallbackSummaryCount} stored with quick summaries.`);
      } else if (aiSummaryCount === 0) {
        messageSegments.push('Gemini summaries unavailable this run; used quick summaries instead.');
      }

      const message = messageSegments.join(' ');

      const warnings: string[] = [];
      if (limitCapped) {
        warnings.push(`Limit capped at ${effectiveLimit} posts per sync for reliability.`);
      }
      if (summaryLimitHit) {
        warnings.push(`AI summaries generated for the first ${postsForSummaries.length} posts. The remaining ${posts.length - postsForSummaries.length} posts use quick summaries.`);
      }
      if (aiSummaryCount === 0) {
        warnings.push('Gemini API returned no summaries; stored quick summaries for this sync.');
      }

      const responsePayload: {
        posts_synced: number;
        message: string;
        subreddit: string;
        date_range: { start: string; end: string };
        metadata: {
          limit_requested: number;
          limit_applied: number;
          limit_capped: boolean;
          summary_limit: number;
          summary_limit_reached: boolean;
          summary_target_count: number;
          ai_summary_count: number;
          fallback_summary_count: number;
          processing_time_ms: number;
          posts_examined: number;
          range_days: number;
        };
        warnings?: string[];
      } = {
        posts_synced: totalSynced,
        message,
        subreddit: subreddit,
        date_range: {
          start: start_date,
          end: end_date
        },
        metadata: {
          limit_requested: normalizedLimit,
          limit_applied: effectiveLimit,
          limit_capped: limitCapped,
          summary_limit: MAX_SUMMARY_COUNT,
          summary_limit_reached: summaryLimitHit,
          summary_target_count: postsForSummaries.length,
          ai_summary_count: aiSummaryCount,
          fallback_summary_count: fallbackSummaryCount,
          processing_time_ms: processingTimeMs,
          posts_examined: posts.length,
          range_days: rangeDays
        }
      };

      if (warnings.length > 0) {
        responsePayload.warnings = warnings;
      }

      return responsePayload;

    } catch (error: unknown) {
      console.error('Reddit sync error:', error);

      // Rethrow HttpsError as-is
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Unknown error';

      // Wrap other errors
      throw new functions.https.HttpsError(
        'internal',
        `Failed to sync Reddit data: ${message}`
      );
    }
  });

/**
 * Health check function for testing
 */
export const healthCheck = functions
  .region('asia-south1')
  .https.onRequest((req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      functions: ['redditSync', 'suggestTickets']
    });
  });

// Export suggest-tickets function
export { suggestTickets } from './suggest-tickets';
