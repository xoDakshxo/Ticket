# Firebase Functions Setup

This document explains how to set up Firebase Cloud Functions for the AI-powered features.

## Functions Overview

The following functions need to be implemented:

### 1. **suggest-tickets**
Generates AI-powered ticket suggestions from feedback data.

**Trigger:** HTTP Callable
**Purpose:** Analyze feedback and create ticket suggestions

### 2. **cluster-feedback**
Clusters similar feedback using AI embeddings.

**Trigger:** HTTP Callable
**Purpose:** Group related feedback by theme

### 3. **reddit-sync**
Syncs feedback from Reddit API.

**Trigger:** HTTP Callable / Scheduled
**Purpose:** Pull posts/comments from configured subreddits

### 4. **analyze-user-intelligence**
Analyzes community members and identifies champions.

**Trigger:** HTTP Callable
**Purpose:** Calculate superuser scores and archetypes

### 5. **ingest-feedback**
Processes manually submitted feedback.

**Trigger:** HTTP Callable
**Purpose:** Validate and store feedback from manual input

## Setup Instructions

### 1. Initialize Firebase Functions

```bash
# Install Firebase CLI (if not already installed)
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Functions in your project
firebase init functions
```

When prompted:
- Select **TypeScript** (recommended) or JavaScript
- Install dependencies: **Yes**

### 2. Install Required Dependencies

```bash
cd functions
npm install openai        # For OpenAI GPT-4
npm install @anthropic-ai/sdk  # Or Anthropic Claude
npm install axios         # For Reddit API
```

### 3. Set Environment Variables

```bash
# Set API keys as Firebase config
firebase functions:config:set \
  openai.key="your-openai-api-key" \
  reddit.client_id="your-reddit-client-id" \
  reddit.client_secret="your-reddit-client-secret"
```

### 4. Example Function Implementation

Create `functions/src/index.ts`:

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import OpenAI from 'openai';

admin.initializeApp();
const db = admin.firestore();

const openai = new OpenAI({
  apiKey: functions.config().openai.key
});

// Suggest Tickets Function
export const suggestTickets = functions.https.onCall(async (data, context) => {
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  try {
    // Get recent feedback
    const feedbackSnapshot = await db.collection('feedback_sources')
      .orderBy('created_at', 'desc')
      .limit(50)
      .get();

    const feedbackTexts = feedbackSnapshot.docs.map(doc => doc.data().content);

    // Call OpenAI to analyze feedback
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a product manager analyzing user feedback. Generate 3-5 actionable ticket suggestions with title, description, and priority (low/medium/high)."
        },
        {
          role: "user",
          content: `Analyze this feedback and suggest tickets:\n\n${feedbackTexts.join('\n\n')}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const suggestions = JSON.parse(completion.choices[0].message.content || '{}');

    // Store suggestions in Firestore
    const batch = db.batch();
    suggestions.tickets?.forEach((ticket: any) => {
      const ref = db.collection('ticket_suggestions').doc();
      batch.set(ref, {
        ...ticket,
        status: 'pending',
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        user_id: context.auth!.uid
      });
    });
    await batch.commit();

    return { suggestions: suggestions.tickets || [] };
  } catch (error: any) {
    console.error('Error generating suggestions:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Reddit Sync Function
export const redditSync = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const { subreddit, startDate, endDate } = data;

  try {
    // Get Reddit OAuth token
    const reddit = await getRedditToken();

    // Fetch posts from subreddit
    const response = await axios.get(
      `https://oauth.reddit.com/r/${subreddit}/new`,
      {
        headers: { Authorization: `Bearer ${reddit.token}` },
        params: { limit: 100 }
      }
    );

    const posts = response.data.data.children;
    let syncedCount = 0;

    // Store in Firestore
    const batch = db.batch();
    for (const post of posts) {
      const ref = db.collection('feedback_sources').doc();
      batch.set(ref, {
        content: post.data.selftext || post.data.title,
        author: post.data.author,
        channel: subreddit,
        source: 'reddit',
        external_id: post.data.id,
        engagement: post.data.score,
        created_at: admin.firestore.Timestamp.fromMillis(post.data.created_utc * 1000)
      });
      syncedCount++;
    }

    await batch.commit();

    return { synced: syncedCount };
  } catch (error: any) {
    console.error('Error syncing Reddit:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Helper function for Reddit OAuth
async function getRedditToken() {
  const clientId = functions.config().reddit.client_id;
  const clientSecret = functions.config().reddit.client_secret;

  const response = await axios.post(
    'https://www.reddit.com/api/v1/access_token',
    'grant_type=client_credentials',
    {
      auth: { username: clientId, password: clientSecret },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }
  );

  return { token: response.data.access_token };
}

// Cluster Feedback Function
export const clusterFeedback = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  try {
    const feedbackSnapshot = await db.collection('feedback_sources').get();
    const feedbackTexts = feedbackSnapshot.docs.map(doc => ({
      id: doc.id,
      content: doc.data().content
    }));

    // Use OpenAI embeddings for clustering
    const embeddings = await Promise.all(
      feedbackTexts.map(async (item) => {
        const response = await openai.embeddings.create({
          model: "text-embedding-ada-002",
          input: item.content
        });
        return {
          id: item.id,
          embedding: response.data[0].embedding
        };
      })
    );

    // Simple clustering logic (you can use a library like k-means)
    // For now, use AI to categorize
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "Group similar feedback into clusters with themes."
        },
        {
          role: "user",
          content: JSON.stringify(feedbackTexts)
        }
      ]
    });

    // Store clusters
    return { message: 'Clustering complete', data: completion.choices[0].message };
  } catch (error: any) {
    console.error('Error clustering feedback:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Analyze User Intelligence Function
export const analyzeUserIntelligence = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  try {
    // Get all user feedback
    const feedbackSnapshot = await db.collection('feedback_sources').get();

    // Group by author
    const userFeedback = new Map<string, any[]>();
    feedbackSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (!userFeedback.has(data.author)) {
        userFeedback.set(data.author, []);
      }
      userFeedback.get(data.author)!.push(data);
    });

    // Calculate scores and update profiles
    const batch = db.batch();
    let superusersFound = 0;

    for (const [author, feedback] of userFeedback.entries()) {
      const totalEngagement = feedback.reduce((sum, f) => sum + (f.engagement || 0), 0);
      const avgEngagement = totalEngagement / feedback.length;
      const superuserScore = (feedback.length * 0.4) + (avgEngagement * 0.6);

      if (superuserScore > 10) {
        superusersFound++;
      }

      const ref = db.collection('user_profiles').doc();
      batch.set(ref, {
        author,
        source: feedback[0].source,
        total_feedback_count: feedback.length,
        total_engagement: totalEngagement,
        avg_engagement: avgEngagement,
        superuser_score: superuserScore,
        first_seen_at: feedback[0].created_at,
        last_seen_at: feedback[feedback.length - 1].created_at,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    await batch.commit();

    return { superusers_found: superusersFound };
  } catch (error: any) {
    console.error('Error analyzing users:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Ingest Feedback Function
export const ingestFeedback = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const { source_type, external_id, channel, author, content, metadata } = data.body;

  try {
    await db.collection('feedback_sources').add({
      content,
      author,
      channel,
      source: source_type,
      external_id,
      engagement: 0,
      metadata: metadata || {},
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });

    return { message: 'Feedback ingested successfully' };
  } catch (error: any) {
    console.error('Error ingesting feedback:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});
```

### 5. Deploy Functions

```bash
# Deploy all functions
firebase deploy --only functions

# Or deploy specific function
firebase deploy --only functions:suggestTickets
```

### 6. Test Functions Locally

```bash
cd functions
npm run serve

# Then test with:
firebase functions:shell
```

## Cost Optimization

### Free Tier Limits
- 2M invocations/month
- 400K GB-seconds
- 200K CPU-seconds

### Tips to Reduce Costs
1. Use caching for AI responses
2. Batch process feedback
3. Rate limit user requests
4. Use lighter AI models for simple tasks

## Security Best Practices

1. **Always check authentication**
   ```typescript
   if (!context.auth) {
     throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
   }
   ```

2. **Validate input data**
   ```typescript
   if (!data.subreddit || typeof data.subreddit !== 'string') {
     throw new functions.https.HttpsError('invalid-argument', 'Invalid subreddit');
   }
   ```

3. **Use security rules** - Firestore rules protect data access

4. **Rate limiting** - Use Firebase Extensions or implement custom rate limiting

## Monitoring

View logs in Firebase Console:
```
https://console.firebase.google.com/project/YOUR_PROJECT/functions/logs
```

Or use CLI:
```bash
firebase functions:log
```

## Troubleshooting

**Function timeout?**
- Increase timeout: `functions.runWith({ timeoutSeconds: 540 })`
- Max is 540 seconds (9 minutes)

**Out of memory?**
- Increase memory: `functions.runWith({ memory: '1GB' })`

**Cold starts slow?**
- Use min instances: `functions.runWith({ minInstances: 1 })`

## Next Steps

1. Implement each function based on your needs
2. Add error handling and logging
3. Test thoroughly before deploying
4. Monitor costs and usage
5. Optimize performance

For more details, see [Firebase Functions Documentation](https://firebase.google.com/docs/functions)
