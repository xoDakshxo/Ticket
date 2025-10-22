# Loopd - Feedback Loop Station

AI-powered feedback aggregation and ticket management system built with React, TypeScript, and Firebase.

## 🚀 Quick Start

**New to this project?** Follow these steps:

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up Firebase** (5 minutes)

   See **[QUICKSTART.md](./QUICKSTART.md)** for step-by-step instructions

   Or read **[FIREBASE_SETUP.md](./FIREBASE_SETUP.md)** for detailed guide

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your Firebase credentials
   ```

4. **Start development**
   ```bash
   npm run dev
   ```

5. **Open your browser**

   Visit http://localhost:8080

## 📋 What's This Project?

Loopd helps product teams:
- 📊 **Aggregate feedback** from multiple sources (Reddit, Discord, manual input)
- 🤖 **AI-powered analysis** to cluster similar feedback
- 🎫 **Generate ticket suggestions** automatically
- 👥 **Identify community champions** based on engagement
- 📈 **Track metrics** and analytics

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Firebase (Firestore + Auth)
- **UI Components**: shadcn-ui (40+ components)
- **Styling**: Tailwind CSS
- **State Management**: TanStack React Query
- **Charts**: Recharts
- **Animations**: Framer Motion

## 📁 Project Structure

```
src/
├── lib/
│   └── firebase.ts         # Firebase configuration & API
├── pages/
│   ├── Auth.tsx           # Login/signup page
│   ├── Dashboard.tsx      # Main dashboard
│   ├── Tickets.tsx        # Ticket management
│   └── Settings.tsx       # Data sources & analytics
├── components/
│   ├── Layout.tsx         # App shell with navbar
│   ├── TicketSuggestions.tsx
│   ├── CommunityChampions.tsx
│   ├── DataSourcesManager.tsx
│   └── ui/                # shadcn-ui components
└── hooks/
    └── use-toast.ts       # Toast notifications
```

## 🔥 Firebase Collections

Your Firestore database will have these collections:

- `tickets` - User-created tickets
- `ticket_suggestions` - AI-generated suggestions
- `feedback_sources` - Raw feedback data
- `user_profiles` - Community member profiles
- `integration_configs` - Data source settings
- `clusters` - Grouped feedback themes
- `events` - Activity logs

## 📜 Available Scripts

```bash
# Development
npm run dev              # Start dev server (port 8080)

# Production
npm run build            # Build for production
npm run preview          # Preview production build

# Code Quality
npm run lint             # Run ESLint
```

## 🔐 Environment Variables

Required variables (get from Firebase Console):

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

## 📖 Documentation

- **[QUICKSTART.md](./QUICKSTART.md)** - Get up and running in 5 minutes
- **[FIREBASE_SETUP.md](./FIREBASE_SETUP.md)** - Complete Firebase setup guide
- **[claude.md](./claude.md)** - Project architecture & development guide

## 🌟 Features

### Current Features
- ✅ Email/password authentication
- ✅ Ticket creation and management
- ✅ Manual feedback ingestion
- ✅ Data source configuration (Reddit subreddits)
- ✅ Community champions dashboard
- ✅ Real-time updates (Firestore subscriptions)
- ✅ Dark/light theme
- ✅ Responsive design

### Planned Features (Require Backend Functions)
- 🔄 Automated Reddit syncing
- 🤖 AI ticket suggestions
- 🎯 Feedback clustering
- 📧 Email digests
- 🔗 GitHub/Discord/Slack integrations

## 🚢 Deployment

### Deploy to Firebase Hosting

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize (choose Hosting)
firebase init

# Build and deploy
npm run build
firebase deploy
```

Your app will be live at: `https://your-project.firebaseapp.com`

### Deploy to Vercel/Netlify

```bash
# Build command
npm run build

# Output directory
dist

# Environment variables
Add all VITE_FIREBASE_* variables in your hosting dashboard
```

## 🤝 Contributing

This project was converted from a Lovable.dev + Supabase stack to Firebase.

Original features included:
- 12 Deno edge functions for AI processing
- PostgreSQL database with 10+ tables
- Reddit API integration
- OpenAI/Anthropic integration for AI features

Current focus: Clean, maintainable Firebase-based architecture.

## 📝 Migration History

- **v1.0**: Built with Lovable.dev + Supabase
- **v2.0**: Removed Lovable integrations, replaced with mock data
- **v3.0**: Integrated Firebase (current version)

## 🐛 Troubleshooting

**Firebase authentication not working?**
- Check `.env` file exists and has correct values
- Restart dev server after changing `.env`
- Verify Email/Password is enabled in Firebase Console

**Data not persisting?**
- Check Firestore security rules allow authenticated users
- Verify you're logged in
- Check browser console for errors

**Build errors?**
- Clear cache: `rm -rf node_modules package-lock.json && npm install`
- Check all environment variables are set

## 📄 License

[Add your license here]

## 👨‍💻 Author

Built by [Your Name]

---

**Ready to start?** → See [QUICKSTART.md](./QUICKSTART.md)
