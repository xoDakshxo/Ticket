# 🚀 Reddit Integration Setup Guide

Complete guide to set up Reddit scraping with Gemini AI summarization.

## 📋 Prerequisites

- Firebase project created
- Firebase CLI installed: `npm install -g firebase-tools`
- Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
- Node.js 18+ installed

## ⚡ Quick Setup (5 Minutes)

### Step 1: Install Dependencies

```bash
cd functions
npm install
```

This installs:
- `firebase-admin` - Firebase SDK
- `firebase-functions` - Cloud Functions runtime
- `axios` - HTTP client for Reddit API
- `@google/generative-ai` - Gemini AI SDK

### Step 2: Configure Gemini API Key

Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey), then:

```bash
firebase functions:config:set gemini.api_key="YOUR_GEMINI_API_KEY"
```

Verify it's set:
```bash
firebase functions:config:get
```

You should see:
```json
{
  "gemini": {
    "api_key": "YOUR_KEY_HERE"
  }
}
```

### Step 3: Build TypeScript

```bash
cd functions
npm run build
```

This compiles TypeScript to JavaScript in the `lib/` folder.

### Step 4: Deploy to Firebase

```bash
firebase deploy --only functions
```

This deploys:
- ✅ `redditSync` - Main Reddit scraping function with Gemini
- ✅ `healthCheck` - Simple health check endpoint

**Deployment takes 2-3 minutes.**

### Step 5: Verify Deployment

Check Firebase Console → Functions to see:
- `redditSync` - Status: Active
- `healthCheck` - Status: Active

Test health check:
```bash
curl https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/healthCheck
```

## 🎯 How It Works

### Complete Data Flow

1. **User Input** (DataSourcesManager.tsx:178-234)
   - User enters subreddit: `"typescript"` or `"r/typescript"`
   - Selects date range: Start + End dates
   - Clicks "Add Thread"

2. **Frontend Call** (DataSourcesManager.tsx:295-302)
   ```typescript
   const result = await firebase.functions.invoke('reddit-sync', {
     body: {
       subreddit: "typescript",
       start_date: "2024-01-01",
       end_date: "2024-01-31",
       limit: 1000,
       source_config_id: configId
     }
   });
   ```

3. **Cloud Function Execution** (functions/src/index.ts)
   - ✅ Validates authentication
   - ✅ Cleans subreddit name (removes "r/" if present)
   - ✅ Validates subreddit exists
   - ✅ Fetches posts from Reddit JSON API
   - ✅ Summarizes with Gemini AI (batched processing)
   - ✅ Stores in Firestore `feedback_sources` collection
   - ✅ Returns `{ posts_synced: 247 }`

4. **Reddit API** (functions/src/reddit-api.ts)
   - Uses public endpoint: `https://www.reddit.com/r/{subreddit}/new.json`
   - No authentication required
   - Rate limiting: 2 seconds between requests
   - Pagination: Fetches up to 1000 posts
   - Date filtering: Only posts in specified range

5. **Gemini Summarization** (functions/src/gemini-summarizer.ts)
   - Batch processing: 10 posts at a time
   - Extracts: Summary, key points, sentiment
   - Formats: Markdown-formatted content for UI
   - Fallback: If Gemini fails, uses original text
   - Output format:
   ```
   **Post Title**

   2-3 sentence summary of the feedback

   **Key Points:**
   • Actionable insight 1
   • Actionable insight 2

   📊 42 upvotes • 15 comments
   ```

6. **Firestore Storage**
   ```javascript
   feedback_sources/{docId} = {
     content: "Formatted content with summary",
     author: "reddit_username",
     channel: "typescript",
     source: "reddit",
     external_id: "abc123",
     engagement: 42,
     created_at: Timestamp(2024-01-15),
     metadata: {
       post_type: "post",
       permalink: "https://reddit.com/r/typescript/...",
       num_comments: 15,
       url: "https://reddit.com/...",
       original_title: "Original post title",
       summarized: true
     },
     user_id: "firebase_user_id",
     source_config_id: "config_id"
   }
   ```

7. **UI Updates** (Dashboard.tsx, Tickets.tsx)
   - Real-time listener detects new feedback
   - Dashboard shows: "247 Reddit Posts Synced"
   - Tickets page can link feedback to tickets
   - AI analyzes feedback for ticket suggestions

## 🔧 Configuration

### Environment Variables

**Local Development:**

Create `functions/.env.local`:
```env
GEMINI_API_KEY=your_api_key_here
```

**Production (Firebase):**
```bash
firebase functions:config:set gemini.api_key="YOUR_KEY"
```

### Function Timeout & Memory

Default configuration (functions/src/index.ts):
```typescript
.runWith({
  timeoutSeconds: 540,  // 9 minutes max
  memory: '1GB'
})
```

Adjust if needed for larger subreddits.

### Rate Limiting

Reddit API limits (functions/src/reddit-api.ts:12):
```typescript
const RATE_LIMIT_DELAY = 2000; // 2 seconds between requests
```

Gemini batch size (functions/src/gemini-summarizer.ts:18):
```typescript
const BATCH_SIZE = 5; // Posts per batch
```

## 🧪 Testing

### Local Testing with Emulators

```bash
cd functions
npm run serve
```

Then in another terminal:
```bash
firebase functions:shell
```

Test the function:
```javascript
redditSync({
  body: {
    subreddit: "typescript",
    start_date: "2024-01-01",
    end_date: "2024-01-07",
    limit: 10,
    source_config_id: "test-id"
  }
}, {
  auth: { uid: "test-user-id" }
})
```

### Testing in Production

1. Open your app
2. Go to Settings
3. Add a subreddit: `"typescript"`
4. Select date range: Last 7 days
5. Click "Add Thread"
6. Watch progress bar animate
7. Check Dashboard for synced posts

### View Logs

```bash
firebase functions:log --only redditSync
```

Or in Firebase Console → Functions → Logs

## 📊 Expected Results

### Successful Sync

**Frontend Response:**
```javascript
{
  posts_synced: 247,
  message: "Successfully synced 247 posts from r/typescript",
  subreddit: "typescript",
  date_range: {
    start: "2024-01-01",
    end: "2024-01-31"
  }
}
```

**Firestore Data:**
- 247 new documents in `feedback_sources`
- Each with AI-generated summary
- Proper metadata and engagement scores

**Dashboard Display:**
- "247 Reddit Posts Synced"
- Real-time update animation
- Posts available for AI analysis

## 🐛 Troubleshooting

### Error: "Gemini API key not configured"

**Solution:**
```bash
firebase functions:config:set gemini.api_key="YOUR_KEY"
firebase deploy --only functions
```

### Error: "Subreddit not found"

**Causes:**
- Subreddit doesn't exist
- Subreddit is private
- Typo in subreddit name

**Solution:** Verify subreddit exists at reddit.com/r/SUBREDDIT

### Error: "Function timeout"

**Causes:**
- Too many posts to process
- Slow Reddit API responses
- Gemini API rate limits

**Solutions:**
1. Reduce `limit` parameter (try 100-500)
2. Narrow date range
3. Increase timeout in code:
   ```typescript
   .runWith({ timeoutSeconds: 540 })
   ```

### Error: "Rate limited by Reddit"

**Visible in logs:** `"Rate limited, waiting..."`

**Solution:** Function automatically retries with exponential backoff. No action needed.

### Error: "Gemini summarization failed"

**Function behavior:** Automatically falls back to original post content

**Check logs:**
```bash
firebase functions:log --only redditSync | grep "summarization"
```

### No Posts Found

**Check:**
1. Date range includes posts (verify on Reddit)
2. Subreddit has text posts (self posts)
3. Posts aren't too old (Reddit API limit: ~1000 latest posts)

## 💰 Cost Estimate

### Firebase Cloud Functions

**Free Tier:**
- 2M invocations/month
- 400K GB-seconds
- 200K GHz-seconds

**Estimated usage per sync:**
- 1 invocation
- ~30-60 seconds execution time
- ~1 GB memory

**Cost:** FREE for typical usage (few syncs per day)

### Gemini API

**Free Tier (as of 2024):**
- 60 requests per minute
- 1500 requests per day
- FREE for Gemini 1.5 Flash

**Estimated usage:**
- 10 posts = 1 request (bulk mode)
- 100 posts = ~10 requests
- 1000 posts = ~100 requests

**Cost:** FREE for typical usage

### Reddit API

**Free:** No API key required for public endpoints

## 🔒 Security

### Authentication Required

All calls to `redditSync` require:
```typescript
if (!context.auth) {
  throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
}
```

### Input Validation

- Subreddit name sanitized
- Date range validated
- Limit enforced (max 1000)
- SQL injection prevention (NoSQL database)

### Firestore Security Rules

Already configured in `firestore.rules`:
```
match /feedback_sources/{docId} {
  allow read, write: if request.auth != null;
}
```

## 🚀 Performance Optimization

### Current Optimizations

✅ Batch processing (Firestore writes)
✅ Parallel summarization (5 posts at a time)
✅ Rate limiting (Reddit API)
✅ Bulk Gemini calls (10 posts per request)
✅ Exponential backoff (error handling)

### For High Volume

If syncing 1000+ posts regularly:

1. **Increase batch sizes:**
   ```typescript
   const BULK_BATCH_SIZE = 20; // Up from 10
   ```

2. **Use caching:**
   - Cache summaries in Firestore
   - Skip already-summarized posts

3. **Queue-based processing:**
   - Use Firebase Task Queue
   - Process posts asynchronously

## 📚 API Reference

### redditSync Function

**Endpoint:** `firebase.functions.invoke('reddit-sync', { body })`

**Parameters:**
```typescript
{
  subreddit: string;        // "typescript" or "r/typescript"
  start_date: string;       // "YYYY-MM-DD"
  end_date: string;         // "YYYY-MM-DD"
  limit?: number;           // Max posts to fetch (default: 1000)
  source_config_id: string; // Integration config ID
}
```

**Response:**
```typescript
{
  posts_synced: number;
  message: string;
  subreddit: string;
  date_range: { start: string; end: string };
}
```

**Errors:**
- `unauthenticated` - User not logged in
- `invalid-argument` - Missing/invalid parameters
- `not-found` - Subreddit doesn't exist
- `internal` - Server error (check logs)

## 🎓 Next Steps

### After Deployment

1. ✅ Test with a small subreddit (e.g., `"typescript"`, last 7 days)
2. ✅ Verify data in Firestore Console
3. ✅ Check Dashboard shows correct count
4. ✅ Test with larger date ranges
5. ✅ Monitor costs in Firebase Console

### Advanced Features (Future)

- **Comment scraping:** Fetch Reddit comments
- **Scheduled syncs:** Auto-sync daily with Cloud Scheduler
- **Multi-subreddit:** Sync multiple subreddits at once
- **Sentiment analysis:** Track sentiment trends over time
- **Duplicate detection:** Skip already-synced posts

## 📞 Support

### Logs & Debugging

```bash
# View all function logs
firebase functions:log

# View specific function
firebase functions:log --only redditSync

# Follow logs in real-time
firebase functions:log --only redditSync --follow
```

### Firebase Console

- **Functions:** https://console.firebase.google.com/project/YOUR_PROJECT/functions
- **Firestore:** https://console.firebase.google.com/project/YOUR_PROJECT/firestore
- **Logs:** https://console.firebase.google.com/project/YOUR_PROJECT/logs

### Common Commands

```bash
# Deploy functions
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:redditSync

# View config
firebase functions:config:get

# Delete config
firebase functions:config:unset gemini.api_key

# Test locally
cd functions && npm run serve
```

---

## ✅ Setup Checklist

```
□ Install dependencies: cd functions && npm install
□ Get Gemini API key from Google AI Studio
□ Set Firebase config: firebase functions:config:set gemini.api_key="KEY"
□ Build TypeScript: npm run build
□ Deploy functions: firebase deploy --only functions
□ Test with small subreddit
□ Verify Firestore data
□ Check Dashboard updates
□ Monitor logs for errors
```

---

**🎉 You're ready to scrape Reddit with AI-powered summarization!**

Go to Settings → Add a subreddit → Watch the magic happen ✨
