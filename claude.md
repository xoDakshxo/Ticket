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

**Cloud Functions:**
```bash
# Set with: firebase functions:config:set
gemini.api_key=your_gemini_api_key
gemini.model=gemini-2.5-flash
reddit.client_id=your_reddit_app_id
reddit.client_secret=your_reddit_secret
reddit.username=your_reddit_username
reddit.password=your_reddit_password
```

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

# Check function config
firebase functions:config:get

# Set missing config
firebase functions:config:set gemini.api_key="YOUR_KEY"
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
**Status**: Fully functional with working feedback linking
