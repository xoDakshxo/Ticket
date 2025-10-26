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
  formatPostContent
} from './gemini-summarizer';

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

/**
 * Reddit Sync Function
 * Fetches posts from Reddit, summarizes them with Gemini, and stores in Firestore
 */
export const redditSync = functions
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

      // Step 3: Fetch Reddit posts
      console.log(`Fetching posts from r/${subreddit} between ${start_date} and ${end_date}`);
      const posts = await fetchRedditPosts(subreddit, startDate, endDate, limit);

      if (posts.length === 0) {
        return {
          posts_synced: 0,
          message: `No posts found in r/${subreddit} for the specified date range`
        };
      }

      console.log(`Fetched ${posts.length} posts from Reddit`);

      // Step 4: Summarize posts with Gemini
      console.log('Summarizing posts with Gemini AI...');

      // Use bulk summarization (batches posts to reduce API calls)
      const summaries = await bulkSummarizeWithContext(posts);

      console.log(`Summarized ${summaries.size} posts`);

      // Step 5: Store in Firestore
      console.log('Storing feedback in Firestore...');
      let batch = db.batch();
      let batchCount = 0;
      let totalSynced = 0;

      for (const post of posts) {
        const summary = summaries.get(post.id);
        if (!summary) {
          console.warn(`No summary found for post ${post.id}, skipping`);
          continue;
        }

        // Format content with summary
        const formattedContent = formatPostContent(post, summary);

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
            summarized: true
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

      console.log(`✅ Successfully synced ${totalSynced} posts from r/${subreddit}`);

      // Return result
      return {
        posts_synced: totalSynced,
        message: `Successfully synced ${totalSynced} posts from r/${subreddit}`,
        subreddit: subreddit,
        date_range: {
          start: start_date,
          end: end_date
        }
      };

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
export const healthCheck = functions.https.onRequest((req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    functions: ['redditSync', 'suggestTickets']
  });
});

// Export suggest-tickets function
export { suggestTickets } from './suggest-tickets';
