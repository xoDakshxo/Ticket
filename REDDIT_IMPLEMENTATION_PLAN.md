# 🚀 Reddit Scraping Implementation Plan

## Executive Summary

**Goal**: Enable Reddit post fetching to populate `feedback_sources` collection for AI analysis.

**Best Approach**: **Hybrid Strategy**
1. **Phase 1 (Quick Win)**: Reddit JSON API (no auth) - 30 minutes ⚡
2. **Phase 2 (Production)**: Upgrade to OAuth when needed - 2 hours

**Why This Approach**:
- ✅ Get working **TODAY** with zero setup
- ✅ No API keys or Reddit app registration needed
- ✅ Works for 95% of use cases (public subreddits)
- ✅ Easy upgrade path to OAuth later

---

## 📊 Option Comparison

| Feature | JSON API (Recommended) | OAuth API | Third-Party Service |
|---------|----------------------|-----------|-------------------|
| **Setup Time** | 30 minutes | 2-3 hours | 1 hour |
| **API Keys Needed** | ❌ None | ✅ Yes | ✅ Yes |
| **Rate Limit** | ~60 req/min | ~600 req/min | Varies |
| **Cost** | Free | Free | $$ |
| **Historical Data** | Last 1000 posts | Last 1000 posts | Unlimited* |
| **Private Subreddits** | ❌ No | ✅ Yes | ❌ No |
| **NSFW Content** | ⚠️ Limited | ⚠️ Blocked (2023) | ✅ Yes |
| **Complexity** | 🟢 Low | 🟡 Medium | 🟠 High |

**Verdict**: Start with JSON API, upgrade to OAuth only if you need private subreddits or higher rate limits.

---

## 🎯 Recommended Implementation: Phase 1 (JSON API)

### How Reddit JSON API Works

Reddit provides a **public JSON endpoint** for any subreddit:

```
https://www.reddit.com/r/{subreddit}/{listing}.json?limit={count}&after={pagination}
```

**Example**:
```
GET https://www.reddit.com/r/typescript/new.json?limit=100
Headers: User-Agent: YourAppName/1.0
```

**Response**: Full post data in JSON format - no authentication required!

### What You Get

```json
{
  "data": {
    "children": [
      {
        "data": {
          "id": "abc123",
          "title": "Post title",
          "selftext": "Post content",
          "author": "username",
          "subreddit": "typescript",
          "created_utc": 1234567890,
          "score": 42,
          "num_comments": 15,
          "permalink": "/r/typescript/comments/abc123/..."
        }
      }
    ],
    "after": "t3_xyz789"  // Pagination token
  }
}
```

### Implementation Steps

#### Step 1: Create Firebase Cloud Function (20 mins)

```bash
# Initialize Firebase Functions (if not done)
firebase init functions

cd functions
npm install axios
```

#### Step 2: Implement reddit-sync Function

Create `functions/src/reddit.ts`:

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';

const db = admin.firestore();

export const redditSync = functions
  .runWith({
    timeoutSeconds: 300,  // 5 minutes
    memory: '512MB'
  })
  .https.onCall(async (data, context) => {
    // Auth check
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    const { subreddit, start_date, end_date, limit = 1000 } = data.body;

    // Validation
    if (!subreddit || typeof subreddit !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid subreddit');
    }

    try {
      const startDate = new Date(start_date).getTime() / 1000;
      const endDate = new Date(end_date).getTime() / 1000;

      const posts = await fetchRedditPosts(subreddit, limit, startDate, endDate);

      // Store in Firestore
      const batch = db.batch();
      let syncedCount = 0;

      for (const post of posts) {
        const ref = db.collection('feedback_sources').doc();
        batch.set(ref, {
          content: `${post.title}\n\n${post.selftext || ''}`.trim(),
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
            url: post.url
          },
          user_id: context.auth.uid,
          source_config_id: data.body.source_config_id
        });
        syncedCount++;

        // Firestore batch limit is 500
        if (syncedCount % 500 === 0) {
          await batch.commit();
          batch = db.batch();
        }
      }

      if (syncedCount % 500 !== 0) {
        await batch.commit();
      }

      return { posts_synced: syncedCount };

    } catch (error: any) {
      console.error('Reddit sync error:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  });

async function fetchRedditPosts(
  subreddit: string,
  maxPosts: number,
  startDate: number,
  endDate: number
): Promise<any[]> {
  const posts: any[] = [];
  let after = '';
  let hasMore = true;

  while (hasMore && posts.length < maxPosts) {
    const url = `https://www.reddit.com/r/${subreddit}/new.json`;
    const params: any = {
      limit: 100,
      raw_json: 1
    };

    if (after) {
      params.after = after;
    }

    try {
      const response = await axios.get(url, {
        params,
        headers: {
          'User-Agent': 'Loopd/1.0 (Feedback Aggregator)'
        },
        timeout: 30000
      });

      const children = response.data?.data?.children || [];

      for (const child of children) {
        const post = child.data;
        const postDate = post.created_utc;

        // Check date range
        if (postDate < startDate) {
          hasMore = false;  // Posts are sorted by new, so stop
          break;
        }

        if (postDate >= startDate && postDate <= endDate) {
          posts.push(post);
        }

        if (posts.length >= maxPosts) {
          hasMore = false;
          break;
        }
      }

      // Check for pagination
      after = response.data?.data?.after;
      if (!after || children.length === 0) {
        hasMore = false;
      }

      // Rate limiting: wait 2 seconds between requests
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error: any) {
      if (error.response?.status === 429) {
        // Rate limited - wait longer
        console.log('Rate limited, waiting 60 seconds...');
        await new Promise(resolve => setTimeout(resolve, 60000));
      } else {
        throw error;
      }
    }
  }

  return posts;
}
```

#### Step 3: Export Function

Update `functions/src/index.ts`:

```typescript
import * as admin from 'firebase-admin';
admin.initializeApp();

export { redditSync } from './reddit';
```

#### Step 4: Deploy

```bash
firebase deploy --only functions:redditSync
```

#### Step 5: Test

Go to your app → Settings → Add a subreddit → Watch it sync!

---

## 🔧 Phase 2: Upgrade to OAuth (Optional)

### When You Need OAuth

- Private/restricted subreddits
- Higher rate limits (600 req/min vs 60)
- User-specific data (saved posts, subscriptions)
- Commercial use at scale

### Quick Upgrade Path

1. **Create Reddit App**: https://www.reddit.com/prefs/apps
   - App type: "script"
   - Note client_id and client_secret

2. **Set Firebase Config**:
   ```bash
   firebase functions:config:set \
     reddit.client_id="your_client_id" \
     reddit.client_secret="your_client_secret"
   ```

3. **Update Function** (add OAuth):

```typescript
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

  return response.data.access_token;
}

// Then use in fetchRedditPosts:
const token = await getRedditToken();
const response = await axios.get(`https://oauth.reddit.com/r/${subreddit}/new`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'User-Agent': 'Loopd/1.0'
  },
  params
});
```

---

## 📋 Complete Implementation Checklist

### Phase 1: JSON API (30 minutes) ⚡

```
✅ SETUP
□ Run: firebase init functions (if not done)
□ Run: cd functions && npm install axios
□ Create: functions/src/reddit.ts
□ Update: functions/src/index.ts
□ Deploy: firebase deploy --only functions:redditSync

✅ TESTING
□ Go to app Settings page
□ Add subreddit: "typescript"
□ Select date range: Last 7 days
□ Click "Add Thread"
□ Verify: Posts appear in feedback_sources
□ Verify: Dashboard shows "X Reddit Posts Synced"

✅ VALIDATION
□ Check Firestore console for new documents
□ Verify data structure matches schema
□ Test with different subreddits
□ Test with different date ranges
```

### Phase 2: OAuth Upgrade (Optional, 2 hours)

```
✅ REDDIT APP SETUP
□ Visit: https://www.reddit.com/prefs/apps
□ Click: "create another app"
□ Type: "script"
□ Save client_id and client_secret

✅ FIREBASE CONFIG
□ Run: firebase functions:config:set reddit.client_id="xxx"
□ Run: firebase functions:config:set reddit.client_secret="xxx"

✅ CODE UPDATE
□ Add: getRedditToken() function
□ Update: fetchRedditPosts() to use OAuth
□ Update: URL to oauth.reddit.com
□ Deploy: firebase deploy --only functions:redditSync

✅ TESTING
□ Test private subreddit access
□ Verify higher rate limits work
□ Monitor function logs
```

---

## 🎯 Implementation Timeline

### Quick Start (Recommended)

```
Day 1 Morning (2 hours):
├─ 30 mins: Implement Phase 1 function
├─ 15 mins: Deploy and test
├─ 30 mins: Debug any issues
├─ 30 mins: Test with real subreddits
└─ 15 mins: Document for team

Result: Working Reddit scraping ✅
```

### Full Implementation (If Needed)

```
Week 1:
├─ Day 1: Phase 1 (JSON API) - Working prototype
├─ Day 2: Test with multiple subreddits, fix bugs
├─ Day 3: Add error handling, logging
├─ Day 4: Monitor usage, optimize
└─ Day 5: (Optional) Upgrade to OAuth if needed

Result: Production-ready Reddit integration ✅
```

---

## 💡 Pro Tips

### Rate Limiting Best Practices

```typescript
// Add exponential backoff
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await axios.get(url);
    } catch (error: any) {
      if (error.response?.status === 429 && i < retries - 1) {
        const waitTime = Math.pow(2, i) * 10000;  // 10s, 20s, 40s
        console.log(`Rate limited, waiting ${waitTime}ms...`);
        await delay(waitTime);
      } else {
        throw error;
      }
    }
  }
}
```

### Caching Optimization

```typescript
// Cache token for 60 minutes
let cachedToken: { token: string; expires: number } | null = null;

async function getCachedToken() {
  if (cachedToken && Date.now() < cachedToken.expires) {
    return cachedToken.token;
  }

  const token = await getRedditToken();
  cachedToken = {
    token,
    expires: Date.now() + (55 * 60 * 1000)  // 55 minutes
  };

  return token;
}
```

### Progress Tracking

Your UI already handles this! Just make sure your function returns progress:

```typescript
// For long-running syncs, you can use Firestore to track progress
const progressRef = db.collection('sync_progress').doc(context.auth.uid);

await progressRef.set({
  subreddit,
  status: 'syncing',
  progress: 50,
  message: 'Fetching posts...',
  updated_at: admin.firestore.FieldValue.serverTimestamp()
});

// UI can subscribe to this document for real-time progress
```

---

## 🚨 Common Issues & Solutions

### Issue 1: "429 Too Many Requests"

**Solution**: Add delays between requests
```typescript
await new Promise(resolve => setTimeout(resolve, 2000));  // Wait 2 seconds
```

### Issue 2: "Function Timeout"

**Solution**: Increase timeout and batch processing
```typescript
.runWith({
  timeoutSeconds: 540,  // Max 9 minutes
  memory: '1GB'
})
```

### Issue 3: "Invalid Subreddit"

**Solution**: Validate before calling API
```typescript
// Check if subreddit exists
const checkUrl = `https://www.reddit.com/r/${subreddit}/about.json`;
const check = await axios.get(checkUrl);
if (check.data?.data?.dist === 0) {
  throw new Error('Subreddit not found');
}
```

### Issue 4: "Date Range Not Working"

**Solution**: Reddit's API is sorted by "new", so fetch and filter
```typescript
// Keep fetching until you hit the start_date
if (postDate < startDate) {
  hasMore = false;  // Stop pagination
  break;
}
```

---

## 📊 Expected Results

### After Implementation

**User Flow**:
1. User goes to Settings
2. Enters "typescript" + selects "Last 7 days"
3. Clicks "Add Thread"
4. Progress bar animates 0-100%
5. Toast: "Successfully synced 247 posts from r/typescript"
6. Dashboard updates: "247 Reddit Posts Synced"
7. AI analyzes posts → generates ticket suggestions
8. User approves suggestions → creates tickets

**Data in Firestore**:
```
feedback_sources/
├─ doc1: { content: "How to...", author: "user123", source: "reddit", ... }
├─ doc2: { content: "Bug report...", author: "user456", source: "reddit", ... }
└─ ... (247 documents)
```

---

## 🎓 Learning Resources

- [Reddit JSON API Unofficial Docs](https://github.com/reddit-archive/reddit/wiki/JSON)
- [Firebase Cloud Functions Docs](https://firebase.google.com/docs/functions)
- [Reddit API Rate Limits](https://github.com/reddit-archive/reddit/wiki/API)

---

## 🎯 Next Steps

### Immediate (Today)

1. ✅ Review this plan
2. ✅ Choose Phase 1 (JSON API)
3. ✅ Implement function (30 mins)
4. ✅ Deploy and test
5. ✅ Celebrate working Reddit scraping! 🎉

### This Week

1. Test with multiple subreddits
2. Monitor Cloud Function logs
3. Optimize rate limiting
4. Add error handling
5. Document for team

### Future (Optional)

1. Upgrade to OAuth if needed
2. Add comment scraping
3. Add user profile analysis
4. Implement smart caching

---

## 💰 Cost Estimate

### Phase 1 (JSON API)
- **Firebase Functions**: Free tier (2M invocations/month)
- **Firestore**: Free tier (50K reads, 20K writes/day)
- **Total**: $0/month for typical usage

### Phase 2 (OAuth)
- Same as Phase 1
- **Reddit API**: Free (with rate limits)
- **Total**: $0/month

**You can run this entire system on Firebase's free tier!**

---

## ✅ Success Criteria

Your implementation is successful when:

✅ User can add any public subreddit
✅ Posts sync within 1-2 minutes
✅ Data appears in feedback_sources collection
✅ Dashboard shows correct post count
✅ Tickets page can link to Reddit posts
✅ AI suggestions use Reddit data
✅ No errors in Cloud Function logs

---

**Ready to implement?** Let's start with Phase 1! 🚀

Would you like me to:
1. Implement the function code for you?
2. Help you test it?
3. Answer specific questions about the implementation?
