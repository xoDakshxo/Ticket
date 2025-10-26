# Loopd - Feedback Loop Station

## Overview

Loopd is an AI-powered feedback aggregation and ticket management system. It collects feedback from Reddit, analyzes it with Gemini AI, and generates actionable tickets for product teams.

The app uses Firebase (Firestore + Cloud Functions + Authentication) as the backend, with React + TypeScript on the frontend.

## Architecture

### Tech Stack

**Frontend:**
- React 18.3.1 + TypeScript
- Vite 5.4.19
- React Router DOM 6.30.1
- TanStack React Query 5.83.0
- shadcn-ui (40+ Radix UI components)
- Tailwind CSS 3.4.17
- Recharts 2.15.4
- Framer Motion 12.23.24

**Backend:**
- Firebase Firestore (database)
- Firebase Cloud Functions (serverless backend)
- Firebase Authentication
- Gemini 2.5 Flash (AI for summarization and ticket generation)

**External APIs:**
- Reddit OAuth API (for fetching posts from subreddits)

### Data Layer

The app uses Firebase with a Supabase-compatible wrapper located at:
```
src/lib/firebase.ts
```

This provides:
- Firebase Authentication
- Firestore database queries with Supabase-like API
- Real-time subscriptions
- Cloud function invocations

### File Structure
```
/Users/dakshbagga/Code/Ticket/
├── src/                            # Frontend React App
│   ├── main.tsx                    # Entry point
│   ├── App.tsx                     # Root component with routing
│   ├── pages/
│   │   ├── Auth.tsx                # Firebase authentication
│   │   ├── Dashboard.tsx           # Main dashboard
│   │   ├── Tickets.tsx             # Ticket management with linked feedback
│   │   ├── Settings.tsx            # Settings/data sources
│   │   └── NotFound.tsx            # 404 page
│   ├── components/
│   │   ├── Layout.tsx              # Main layout with navbar
│   │   ├── TicketSuggestions.tsx   # AI ticket suggestions (with approve/decline)
│   │   ├── DataSourcesManager.tsx  # Reddit source management
│   │   ├── CommunityChampions.tsx  # User profiles
│   │   ├── Analytics.tsx           # Metrics dashboard
│   │   ├── FeedbackIngestion.tsx   # Manual feedback input
│   │   ├── ThemeProvider.tsx       # Dark/light theme
│   │   └── ui/                     # 40+ shadcn components
│   ├── lib/
│   │   ├── firebase.ts             # Firebase wrapper with Supabase-like API
│   │   └── utils.ts                # Utility functions
│   ├── types/
│   │   └── firestore.ts            # TypeScript types for database
│   └── hooks/
│       ├── use-auth.ts              # Custom auth hook (fixes timing issues)
│       ├── use-toast.ts
│       └── use-mobile.tsx
├── functions/                       # Firebase Cloud Functions
│   ├── src/
│   │   ├── index.ts                # Main functions entry (redditSync)
│   │   ├── suggest-tickets.ts      # AI ticket generation with Gemini
│   │   ├── reddit-api.ts           # Reddit OAuth and post fetching
│   │   ├── gemini-summarizer.ts    # AI post summarization
│   │   └── types.ts                # Shared type definitions
│   ├── package.json                # Functions dependencies
│   └── tsconfig.json               # Functions TypeScript config
├── vite.config.ts                  # Vite configuration
├── package.json                    # Frontend dependencies
├── tailwind.config.ts              # Tailwind configuration
├── tsconfig.json                   # Frontend TypeScript config
└── index.html                      # HTML entry point
```

## How to Run

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or yarn

### Installation & Development
```bash
# Dependencies are already installed
# If you need to reinstall:
npm install

# Start development server
npm run dev

# The app will be available at:
# http://localhost:8080
```

### Build for Production
```bash
# Build the project
npm run build

# Preview production build
npm run preview
```

### Available Scripts
- `npm run dev` - Start development server (port 8080)
- `npm run build` - Build for production
- `npm run build:dev` - Build in development mode
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Features

### Authentication
- Firebase Authentication
- Email/password sign up and sign in
- Protected routes

### Dashboard (`/`)
- **Stats Overview:**
  - Reddit posts synced (real-time count)
  - Pending AI suggestions
  - Created tickets
  - Trending issues
- **Community Champions:** Top contributors by engagement
- **AI Ticket Suggestions:** Review and approve/decline AI-generated tickets
- **Generate Suggestions Button:** Triggers Gemini AI analysis of recent feedback

### Tickets Page (`/tickets`)
- **Ticket List View:** All tickets with filters
- **Ticket Details Panel:**
  - Edit title and description inline
  - Update state (draft → in_progress → done → archived)
  - Change priority (low, medium, high, critical)
  - View impact score
- **Linked Feedback Section:**
  - Shows all Reddit posts that contributed to this ticket
  - Click to view original Reddit posts
  - Displays author, subreddit, engagement metrics
  - **This is the key feature that was broken** - now fixed with proper source_refs tracking
- **Export:** Can export to Linear (integration needed)

### Settings Page (`/settings`)
- **Data Sources Manager:**
  - Add/remove Reddit subreddits
  - Configure date range for syncing (default: last 30 days)
  - Sync button triggers cloud function to fetch and analyze posts
  - View active integrations
- **Analytics Dashboard:** Engagement trends and feedback velocity

### AI-Powered Features

1. **Reddit Post Summarization (Gemini AI):**
   - Fetches posts from configured subreddits
   - Summarizes each post into 2-3 sentences
   - Extracts 2-4 key actionable insights
   - Identifies sentiment (positive/negative/neutral/mixed)
   - Stores in `feedback_sources` collection

2. **Ticket Suggestion Generation (Gemini AI):**
   - Analyzes last 50 feedback items
   - Groups similar feedback into themes
   - Generates 3-7 ticket suggestions with:
     - Action-oriented title
     - Detailed description with user quotes
     - Priority (high/medium/low)
     - Impact score (0-100)
     - Theme category
     - Trending flag (3+ mentions)
     - **source_refs array** - links back to original feedback
   - Higher engagement = higher priority

3. **Automatic Feedback Linking:**
   - When you approve a ticket suggestion
   - Creates ticket in `tickets` collection
   - Creates links in `ticket_feedback_links` collection
   - Links ticket to all source feedback items
   - Viewable in Tickets page

### UI Features
- Dark/light theme toggle
- Responsive design (mobile + desktop)
- Modern glassmorphic navbar
- Real-time updates via Firestore subscriptions
- Toast notifications
- Search and filtering

## Complete Data Flow

### 1. Adding a Reddit Data Source
1. User navigates to Settings → Data Sources
2. Enters subreddit name (e.g., "reactjs")
3. Selects date range (default: last 30 days)
4. Clicks "Sync Feedback"
5. Frontend calls `redditSync` cloud function

### 2. Reddit Sync (Cloud Function)
**Function:** `functions/src/index.ts` → `redditSync`

1. **Validate subreddit** exists via Reddit API
2. **Authenticate with Reddit** using OAuth (client credentials)
3. **Fetch posts** from subreddit (sorted by new, filtered by date range)
4. **Summarize with Gemini AI:**
   - Batch process 5-10 posts at a time
   - Extract summary, key points, sentiment
   - Format: Title + Summary + Key Points + Engagement
5. **Store in Firestore:**
   - Collection: `feedback_sources`
   - Fields: content, author, channel (subreddit), external_id (Reddit post ID), engagement (upvotes), metadata
6. **Return** count of synced posts

### 3. Generate Ticket Suggestions
**Function:** `functions/src/suggest-tickets.ts` → `suggestTickets`

1. User clicks "Generate Suggestions" on Dashboard
2. **Fetch last 50 feedback items** from `feedback_sources`
3. **Prepare for Gemini AI:**
   - Include feedback ID, author, channel, engagement, content
   - Format with clear structure
4. **Call Gemini AI** with enhanced prompt:
   - Identify recurring themes across all feedback
   - Group similar issues together
   - Calculate impact scores based on frequency + engagement
   - **Track source_refs** - which feedback IDs contribute to each ticket
5. **Parse AI response** (JSON array of suggestions)
6. **Store in Firestore:**
   - Collection: `ticket_suggestions`
   - Fields: title, description, theme, priority, impact_score, is_trending, **source_refs**, reasoning, status (pending)

### 4. Review and Approve Suggestions
**Component:** `src/components/TicketSuggestions.tsx`

1. Dashboard displays pending suggestions
2. User can filter by priority, theme, trending
3. Each suggestion shows:
   - Title and description
   - Priority badge
   - Impact score
   - Number of linked sources
   - Trending indicator
4. User clicks "Create Ticket" to approve OR "Decline" to reject

### 5. Create Ticket with Linked Feedback
**When user approves a suggestion:**

1. **Create ticket** in `tickets` collection:
   - Copy title, description, priority, impact_score from suggestion
   - Set state to 'backlog'
2. **Link feedback** in `ticket_feedback_links` collection:
   - For each feedback ID in `source_refs`
   - Create link: { ticket_id, feedback_id }
3. **Update suggestion** status to 'approved'
4. Navigate to Tickets page

### 6. View Ticket with Linked Feedback
**Component:** `src/pages/Tickets.tsx`

1. Tickets page lists all tickets
2. User selects a ticket
3. **Fetch linked feedback:**
   - Query `ticket_feedback_links` by ticket_id
   - Join with `feedback_sources` to get full feedback data
4. **Display linked feedback:**
   - Author (u/username)
   - Subreddit (r/subredditname)
   - Content preview
   - Link to original Reddit post
   - Date posted
5. User can edit ticket details, change state/priority, delete ticket

## Firestore Collections

### 1. `feedback_sources`
Stores Reddit posts (or other feedback) after AI summarization.

**Fields:**
- `content`: Formatted summary (title + summary + key points + engagement)
- `author`: Reddit username
- `channel`: Subreddit name
- `source`: 'reddit'
- `external_id`: Reddit post ID (e.g., "t3_abc123")
- `engagement`: Upvote score
- `created_at`: Post timestamp
- `user_id`: Owner user ID
- `source_config_id`: Link to integration config
- `metadata`: { post_type, permalink, num_comments, url, original_title, summarized }

### 2. `ticket_suggestions`
AI-generated ticket suggestions awaiting approval.

**Fields:**
- `title`: Ticket title (max 60 chars)
- `description`: Detailed description
- `theme`: Category (e.g., "Performance", "UX", "Feature Request")
- `priority`: 'low' | 'medium' | 'high'
- `impact_score`: 0-100
- `is_trending`: Boolean (3+ feedback items mention this)
- `source_refs`: Array of feedback_source IDs
- `reasoning`: Why this ticket matters
- `status`: 'pending' | 'approved' | 'declined'
- `declined_reason`: Optional feedback on why declined
- `created_at`: Timestamp
- `user_id`: Owner user ID
- `metadata`: { feedback_count, generated_by, linked_feedback_count }

### 3. `tickets`
Approved tickets (the product backlog).

**Fields:**
- `title`: Ticket title
- `description`: Problem statement
- `state`: 'draft' | 'in_review' | 'in_progress' | 'done' | 'archived'
- `priority`: 'low' | 'medium' | 'high' | 'critical'
- `impact_score`: 0-100 (inherited from suggestion)
- `owner`: Assigned user
- `created_at`: Timestamp
- `updated_at`: Timestamp
- `export_status`: Linear/GitHub export status

### 4. `ticket_feedback_links`
Many-to-many join table linking tickets to feedback.

**Fields:**
- `ticket_id`: Reference to tickets collection
- `feedback_id`: Reference to feedback_sources collection

### 5. `integration_configs`
User's configured data sources.

**Fields:**
- `user_id`: Owner
- `integration_type`: 'reddit'
- `channel`: Subreddit name
- `config`: { subreddit: string }
- `is_active`: Boolean
- `created_at`: Timestamp

## Configuration

### Environment Variables

**Frontend (.env):**
```bash
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

**Cloud Functions (functions/.env):**
```bash
# Gemini AI Configuration
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash

# Reddit API Configuration (optional - can also be in Firebase config)
REDDIT_CLIENT_ID=your_reddit_app_id
REDDIT_CLIENT_SECRET=your_reddit_secret
REDDIT_USERNAME=your_reddit_username
REDDIT_PASSWORD=your_reddit_password
```

**Note:** Using `.env` file is recommended over `firebase functions:config` as the latter is being deprecated in March 2026. The code checks `process.env` first, then falls back to `functions.config()`.

## Deployment

### Frontend
```bash
npm run build
firebase deploy --only hosting
```

### Cloud Functions
```bash
cd functions
npm run build
firebase deploy --only functions
```

## Critical System Requirements

### Required Firestore Indexes

The app requires composite indexes for multi-user queries. These are defined in `firestore.indexes.json` and must be deployed:

```bash
firebase deploy --only firestore:indexes
```

**Required indexes:**
1. `ticket_suggestions`: user_id + status + impact_score (DESC)
2. `user_profiles`: user_id + superuser_score (DESC)
3. `tickets`: user_id + created_at (DESC)
4. `clusters`: user_id + status
5. `integration_configs`: user_id + is_active + created_at (DESC)
6. `feedback_sources`: user_id + created_at (DESC)
7. `events`: user_id + timestamp (DESC)

**Why needed:** Firestore requires composite indexes when filtering by one field (`user_id`) AND ordering by another field. Without these, queries will fail with "The query requires an index" errors or timeout with `deadline-exceeded`.

**Index status:** Check at `https://console.firebase.google.com/project/[YOUR_PROJECT_ID]/firestore/indexes`

Wait 2-5 minutes after deployment for indexes to build (status should show "Enabled").

### Authentication Hook (useAuth)

All components use a custom `useAuth` hook instead of directly accessing `firebase.auth.currentUser`:

```typescript
// src/hooks/use-auth.ts
import { useEffect, useState } from 'react';
import { firebase } from '@/lib/firebase';
import type { User } from 'firebase/auth';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = firebase.auth.onAuthStateChange((authUser) => {
      setUser(authUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return { user, loading, isAuthenticated: !!user };
}
```

**Why needed:** Direct access to `firebase.auth.currentUser` can be synchronous and return `null` before auth state is ready, causing timing issues. The `useAuth` hook properly waits for auth state via `onAuthStateChange`.

**Usage in components:**
```typescript
const { user } = useAuth();

// Always check user before making queries
if (!user) {
  return; // or show loading state
}

// Use user.uid for queries
firebase.from('tickets').select('*').eq('user_id', user.uid)
```

### Gemini API Rate Limiting

**Problem:** Free tier Gemini API has 20 RPM (requests per minute) limit. With inefficient batching, syncing 50 posts could trigger 50+ API calls.

**Solution:** Optimized batching to minimize API calls:

**Reddit Post Summarization:**
- Batch size: 25 posts per API call (increased from 10)
- Delay: 4 seconds between batches (increased from 1.5s)
- For 50 posts: Only 2 API calls
- For 100 posts: Only 4 API calls

**Fallback behavior:**
- If bulk summarization fails, uses simple text fallback
- NO longer makes individual API calls (was causing 50+ calls!)

**Ticket Suggestion Generation:**
- Analyzes 50 feedback items in 1 API call
- Total per sync: ~3 API calls (2 for summarization, 1 for suggestions)

**Result:** Well under 20 RPM limit, even with concurrent syncs.

## Recent Fixes (2025-10-26)

### ✅ Fixed: Multi-User Data Isolation (Multi-Tenancy)
**Problem:** Two users logging in from different accounts were seeing each other's data. All tickets, feedback, and suggestions were shared across all users instead of being isolated per user.

**Root Cause:** Frontend queries were NOT filtering by `user_id`. The Firebase wrapper automatically adds `user_id` when inserting records, but queries didn't filter by it, so every user saw everyone's data.

**Fix:**
Added `.eq('user_id', currentUser.uid)` to ALL queries in:
1. **Dashboard.tsx** - Stats queries (feedback count, suggestions, tickets, trending)
2. **Tickets.tsx** - Ticket list fetching
3. **TicketSuggestions.tsx** - Pending suggestions fetching
4. **Analytics.tsx** - Metrics queries
5. **CommunityChampions.tsx** - User profiles fetching
6. **TicketSuggestions.tsx** - Added `user_id` when creating tickets from suggestions

**Result:** Each user now sees only their own data. Complete data isolation between users. ✅

### ✅ Fixed: Linked Feedback Not Working
**Problem:** When creating tickets from suggestions, no feedback was being linked. The Tickets page showed "No feedback linked yet" for all tickets.

**Root Cause:** The `suggest-tickets` cloud function wasn't storing `source_refs` (the array of feedback IDs that contributed to each suggestion). Without this, there was nothing to link when creating tickets.

**Fix:**
1. Enhanced AI prompt to explicitly request `source_refs` array
2. Updated `GeneratedSuggestion` interface to include `source_refs`
3. Modified Firestore storage to save `source_refs` array
4. Added `linked_feedback_count` to metadata for tracking

**Result:** Tickets now properly link to their source Reddit posts, viewable in the Tickets page.

### ✅ Improved: AI Ticket Conversion Rate
**Problem:** Very few Reddit posts were being converted into ticket suggestions. The AI was generating vague, generic suggestions.

**Root Cause:**
1. AI prompt was too simple and didn't emphasize pattern recognition
2. Feedback wasn't formatted with context (author, engagement, channel)
3. No explicit instruction to group similar feedback
4. Missing theme categorization

**Fix:**
1. **Enhanced ticket generation prompt:**
   - Explicitly ask AI to identify recurring themes
   - Group similar feedback together
   - Calculate impact_score from frequency + engagement + severity
   - Add `theme` field for categorization
   - Provide detailed guidelines on priority assignment
   - Include example output format
2. **Improved feedback formatting:**
   - Include author, channel, engagement upfront
   - Add clear separators between feedback items
   - Preserve feedback IDs for tracking
3. **Better summarization prompts:**
   - Focus on actionable insights
   - Extract the "why" behind requests
   - Identify specific problems and solutions

**Result:** Higher quality suggestions that group related feedback and better reflect user needs.

### ✅ Improved: Error Handling for Reddit Sync
**Problem:** UI was showing "Failed to sync posts" even when the sync was actually working.

**Fix:**
1. Added detailed console logging of sync responses
2. Added `.catch()` handler for promise rejections
3. Improved error messages to show actual error details
4. Reset sync progress after completion

**Result:** Better visibility into sync status and clearer error messages.

### ✅ Fixed: Authentication Timing Issues
**Problem:** Console flooding with "No authenticated user" errors. Components were checking auth state before it was ready.

**Root Cause:** Components were using `firebase.auth.currentUser` synchronously in `useCallback`, but auth state wasn't initialized yet. This caused race conditions where queries would run before authentication completed.

**Fix:**
1. Created custom `useAuth` hook that properly waits for auth state
2. Updated all 6 components to use `useAuth()` instead of direct `currentUser` access
3. Added early returns when `user` is null

**Components updated:**
- `Dashboard.tsx`
- `Tickets.tsx`
- `TicketSuggestions.tsx`
- `Analytics.tsx`
- `CommunityChampions.tsx`
- `DataSourcesManager.tsx`

**Result:** No more authentication timing errors, proper auth state handling throughout the app.

### ✅ Fixed: deadline-exceeded Errors During Reddit Sync
**Problem:** Reddit sync failing with `deadline-exceeded` error even with only 50 posts.

**Root Cause:** Missing Firestore composite indexes for `user_id` queries. When we added multi-tenancy filters, queries like `where('user_id', '==', uid).orderBy('created_at', 'desc')` required new indexes. Without them, Firestore does slow collection scans that timeout.

**Fix:**
1. Added 7 composite indexes to `firestore.indexes.json`
2. Deployed indexes: `firebase deploy --only firestore:indexes`
3. Waited 2-5 minutes for indexes to build

**Required indexes added:**
- `ticket_suggestions`: user_id + status + impact_score
- `user_profiles`: user_id + superuser_score
- `tickets`: user_id + created_at
- `clusters`: user_id + status
- `integration_configs`: user_id + is_active + created_at
- `feedback_sources`: user_id + created_at
- `events`: user_id + timestamp

**Result:** Reddit sync completes successfully without timeouts.

### ✅ Optimized: Gemini API Rate Limiting
**Problem:** Frequently hitting Gemini 20 RPM (requests per minute) and RPD (requests per day) limits.

**Root Cause:**
- Small batch size (10 posts per call) = more API calls
- Dangerous fallback: If bulk summarization failed, fell back to individual calls (50 posts = 50 API calls!)
- Short delays between batches (1.5s)

**Fix:**
1. **Increased batch size:** 10 → 25 posts per call
   - 50 posts: 5 calls → 2 calls (60% reduction!)
   - 100 posts: 10 calls → 4 calls
2. **Removed dangerous fallback:** Now uses simple text fallback instead of making more API calls
3. **Increased delays:** 1.5s → 4s between batches
4. **Removed try-catch wrapper** in redditSync that was causing double fallbacks

**Files modified:**
- `functions/src/gemini-summarizer.ts` - Updated batch size and delays
- `functions/src/index.ts` - Removed fallback try-catch

**Result:**
- Maximum 3 API calls per sync (2 summarization, 1 suggestions)
- Well under 20 RPM limit even with multiple concurrent syncs
- No more rate limit errors

### ✅ Added: Custom Post Limit for Reddit Sync
**Problem:** Default limit of 1000 posts was causing timeouts and rate limit issues.

**Fix:**
1. Added `postLimit` state variable (default: 100)
2. Added UI input field in DataSourcesManager for users to customize limit
3. Pass custom limit to redditSync cloud function

**Location:** `src/components/DataSourcesManager.tsx:405-419`

**Result:** Users can now control how many posts to sync, avoiding timeouts and rate limits.

### ✅ Migrated: Environment Variables from functions.config to .env
**Problem:** Using deprecated `firebase functions:config:set` for configuration. Being removed March 2026.

**Fix:**
1. Created `functions/.env` file
2. Removed gemini config from Firebase: `firebase functions:config:unset gemini`
3. Added Gemini API key to `.env` (already supported by code as fallback)

**Configuration:**
```bash
# functions/.env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
```

**Result:** Using modern, recommended configuration approach that won't be deprecated.

## Development Tips

### Adding New Cloud Functions
1. Create function in `functions/src/`
2. Export from `functions/src/index.ts`
3. Deploy: `firebase deploy --only functions:functionName`

### Adding New UI Components
Most UI components come from shadcn-ui. To add more:
```bash
npx shadcn-ui@latest add [component-name]
```

### Theme Customization
Edit `tailwind.config.ts` for colors, spacing, typography.
Dark/light themes are in `src/index.css` using CSS variables.

### Testing Cloud Functions Locally
```bash
cd functions
npm run serve
```

### Viewing Firestore Data
Use Firebase Console or Firebase Emulator UI.

## Known Limitations

1. **Reddit API Rate Limits:** 60 requests/minute
2. **Gemini API Limits:** Free tier has quotas
3. **No comment analysis:** Only top-level posts, not comments
4. **Single source:** Only Reddit currently (can extend to Discord, Twitter, etc.)
5. **Manual refresh:** No automatic periodic syncing (could add with Cloud Scheduler)

## Troubleshooting

### Cloud Function Errors
```bash
# View logs
firebase functions:log

# Check environment variables
# Edit functions/.env file with your API keys

# Deploy after changing .env
cd functions && npm run build
firebase deploy --only functions
```

### Gemini API Rate Limits
If hitting 20 RPM limit:
1. Reduce post limit in DataSourcesManager UI (try 25-50 posts)
2. Increase batch delay in `functions/src/gemini-summarizer.ts`
3. Upgrade Gemini API tier for higher limits
4. Wait longer between syncs

### Missing Firestore Indexes
If seeing "The query requires an index" errors:
```bash
firebase deploy --only firestore:indexes
# Wait 2-5 minutes for indexes to build
# Check status: Firebase Console → Firestore → Indexes
```

### Reddit Sync Failing
1. Check Reddit credentials in functions config
2. Verify subreddit exists and is public
3. Check Reddit API rate limits (60/min)

### No Tickets Generated
1. Ensure feedback exists in `feedback_sources`
2. Check Gemini API key is valid
3. View function logs for AI response errors
4. Verify prompt isn't hitting token limits

### Linked Feedback Not Showing
1. Check `ticket_feedback_links` collection has entries
2. Verify `source_refs` array exists on ticket_suggestion
3. Ensure feedback IDs match between collections

## License

[Add your license here]

## Contributing

[Add contributing guidelines here]

---

**Last Updated**: 2025-10-26
**Tech Stack**: React + Vite + Firebase + Gemini AI
**Status**: Fully functional with multi-tenancy, optimized rate limiting, and working feedback linking

**Key Features:**
- ✅ Multi-user data isolation with proper authentication
- ✅ Firestore composite indexes for fast queries
- ✅ Optimized Gemini API batching (60% fewer calls)
- ✅ Custom post limits to avoid timeouts
- ✅ Environment variable configuration (.env)
- ✅ Linked feedback tracking from Reddit posts to tickets
