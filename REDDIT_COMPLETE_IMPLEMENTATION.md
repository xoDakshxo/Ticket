# 🎯 Reddit Scraping - Complete Implementation Plan
## With Full Context & Gemini Integration

> **Based on**: Your Loopd application codebase analysis
> **Purpose**: Comprehensive guide referencing all existing functionality

---

## 📊 Application Context & Data Flow

### Your Complete Reddit Integration Flow

```
USER ACTION (Settings Page - DataSourcesManager.tsx)
│
├─ 1. USER INPUT (Lines 320-395)
│  ├─ Enters subreddit name in Input field (Line 379-384)
│  │  • Accepts: "typescript" or "r/typescript" (plain text)
│  │  • Line 103: Automatically strips "r/" prefix
│  │  • Example: "r/lovable" → stored as "lovable"
│  │
│  ├─ Selects date range via Calendar Popovers (Lines 320-376)
│  │  • Start Date picker (Lines 321-347)
│  │  • End Date picker (Lines 349-376)
│  │  • Default: Last 30 days (Lines 35-38)
│  │  • Validation: start_date ≤ end_date, both ≤ today
│  │
│  └─ Clicks "Add Thread" button (Lines 386-393)
│     • Enter key also triggers (Line 383)
│     • Button disabled while adding
│
├─ 2. FRONTEND PROCESSING (addSource function, Lines 87-223)
│  ├─ Validation (Lines 88-95)
│  │  • Checks: subreddit name not empty
│  │
│  ├─ Duplicate Check (Lines 106-116)
│  │  • Queries: existing integration_configs
│  │  • Compares: case-insensitive subreddit names
│  │  • Prevents: tracking same subreddit twice
│  │
│  ├─ Database Record Creation (Lines 118-130)
│  │  • Collection: integration_configs
│  │  • Fields:
│  │    - user_id: Firebase Auth UID
│  │    - integration_type: "reddit"
│  │    - config: { subreddit: "cleanName" }
│  │    - channel: "cleanName"
│  │    - is_active: true
│  │  • Purpose: Track which subreddits user is monitoring
│  │
│  ├─ UI Progress Animation (Lines 132-154)
│  │  • Sets: syncingSourceId to show which source is syncing
│  │  • Animates: progress from 0-90% (Line 138-144)
│  │  • Updates status messages every 1.5s (Lines 146-154):
│  │    - 0-30%: "🔍 Fetching posts from Reddit..."
│  │    - 30-60%: "📊 Analyzing content..."
│  │    - 60-90%: "💾 Saving feedback..."
│  │  • Purpose: User feedback during async operation
│  │
│  └─ Cloud Function Invocation (Lines 157-210)
│     • Function: firebase.functions.invoke('reddit-sync')
│     • Parameters (Lines 158-165):
│       {
│         subreddit: "lovable",           // Clean name without r/
│         user_id: "firebase-uid",        // For data ownership
│         source_config_id: "config-123", // Links to integration_configs
│         limit: 1000,                    // Max posts to fetch
│         start_date: "2024-01-01",       // YYYY-MM-DD format
│         end_date: "2024-01-31"          // YYYY-MM-DD format
│       }
│     • Success Handling (Lines 179-209):
│       - Sets progress to 100%
│       - Shows toast: "Successfully synced X posts from r/subreddit"
│       - If X ≥ 10: Auto-triggers suggest-tickets function
│       - Refresh sources list
│     • Error Handling (Lines 170-178):
│       - Shows toast with error message
│       - Stops progress animation
│
├─ 3. BACKEND FUNCTION (reddit-sync) - TO BE IMPLEMENTED
│  │
│  ├─ Authentication Check
│  │  • Validates: context.auth exists
│  │  • Ensures: only logged-in users can sync
│  │
│  ├─ Reddit Data Fetching
│  │  • API: Reddit JSON endpoint (no auth) or OAuth
│  │  • Endpoint: https://www.reddit.com/r/{subreddit}/new.json
│  │  • Pagination: Handle "after" parameter for >100 posts
│  │  • Date Filtering: Filter posts by created_utc timestamp
│  │  • Rate Limiting: 2-second delay between requests
│  │
│  ├─ Data Transformation
│  │  • Combines: title + selftext into content field
│  │  • Extracts: author, score, created_utc, permalink
│  │  • Formats: Reddit timestamp to Firestore Timestamp
│  │
│  ├─ Firestore Storage (feedback_sources collection)
│  │  • Fields (matching DataSourcesManager expectations):
│  │    {
│  │      content: "Post title\n\nPost body",
│  │      author: "reddit_username",
│  │      channel: "lovable",              // Subreddit name
│  │      source: "reddit",
│  │      external_id: "t3_abc123",        // Reddit post ID
│  │      engagement: 42,                  // Upvote score
│  │      created_at: Timestamp,           // When post was created
│  │      user_id: "firebase-uid",         // Who synced this
│  │      source_config_id: "config-123",  // Which config it came from
│  │      metadata: {
│  │        post_type: "post",
│  │        permalink: "/r/lovable/...",
│  │        num_comments: 15,
│  │        url: "https://..."
│  │      }
│  │    }
│  │  • Batch writes: 500 documents per batch (Firestore limit)
│  │
│  └─ Return Value
│     • Format: { posts_synced: number }
│     • Used by: Frontend to show success message
│
├─ 4. AUTO-TRIGGER: suggest-tickets (Lines 191-207)
│  │  • Condition: posts_synced ≥ 10
│  │  • Function: firebase.functions.invoke('suggest-tickets')
│  │  • Purpose: Generate AI ticket suggestions from new data
│  │  • User notification: Shows analyzing toast
│  │
│  └─ Data Flow:
│     ├─ Reads: feedback_sources (last 50 posts)
│     ├─ Processes: AI analysis (OpenAI GPT-4 or Gemini)
│     ├─ Generates: Ticket suggestions with priority/description
│     └─ Stores: ticket_suggestions collection
│
├─ 5. DASHBOARD UPDATE (Dashboard.tsx, Lines 51-89)
│  │  • Real-time subscription: Listens to feedback_sources changes
│  │  • Updates stat: "Reddit Posts Synced" count (Line 54-59)
│  │  • Shows: totalFeedback count in card (Line 166)
│  │
│  └─ Display:
│     Card shows: "X" (total posts synced)
│     Label: "Reddit Posts Synced"
│     Description: "Total feedback collected"
│
├─ 6. TICKETS PAGE (Tickets.tsx, Lines 80-102)
│  │  • Shows linked feedback for each ticket
│  │  • Displays (for each feedback):
│  │    - Author: "u/{author}" format
│  │    - Subreddit: "r/{channel}" format
│  │    - Content preview
│  │    - External link to Reddit post
│  │    - Timestamp
│  │
│  └─ Link Construction:
│     URL: https://reddit.com{permalink}
│     Uses: external_id and channel from feedback_sources
│
└─ 7. COMMUNITY CHAMPIONS (CommunityChampions.tsx)
   │  • Aggregates: feedback by author
   │  • Calculates: superuser_score per author
   │  • Formula: (feedback_count * 0.4) + (avg_engagement * 0.6)
   │  • Identifies: Top contributors, archetypes
   │
   └─ Purpose: Recognize active community members
```

---

## 🎯 Implementation: reddit-sync Cloud Function

### File Structure

```
functions/
├── src/
│   ├── index.ts              # Main exports
│   ├── reddit/
│   │   ├── reddit-sync.ts    # Reddit scraping function
│   │   ├── reddit-api.ts     # Reddit API wrapper
│   │   └── types.ts          # TypeScript interfaces
│   ├── ai/
│   │   ├── gemini.ts         # Gemini integration
│   │   └── summarizer.ts     # Content summarization
│   └── utils/
│       └── validators.ts     # Input validation
├── package.json
└── tsconfig.json
```

### Step 1: Setup Firebase Functions

```bash
# Initialize if not done
firebase init functions

cd functions
npm install axios @google/generative-ai
```

### Step 2: Create Type Definitions

**`functions/src/reddit/types.ts`**

```typescript
/**
 * TYPE DEFINITIONS
 * Matches the data structures expected by your application
 */

import * as admin from 'firebase-admin';

// Request payload from DataSourcesManager.tsx (Line 158-165)
export interface RedditSyncRequest {
  subreddit: string;           // Clean subreddit name (no r/ prefix)
  user_id: string;             // Firebase Auth UID
  source_config_id: string;    // Reference to integration_configs document
  limit: number;               // Max posts to fetch (default: 1000)
  start_date: string;          // Format: YYYY-MM-DD
  end_date: string;            // Format: YYYY-MM-DD
}

// Response returned to frontend (used in Line 179)
export interface RedditSyncResponse {
  posts_synced: number;        // Count of successfully stored posts
  subreddit_summary?: string;  // Gemini-generated summary of subreddit content
  error?: string;              // Error message if partial failure
}

// Reddit API post structure (from /r/subreddit/new.json)
export interface RedditPost {
  id: string;                  // Post ID (e.g., "abc123")
  title: string;               // Post title
  selftext: string;            // Post body (text posts only)
  author: string;              // Reddit username
  subreddit: string;           // Subreddit name
  created_utc: number;         // Unix timestamp in seconds
  score: number;               // Upvote count
  num_comments: number;        // Comment count
  permalink: string;           // Relative URL to post
  url: string;                 // External URL (for link posts)
  is_self: boolean;            // True for text posts
  link_flair_text?: string;    // Post flair
}

// Firestore document structure for feedback_sources collection
// Used by: Dashboard.tsx (Line 56), Tickets.tsx (Line 85), CommunityChampions.tsx
export interface FeedbackSource {
  content: string;             // Combined title + selftext
  author: string;              // Reddit username (used in CommunityChampions)
  channel: string;             // Subreddit name (displayed as r/{channel})
  source: 'reddit';            // Source type identifier
  external_id: string;         // Reddit post ID (for linking back)
  engagement: number;          // Score/upvotes (used in superuser calculation)
  created_at: admin.firestore.Timestamp;  // Post creation time
  user_id: string;             // Who synced this data
  source_config_id: string;    // Which integration config
  metadata: {
    post_type: 'post' | 'comment';
    permalink: string;         // For external Reddit links
    num_comments: number;
    url: string;
    flair?: string;
  };
}

// Gemini summarization result
export interface SubredditSummary {
  overview: string;            // Brief description of subreddit content
  main_themes: string[];       // Top 5 themes discussed
  sentiment: 'positive' | 'neutral' | 'negative';
  key_pain_points: string[];   // User complaints/issues
  feature_requests: string[];  // Suggested features
  post_count: number;
}
```

### Step 3: Reddit API Wrapper

**`functions/src/reddit/reddit-api.ts`**

```typescript
/**
 * REDDIT API WRAPPER
 * Handles fetching posts from Reddit using JSON API (no auth) or OAuth
 * Referenced by: reddit-sync.ts
 */

import axios, { AxiosError } from 'axios';
import * as functions from 'firebase-functions';
import { RedditPost } from './types';

// User agent required by Reddit API
const USER_AGENT = 'Loopd/1.0 (Feedback Aggregator; Firebase Cloud Function)';

// Rate limiting: Wait between requests to avoid 429 errors
const RATE_LIMIT_DELAY_MS = 2000;  // 2 seconds (allows ~30 req/min)

/**
 * Fetches posts from a subreddit within a date range
 *
 * Used by: reddit-sync function (main scraping logic)
 *
 * @param subreddit - Clean subreddit name (e.g., "typescript")
 * @param limit - Maximum number of posts to fetch (default: 1000)
 * @param startDate - Unix timestamp (seconds) for earliest post
 * @param endDate - Unix timestamp (seconds) for latest post
 * @returns Array of Reddit posts within date range
 *
 * Process:
 * 1. Fetches posts from /r/{subreddit}/new.json (sorted newest first)
 * 2. Paginates using "after" parameter until limit reached
 * 3. Filters posts by created_utc to match date range
 * 4. Handles rate limiting with automatic retry
 */
export async function fetchRedditPosts(
  subreddit: string,
  limit: number,
  startDate: number,
  endDate: number
): Promise<RedditPost[]> {
  const posts: RedditPost[] = [];
  let after = '';              // Pagination cursor
  let hasMore = true;
  let requestCount = 0;

  console.log(`Fetching posts from r/${subreddit} between ${new Date(startDate * 1000).toISOString()} and ${new Date(endDate * 1000).toISOString()}`);

  while (hasMore && posts.length < limit) {
    try {
      // Construct Reddit JSON API URL
      // API: https://www.reddit.com/dev/api/#GET_new
      const url = `https://www.reddit.com/r/${subreddit}/new.json`;
      const params: any = {
        limit: 100,           // Max per request
        raw_json: 1,          // Disable HTML encoding
      };

      if (after) {
        params.after = after;  // Pagination token from previous response
      }

      console.log(`Request ${++requestCount}: Fetching up to 100 posts...`);

      const response = await axios.get(url, {
        params,
        headers: {
          'User-Agent': USER_AGENT
        },
        timeout: 30000        // 30 second timeout
      });

      // Parse response structure
      const children = response.data?.data?.children || [];

      if (children.length === 0) {
        console.log('No more posts available');
        hasMore = false;
        break;
      }

      // Process each post
      for (const child of children) {
        const post = child.data as RedditPost;
        const postDate = post.created_utc;

        // Since posts are sorted by "new", stop if we've passed the start date
        if (postDate < startDate) {
          console.log(`Post ${post.id} is before start date, stopping pagination`);
          hasMore = false;
          break;
        }

        // Include posts within date range
        if (postDate >= startDate && postDate <= endDate) {
          posts.push(post);

          if (posts.length >= limit) {
            console.log(`Reached limit of ${limit} posts`);
            hasMore = false;
            break;
          }
        }
      }

      // Get pagination token for next page
      after = response.data?.data?.after;
      if (!after) {
        console.log('No more pages available');
        hasMore = false;
      }

      // Rate limiting: Wait before next request
      // Purpose: Avoid Reddit's 429 (Too Many Requests) response
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
      }

    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;

        // Handle rate limiting (HTTP 429)
        if (axiosError.response?.status === 429) {
          console.warn('Rate limited by Reddit, waiting 60 seconds...');
          await new Promise(resolve => setTimeout(resolve, 60000));
          continue;  // Retry same request
        }

        // Handle subreddit not found (HTTP 404)
        if (axiosError.response?.status === 404) {
          throw new functions.https.HttpsError(
            'not-found',
            `Subreddit r/${subreddit} not found or is private`
          );
        }

        // Handle forbidden (HTTP 403) - private or banned subreddit
        if (axiosError.response?.status === 403) {
          throw new functions.https.HttpsError(
            'permission-denied',
            `Cannot access r/${subreddit}. It may be private or banned.`
          );
        }
      }

      // Rethrow unexpected errors
      console.error('Error fetching Reddit posts:', error);
      throw new functions.https.HttpsError('internal', `Failed to fetch posts: ${error}`);
    }
  }

  console.log(`Successfully fetched ${posts.length} posts from r/${subreddit}`);
  return posts;
}

/**
 * Validates that a subreddit exists
 *
 * Used by: reddit-sync function (before fetching posts)
 *
 * @param subreddit - Subreddit name to validate
 * @returns true if subreddit exists and is accessible
 * @throws HttpsError if subreddit doesn't exist or is inaccessible
 */
export async function validateSubreddit(subreddit: string): Promise<boolean> {
  try {
    const url = `https://www.reddit.com/r/${subreddit}/about.json`;
    const response = await axios.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    });

    // Check if subreddit data exists
    if (response.data?.data?.dist === 0) {
      throw new functions.https.HttpsError(
        'not-found',
        `Subreddit r/${subreddit} not found`
      );
    }

    return true;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      throw new functions.https.HttpsError(
        'not-found',
        `Subreddit r/${subreddit} does not exist`
      );
    }
    throw error;
  }
}
```

### Step 4: Gemini Integration for Summarization

**`functions/src/ai/gemini.ts`**

```typescript
/**
 * GEMINI AI INTEGRATION
 * Summarizes Reddit content for quick insights
 *
 * PURPOSE: Give users instant overview of subreddit themes/topics
 * Used after: Successfully fetching Reddit posts
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import * as functions from 'firebase-functions';
import { RedditPost, SubredditSummary } from '../reddit/types';

// Initialize Gemini client
// API key stored in Firebase config: firebase functions:config:set gemini.api_key="YOUR_KEY"
const genAI = new GoogleGenerativeAI(functions.config().gemini?.api_key || '');

/**
 * Generates a comprehensive summary of subreddit content
 *
 * Used by: reddit-sync function (after fetching posts)
 * Displayed in: DataSourcesManager toast or separate summary card
 *
 * @param subreddit - Subreddit name for context
 * @param posts - Array of fetched Reddit posts
 * @returns Structured summary with themes, sentiment, pain points
 *
 * AI Prompt Engineering:
 * - Analyzes post titles and content
 * - Identifies main discussion themes
 * - Extracts feature requests and pain points
 * - Determines overall sentiment
 * - Provides actionable insights for product teams
 */
export async function summarizeSubreddit(
  subreddit: string,
  posts: RedditPost[]
): Promise<SubredditSummary> {
  try {
    console.log(`Generating Gemini summary for r/${subreddit} with ${posts.length} posts`);

    if (posts.length === 0) {
      return {
        overview: 'No posts found in the specified date range.',
        main_themes: [],
        sentiment: 'neutral',
        key_pain_points: [],
        feature_requests: [],
        post_count: 0
      };
    }

    // Prepare post data for AI analysis (limit to first 50 for token efficiency)
    const postsToAnalyze = posts.slice(0, 50);
    const postTexts = postsToAnalyze.map(p =>
      `Title: ${p.title}\nContent: ${p.selftext || 'Link post'}\nScore: ${p.score}\n`
    ).join('\n---\n');

    // Construct AI prompt
    const prompt = `
You are a product manager analyzing user feedback from the r/${subreddit} subreddit.

Analyze these ${posts.length} Reddit posts and provide a structured summary:

${postTexts}

Provide your analysis in the following JSON format:
{
  "overview": "A 2-3 sentence summary of what this subreddit is about and what users are discussing",
  "main_themes": ["theme1", "theme2", "theme3", "theme4", "theme5"],
  "sentiment": "positive" or "neutral" or "negative",
  "key_pain_points": ["pain1", "pain2", "pain3"],
  "feature_requests": ["request1", "request2", "request3"]
}

Focus on:
- What problems are users trying to solve?
- What features are they requesting?
- What are their main frustrations?
- What do they love about the product/topic?

Return ONLY the JSON object, no additional text.
`;

    // Call Gemini API
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse JSON response
    const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const summary = JSON.parse(cleanedText);

    return {
      ...summary,
      post_count: posts.length
    };

  } catch (error) {
    console.error('Error generating Gemini summary:', error);
    // Return basic summary on error (don't fail the entire sync)
    return {
      overview: `Analyzed ${posts.length} posts from r/${subreddit}`,
      main_themes: ['Unable to generate themes'],
      sentiment: 'neutral',
      key_pain_points: [],
      feature_requests: [],
      post_count: posts.length
    };
  }
}

/**
 * Summarizes a single long post
 *
 * Used by: Optional - for posts with >500 words
 * Purpose: Create concise summaries for easier review
 *
 * @param post - Reddit post to summarize
 * @returns 2-3 sentence summary
 */
export async function summarizePost(post: RedditPost): Promise<string> {
  try {
    if (!post.selftext || post.selftext.length < 200) {
      return post.title;  // Short posts don't need summarization
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const prompt = `Summarize this Reddit post in 2-3 sentences, focusing on the main point or request:

Title: ${post.title}
Content: ${post.selftext}

Summary:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();

  } catch (error) {
    console.error('Error summarizing post:', error);
    return post.title;  // Fallback to title
  }
}
```

### Step 5: Main reddit-sync Function

**`functions/src/reddit/reddit-sync.ts`**

```typescript
/**
 * REDDIT-SYNC CLOUD FUNCTION
 * Main function called by DataSourcesManager.tsx (Line 157)
 *
 * RESPONSIBILITIES:
 * 1. Validate user authentication (context.auth)
 * 2. Validate input parameters (subreddit, dates)
 * 3. Fetch posts from Reddit API
 * 4. Generate Gemini summary (optional)
 * 5. Store posts in Firestore (feedback_sources collection)
 * 6. Return sync results to frontend
 *
 * CALLED BY: DataSourcesManager.tsx addSource() function
 * RETURNS TO: DataSourcesManager.tsx success handler (Line 179)
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { RedditSyncRequest, RedditSyncResponse, FeedbackSource } from './types';
import { fetchRedditPosts, validateSubreddit } from './reddit-api';
import { summarizeSubreddit } from '../ai/gemini';

const db = admin.firestore();

export const redditSync = functions
  .runWith({
    timeoutSeconds: 540,   // 9 minutes max (for large syncs)
    memory: '1GB',         // More memory for processing many posts
  })
  .https.onCall(async (data, context): Promise<RedditSyncResponse> => {

    // STEP 1: AUTHENTICATION CHECK
    // Ensures: Only logged-in users can sync data
    // Matches: Firebase Auth in DataSourcesManager.tsx (Line 99)
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'You must be logged in to sync Reddit data'
      );
    }

    // STEP 2: EXTRACT & VALIDATE INPUT
    // Data comes from: DataSourcesManager.tsx Lines 158-165
    const {
      subreddit,
      start_date,
      end_date,
      limit = 1000,
      source_config_id
    } = data.body as RedditSyncRequest;

    console.log(`Reddit sync requested by user ${context.auth.uid} for r/${subreddit}`);
    console.log(`Date range: ${start_date} to ${end_date}, limit: ${limit}`);

    // Validate required fields
    if (!subreddit || typeof subreddit !== 'string') {
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

    // STEP 3: VALIDATE SUBREDDIT EXISTS
    // Prevents: Wasting API calls on invalid subreddits
    await validateSubreddit(subreddit);

    // STEP 4: CONVERT DATES TO UNIX TIMESTAMPS
    // Frontend sends: "YYYY-MM-DD" format (Line 163-164)
    // Reddit API expects: Unix timestamps in seconds
    const startTimestamp = new Date(start_date).getTime() / 1000;
    const endTimestamp = new Date(end_date).getTime() / 1000;

    if (startTimestamp > endTimestamp) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Start date must be before end date'
      );
    }

    try {
      // STEP 5: FETCH POSTS FROM REDDIT
      // Uses: reddit-api.ts fetchRedditPosts()
      // Returns: Array of RedditPost objects
      const posts = await fetchRedditPosts(subreddit, limit, startTimestamp, endTimestamp);

      console.log(`Fetched ${posts.length} posts from r/${subreddit}`);

      // STEP 6: GENERATE GEMINI SUMMARY (Optional but recommended)
      // Purpose: Give user quick insights about subreddit content
      // Can be displayed in: Success toast or separate summary card
      let summary: string | undefined;
      try {
        const geminiSummary = await summarizeSubreddit(subreddit, posts);
        summary = `${geminiSummary.overview}\n\nMain themes: ${geminiSummary.main_themes.join(', ')}`;
        console.log('Gemini summary generated:', summary);
      } catch (error) {
        console.warn('Failed to generate Gemini summary, continuing without it:', error);
        // Don't fail entire sync if summarization fails
      }

      // STEP 7: STORE IN FIRESTORE
      // Collection: feedback_sources
      // Used by: Dashboard (stats), Tickets (linked feedback), CommunityChampions (user profiles)
      let syncedCount = 0;
      const batchSize = 500;  // Firestore batch limit
      let batch = db.batch();
      let batchCount = 0;

      for (const post of posts) {
        // Transform Reddit post to FeedbackSource format
        // This matches the structure expected by your UI components
        const feedbackDoc: FeedbackSource = {
          // content: Combined title + body (used in Tickets.tsx for display)
          content: `${post.title}\n\n${post.selftext || ''}`.trim(),

          // author: Reddit username (used in CommunityChampions for aggregation)
          author: post.author,

          // channel: Subreddit name (displayed as "r/{channel}" in UI)
          channel: subreddit,

          // source: Always "reddit" (for filtering in queries)
          source: 'reddit',

          // external_id: Reddit post ID (for linking back to Reddit)
          external_id: post.id,

          // engagement: Upvote score (used in superuser calculation)
          engagement: post.score,

          // created_at: When post was created on Reddit
          created_at: admin.firestore.Timestamp.fromMillis(post.created_utc * 1000),

          // user_id: Who synced this data (for data ownership)
          user_id: context.auth.uid,

          // source_config_id: Links back to integration_configs
          source_config_id: source_config_id || '',

          // metadata: Additional info for future use
          metadata: {
            post_type: 'post',
            permalink: `https://reddit.com${post.permalink}`,
            num_comments: post.num_comments,
            url: post.url,
            flair: post.link_flair_text
          }
        };

        // Add to batch
        const docRef = db.collection('feedback_sources').doc();
        batch.set(docRef, feedbackDoc);
        batchCount++;
        syncedCount++;

        // Commit batch when reaching limit
        if (batchCount >= batchSize) {
          await batch.commit();
          console.log(`Committed batch of ${batchCount} documents`);
          batch = db.batch();
          batchCount = 0;
        }
      }

      // Commit remaining documents
      if (batchCount > 0) {
        await batch.commit();
        console.log(`Committed final batch of ${batchCount} documents`);
      }

      // STEP 8: RETURN RESULTS
      // Returned to: DataSourcesManager.tsx Line 179
      // Used to: Show success message and decide if auto-suggest should run
      console.log(`Successfully synced ${syncedCount} posts from r/${subreddit}`);

      return {
        posts_synced: syncedCount,
        subreddit_summary: summary  // Optional Gemini summary
      };

    } catch (error: any) {
      console.error('Reddit sync error:', error);

      // Return user-friendly error messages
      throw new functions.https.HttpsError(
        'internal',
        `Failed to sync r/${subreddit}: ${error.message}`
      );
    }
  });
```

### Step 6: Export Functions

**`functions/src/index.ts`**

```typescript
/**
 * FIREBASE FUNCTIONS EXPORTS
 * Main entry point for all Cloud Functions
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
admin.initializeApp();

// Export reddit-sync function
// Called by: DataSourcesManager.tsx Line 157
export { redditSync } from './reddit/reddit-sync';

// TODO: Export other functions
// export { suggestTickets } from './ai/suggest-tickets';
// export { clusterFeedback } from './ai/cluster-feedback';
// export { analyzeUserIntelligence } from './ai/analyze-users';
```

---

## 🎨 Frontend Enhancement: Display Gemini Summary

### Option 1: Show in Success Toast (Simple)

**Update `DataSourcesManager.tsx` Line 186-188:**

```typescript
toast({
  title: "🎉 Sync Complete",
  description: syncData?.subreddit_summary
    ? `${postsSynced} posts synced. ${syncData.subreddit_summary}`
    : `Successfully synced ${postsSynced} posts from r/${cleanSubreddit}`,
  duration: 8000  // Longer duration for summary
});
```

### Option 2: Show in Separate Card (Better UX)

**Add to `DataSourcesManager.tsx` after Line 455:**

```typescript
{/* Subreddit Summary Card */}
{sources.length > 0 && (
  <Card className="mt-4">
    <CardHeader>
      <CardTitle>Subreddit Insights</CardTitle>
      <CardDescription>AI-generated summary of tracked content</CardDescription>
    </CardHeader>
    <CardContent>
      {/* Store and display summaries per source */}
      {sources.map(source => (
        source.summary && (
          <div key={source.id} className="mb-4 p-4 border rounded-lg">
            <h4 className="font-semibold mb-2">r/{source.config.subreddit}</h4>
            <p className="text-sm text-muted-foreground">{source.summary}</p>
          </div>
        )
      ))}
    </CardContent>
  </Card>
)}
```

---

## 📋 Deployment Checklist

```bash
# 1. Install dependencies
cd functions
npm install axios @google/generative-ai

# 2. Set up Gemini API key
# Get free API key: https://makersuite.google.com/app/apikey
firebase functions:config:set gemini.api_key="YOUR_GEMINI_API_KEY"

# 3. Deploy function
firebase deploy --only functions:redditSync

# 4. Test in your app
# - Go to Settings page
# - Add subreddit "typescript"
# - Select last 7 days
# - Click "Add Thread"
# - Watch progress bar
# - Verify success message

# 5. Verify data in Firestore
# - Open Firebase Console
# - Go to Firestore Database
# - Check feedback_sources collection
# - Verify documents have correct structure
```

---

## 🧪 Testing Guide

### Test Cases

```typescript
// Test 1: Valid subreddit
Input: subreddit="typescript", dates=last 7 days
Expected: Success, posts synced, summary generated

// Test 2: Invalid subreddit
Input: subreddit="thissubredditdoesnotexist123"
Expected: Error "Subreddit not found"

// Test 3: Empty date range
Input: subreddit="typescript", start=today, end=today
Expected: Success with 0-5 posts (depending on activity)

// Test 4: Large date range
Input: subreddit="typescript", dates=last 365 days, limit=1000
Expected: Success, hits 1000 limit, takes 2-3 minutes

// Test 5: Plain name vs r/ prefix
Input: "typescript" and "r/typescript"
Expected: Both work identically, stored as "typescript"

// Test 6: Duplicate prevention
Input: Add "typescript" twice
Expected: Second attempt shows "Duplicate" error

// Test 7: Auto-suggest trigger
Input: Subreddit with 10+ posts in range
Expected: Success + "Analyzing feedback..." toast appears
```

---

## 💡 Advanced Features (Future Enhancements)

### 1. Real-time Progress Updates

**Store progress in Firestore:**

```typescript
// In reddit-sync function
const progressRef = db.collection('sync_progress').doc(context.auth.uid);

await progressRef.set({
  subreddit,
  status: 'fetching',
  progress: Math.floor((fetchedCount / limit) * 100),
  message: `Fetched ${fetchedCount} posts...`,
  updated_at: admin.firestore.FieldValue.serverTimestamp()
});

// Frontend subscribes to this document for live updates
```

### 2. Comment Scraping

**Extend to fetch comments:**

```typescript
async function fetchPostComments(postId: string) {
  const url = `https://www.reddit.com/comments/${postId}.json`;
  // Parse comment tree
  // Store as separate feedback_sources with post_type: 'comment'
}
```

### 3. Scheduled Syncing

**Auto-sync daily:**

```typescript
export const scheduledRedditSync = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async (context) => {
    // Get all active integration_configs
    // Sync each subreddit
    // Store new posts only
  });
```

### 4. Sentiment Analysis per Post

**Add to Gemini analysis:**

```typescript
// Analyze sentiment for each post
// Store in metadata.sentiment: 'positive' | 'negative' | 'neutral'
// Use for filtering and prioritization
```

---

## 📚 Reference: Function Call Chain

```
USER CLICKS "Add Thread"
  ↓
DataSourcesManager.tsx:addSource() (Line 87)
  ↓
firebase.functions.invoke('reddit-sync') (Line 157)
  ↓
functions/src/reddit/reddit-sync.ts:redditSync()
  ├─ validateSubreddit() → Check subreddit exists
  ├─ fetchRedditPosts() → Fetch posts from Reddit API
  ├─ summarizeSubreddit() → Generate Gemini summary (optional)
  └─ Firestore batch writes → Store in feedback_sources
  ↓
RETURN { posts_synced: N, subreddit_summary: "..." }
  ↓
DataSourcesManager.tsx success handler (Line 179)
  ├─ Show toast with post count
  ├─ If posts_synced ≥ 10:
  │   └─ firebase.functions.invoke('suggest-tickets') (Line 197)
  └─ Update UI
  ↓
Dashboard.tsx updates "Reddit Posts Synced" stat (Line 54-59)
  ↓
User can view posts in Tickets page linked feedback (Line 80-102)
  ↓
CommunityChampions analyzes authors and engagement (CommunityChampions.tsx)
```

---

## ✅ Success Criteria

Your implementation is complete when:

- ✅ User can add any public subreddit (with or without "r/" prefix)
- ✅ Date range picker works correctly (validates dates)
- ✅ Progress bar animates during sync (0-100%)
- ✅ Posts appear in `feedback_sources` collection
- ✅ Dashboard shows correct "Reddit Posts Synced" count
- ✅ Tickets page can link to Reddit posts
- ✅ Gemini summary appears in success message or summary card
- ✅ Auto-suggest triggers when ≥10 posts synced
- ✅ CommunityChampions identifies top Reddit contributors
- ✅ No errors in Cloud Function logs
- ✅ Handles rate limiting gracefully
- ✅ Duplicate subreddit prevention works

---

## 🆘 Troubleshooting

### Issue: "Rate limited by Reddit"
**Solution**: Increase `RATE_LIMIT_DELAY_MS` to 3000-5000ms

### Issue: "Function timeout"
**Solution**: Reduce `limit` or increase `timeoutSeconds` to 540

### Issue: "No posts found"
**Solution**: Check date range overlaps with subreddit activity

### Issue: "Gemini summary failed"
**Solution**: Verify API key is set correctly:
```bash
firebase functions:config:get
```

### Issue: "Duplicate posts"
**Solution**: Add uniqueness check on `external_id` before storing

---

**Ready to implement?** Start with Step 1 (Setup Firebase Functions) and follow the steps in order! 🚀

Let me know if you want me to implement any specific part or if you have questions!
