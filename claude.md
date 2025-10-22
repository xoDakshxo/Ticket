# Loopd - Feedback Loop Station

## Overview

Loopd is an AI-powered feedback aggregation and ticket management system. It was originally designed to collect feedback from Reddit, analyze it with AI, and generate actionable tickets for product teams.

This version has been stripped of external integrations (Lovable IDE and Supabase backend) and now runs as a standalone frontend application with mock data.

## What Was Removed

### Lovable Integrations
- **lovable-tagger** - Removed from package.json and vite.config.ts
- **Lovable metadata** - Removed from index.html (og:image, twitter tags, etc.)
- **Lovable references** - Cleaned from all configuration files

### Supabase Backend
- **Complete backend removal**:
  - Deleted `/supabase/` folder (12 Deno edge functions, 20+ migrations)
  - Deleted `/src/integrations/supabase/` folder (client, types)
  - Removed `@supabase/supabase-js` dependency

- **Edge Functions removed**:
  - suggest-tickets (AI ticket generation)
  - cluster-feedback (feedback clustering)
  - reddit-sync (Reddit API integration)
  - analyze-user-intelligence (user profile analysis)
  - ingest-feedback, loop-messages, weekly-digest
  - collect-engagement-snapshots
  - github-sync, discord-webhook, slack-action
  - backfill-user-profiles

- **Database tables removed** (10 tables):
  - clusters, tickets, feedback_sources, ticket_suggestions
  - user_profiles, feedback_engagement_snapshots
  - ticket_feedback_links, events, loop_messages
  - outreach_log, integration_configs

## Current Architecture

### Tech Stack
- **Frontend Framework**: React 18.3.1 + TypeScript
- **Build Tool**: Vite 5.4.19
- **Routing**: React Router DOM 6.30.1
- **State Management**: TanStack React Query 5.83.0
- **UI Components**: shadcn-ui (40+ Radix UI components)
- **Styling**: Tailwind CSS 3.4.17
- **Charts**: Recharts 2.15.4
- **Animations**: Framer Motion 12.23.24

### Data Layer
All components now use a mock Supabase client located at:
```
src/lib/mockSupabase.ts
```

This mock client provides:
- Mock authentication (stored in localStorage)
- Mock database queries (returns empty arrays)
- Mock real-time subscriptions (no-op)
- Mock edge function invocations (returns empty data)

### File Structure
```
/Users/dakshbagga/Code/Ticket/
├── src/
│   ├── main.tsx                    # Entry point
│   ├── App.tsx                     # Root component with routing
│   ├── pages/
│   │   ├── Auth.tsx               # Mock authentication
│   │   ├── Dashboard.tsx          # Main dashboard
│   │   ├── Tickets.tsx            # Ticket management
│   │   ├── Settings.tsx           # Settings/data sources
│   │   └── NotFound.tsx           # 404 page
│   ├── components/
│   │   ├── Layout.tsx             # Main layout with navbar
│   │   ├── TicketSuggestions.tsx  # AI ticket suggestions
│   │   ├── DataSourcesManager.tsx # Reddit source management
│   │   ├── CommunityChampions.tsx # User profiles
│   │   ├── Analytics.tsx          # Metrics dashboard
│   │   ├── FeedbackIngestion.tsx  # Manual feedback input
│   │   ├── ThemeProvider.tsx      # Dark/light theme
│   │   └── ui/                    # 40+ shadcn components
│   ├── lib/
│   │   ├── mockSupabase.ts        # Mock backend client
│   │   └── utils.ts               # Utility functions
│   └── hooks/
│       ├── use-toast.ts
│       └── use-mobile.tsx
├── vite.config.ts                 # Vite configuration
├── package.json                   # Dependencies
├── tailwind.config.ts             # Tailwind configuration
├── tsconfig.json                  # TypeScript configuration
└── index.html                     # HTML entry point
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

## Features (Currently Mock Data)

### Authentication
- Mock sign up / sign in
- Credentials stored in localStorage
- No real validation

### Dashboard (`/`)
- Stats overview (all showing 0)
  - Reddit posts synced
  - Pending suggestions
  - Created tickets
  - Trending issues
- Community Champions section (empty)
- AI Ticket Suggestions section (empty)
- Generate Suggestions button (mock function)

### Tickets Page (`/tickets`)
- Ticket list view (empty)
- Create new tickets manually
- Link feedback to tickets
- Filter by status (open, in_progress, closed, all)
- Priority management (low, medium, high)

### Settings Page (`/settings`)
- Data Sources Manager
  - Add/remove Reddit subreddits (mock)
  - Sync feedback button (mock)
  - Date range picker for syncing
- Analytics dashboard (all metrics at 0)

### UI Features
- Dark/light theme toggle
- Responsive design (mobile + desktop)
- Modern glassmorphic navbar
- Search functionality
- User dropdown menu

## Authentication Flow

Currently using localStorage for mock authentication:

1. User enters email/password on `/auth`
2. Credentials are stored in localStorage as JSON
3. No password validation or encryption
4. User is redirected to dashboard
5. Logout clears localStorage

**Note**: This is NOT secure and should only be used for UI development.

## Future Work / TODOs

If you want to add a real backend later:

### Option 1: Add Your Own Backend
1. Create REST API endpoints:
   - `/api/auth/*` - Authentication
   - `/api/tickets/*` - Ticket CRUD
   - `/api/feedback/*` - Feedback management
   - `/api/suggestions/*` - AI suggestions

2. Replace `src/lib/mockSupabase.ts` with a real API client:
   ```typescript
   // src/lib/apiClient.ts
   export const api = {
     auth: { ... },
     tickets: { ... },
     feedback: { ... }
   }
   ```

3. Update all components to use the new API client

### Option 2: Use Supabase (Reconnect)
1. Create a new Supabase project
2. Set up the database tables (see removed schema in documentation)
3. Reinstall: `npm install @supabase/supabase-js`
4. Create new client at `src/lib/supabaseClient.ts`
5. Update environment variables
6. Restore edge functions if needed

### Option 3: Use Firebase, PocketBase, or Other BaaS
1. Install the appropriate SDK
2. Create a client wrapper similar to mockSupabase
3. Update all imports
4. Configure authentication and database rules

## Development Tips

### Adding New Pages
1. Create component in `src/pages/`
2. Add route in `src/App.tsx`
3. Add to navigation menu in `src/components/Layout.tsx`

### Adding New UI Components
Most UI components come from shadcn-ui. To add more:
```bash
npx shadcn-ui@latest add [component-name]
```

Example:
```bash
npx shadcn-ui@latest add table
npx shadcn-ui@latest add form
```

### Theme Customization
Edit `tailwind.config.ts` to customize:
- Colors
- Spacing
- Typography
- Breakpoints

Dark/light themes are configured in `src/index.css` using CSS variables.

### Mock Data Enhancement
To add realistic mock data for UI development:

1. Edit `src/lib/mockSupabase.ts`
2. Add data to the `mockData` object:
   ```typescript
   const mockData = {
     tickets: [
       { id: '1', title: 'Fix login bug', state: 'open', ... }
     ],
     feedbackSources: [...],
     ...
   }
   ```
3. Update query methods to return appropriate data

## Known Limitations

1. **No persistence** - All data resets on page refresh
2. **No real-time updates** - Subscriptions are stubbed
3. **No AI features** - Suggestion generation is mocked
4. **No Reddit integration** - Syncing is non-functional
5. **No user management** - Single mock user only
6. **No GitHub/Discord/Slack exports** - All removed

## Troubleshooting

### Port 8080 already in use
```bash
# Change port in vite.config.ts
server: {
  port: 3000, // or any other port
}
```

### TypeScript errors about Database types
These were auto-generated from Supabase. If you see errors:
1. Check that all `@/integrations/supabase/*` imports are removed
2. Ensure all files import from `@/lib/mockSupabase` instead

### Build errors
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

## Project Origin

This project was originally created with Lovable.dev and used:
- Supabase for backend (PostgreSQL + Auth + Edge Functions)
- Lovable AI for code generation
- Reddit API for feedback collection
- OpenAI/Anthropic for AI features

It has been converted to a standalone frontend-only application for local development.

## License

[Add your license here]

## Contributing

[Add contributing guidelines here]

---

**Last Updated**: 2025-10-22
**Current Version**: Standalone (no backend)
**Original Stack**: Lovable + Supabase + React
**Current Stack**: React + Vite + Mock Data
