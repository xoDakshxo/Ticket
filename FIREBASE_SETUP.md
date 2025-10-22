# Firebase Setup Guide for Loopd

This guide will walk you through setting up Firebase for your Loopd application.

## 📋 Prerequisites

- Google account
- Node.js installed
- This project cloned and dependencies installed

## 🚀 Step-by-Step Setup

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** or **"Create a project"**
3. Enter project name: `loopd` (or your preferred name)
4. (Optional) Enable Google Analytics - choose based on your needs
5. Click **"Create project"**

### 2. Register Your Web App

1. In your Firebase project, click the **Web icon** (`</>`) to add a web app
2. Give your app a nickname: `loopd-web`
3. Check **"Also set up Firebase Hosting"** if you want to deploy to Firebase Hosting
4. Click **"Register app"**
5. You'll see a Firebase configuration object - **SAVE THIS!**

It looks like:
```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

### 3. Set Up Authentication

1. In Firebase Console, go to **"Build" → "Authentication"**
2. Click **"Get started"**
3. Click **"Sign-in method"** tab
4. Enable **"Email/Password"**
   - Toggle on **"Email/Password"**
   - Click **"Save"**

### 4. Set Up Firestore Database

1. In Firebase Console, go to **"Build" → "Firestore Database"**
2. Click **"Create database"**
3. Choose **"Start in production mode"** (we'll update rules later)
4. Select a location (choose closest to your users)
5. Click **"Enable"**

### 5. Configure Firestore Security Rules

1. In Firestore Database, go to **"Rules"** tab
2. Replace with these rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }

    // Helper function to check if user owns the document
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // Tickets collection
    match /tickets/{ticketId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated();
    }

    // Ticket Suggestions collection
    match /ticket_suggestions/{suggestionId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated();
    }

    // Feedback Sources collection
    match /feedback_sources/{feedbackId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated();
    }

    // User Profiles collection
    match /user_profiles/{profileId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated();
    }

    // Integration Configs collection
    match /integration_configs/{configId} {
      allow read, write: if isAuthenticated();
    }

    // Clusters collection
    match /clusters/{clusterId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated();
    }

    // Events collection
    match /events/{eventId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
    }

    // Allow all other collections for authenticated users
    match /{document=**} {
      allow read, write: if isAuthenticated();
    }
  }
}
```

3. Click **"Publish"**

### 6. Configure Your Local Environment

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Open `.env` and paste your Firebase config values:
```env
VITE_FIREBASE_API_KEY=AIza...your_actual_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

3. **IMPORTANT**: Never commit `.env` to git! It's already in `.gitignore`

### 7. Update Components to Use Firebase

The Firebase client has been created at `src/lib/firebase.ts` with a Supabase-compatible API.

Update your components to import from Firebase instead of mockSupabase:

**Before:**
```typescript
import { supabase } from "@/lib/mockSupabase";
```

**After:**
```typescript
import { supabase } from "@/lib/firebase";
```

Files to update:
- `src/pages/Auth.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Tickets.tsx`
- `src/components/Layout.tsx`
- `src/components/Analytics.tsx`
- `src/components/CommunityChampions.tsx`
- `src/components/DataSourcesManager.tsx`
- `src/components/FeedbackIngestion.tsx`
- `src/components/TicketList.tsx`
- `src/components/TicketSuggestions.tsx`

### 8. Test Your Setup

1. Start the development server:
```bash
npm run dev
```

2. Open http://localhost:8080

3. Try to sign up with a test account:
   - Click on authentication page
   - Create an account with email/password
   - You should be redirected to the dashboard

4. Verify in Firebase Console:
   - Go to **Authentication** → **Users**
   - You should see your test user

## 📊 Firestore Collections

Your app will automatically create these collections as data is added:

### Core Collections

1. **tickets**
   - Stores all tickets created from feedback
   - Fields: title, description, state, priority, impact_score, created_at, etc.

2. **ticket_suggestions**
   - AI-generated ticket suggestions
   - Fields: title, description, priority, status, impact_score, theme, etc.

3. **feedback_sources**
   - Raw feedback from various sources (Reddit, Discord, manual)
   - Fields: content, author, channel, source, external_id, engagement, etc.

4. **user_profiles**
   - Community member profiles and analytics
   - Fields: author, source, total_feedback_count, superuser_score, etc.

5. **integration_configs**
   - Configuration for data sources (Reddit, etc.)
   - Fields: integration_type, channel, config (JSON), is_active, etc.

6. **clusters**
   - Grouped feedback by theme/topic
   - Fields: theme, area, sentiment, impact_score, mentions_count, etc.

7. **events**
   - Activity logs and tracking
   - Fields: event_type, user_id, ticket_id, timestamp, etc.

### Data Structure Examples

**Ticket Document:**
```json
{
  "title": "Add dark mode support",
  "description": "Users are requesting a dark theme option",
  "state": "open",
  "priority": "medium",
  "impact_score": 75,
  "created_at": "2025-10-22T12:00:00Z",
  "updated_at": "2025-10-22T12:00:00Z",
  "owner": null,
  "export_status": null
}
```

**Feedback Source Document:**
```json
{
  "content": "This app would be much better with dark mode!",
  "author": "user123",
  "channel": "r/productfeedback",
  "source": "reddit",
  "external_id": "abc123",
  "engagement": 42,
  "followers": 1500,
  "created_at": "2025-10-22T12:00:00Z"
}
```

## 🔧 Advanced Configuration

### Enable Offline Persistence

Add to `src/lib/firebase.ts`:

```typescript
import { enableIndexedDbPersistence } from 'firebase/firestore';

enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.log('Persistence failed: Multiple tabs open');
  } else if (err.code === 'unimplemented') {
    console.log('Persistence not available');
  }
});
```

### Set Up Firebase Hosting (Optional)

1. Install Firebase CLI:
```bash
npm install -g firebase-tools
```

2. Login to Firebase:
```bash
firebase login
```

3. Initialize Firebase in your project:
```bash
firebase init
```

Select:
- **Hosting** (use spacebar to select)
- Choose your existing project
- Build directory: `dist`
- Single-page app: `Yes`
- Automatic builds with GitHub: `No` (for now)

4. Build and deploy:
```bash
npm run build
firebase deploy
```

Your app will be live at: `https://your-project.firebaseapp.com`

### Set Up Firebase Functions (For AI Features)

If you want to add server-side AI features (like ticket suggestions):

1. Enable Cloud Functions:
```bash
firebase init functions
```

2. Choose TypeScript or JavaScript

3. Install OpenAI or Anthropic SDK in functions folder:
```bash
cd functions
npm install openai
# or
npm install @anthropic-ai/sdk
```

4. Create a function in `functions/src/index.ts`:
```typescript
import * as functions from 'firebase-functions';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: functions.config().openai.key
});

export const suggestTickets = functions.https.onCall(async (data, context) => {
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const { feedback } = data;

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: "You are a helpful assistant that generates ticket suggestions from user feedback." },
      { role: "user", content: `Generate ticket suggestions from this feedback: ${feedback}` }
    ]
  });

  return { suggestions: completion.choices[0].message.content };
});
```

5. Set API key:
```bash
firebase functions:config:set openai.key="your-openai-key"
```

6. Deploy:
```bash
firebase deploy --only functions
```

7. Call from frontend:
```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const suggestTickets = httpsCallable(functions, 'suggestTickets');

const result = await suggestTickets({ feedback: 'User wants dark mode' });
console.log(result.data);
```

## 🐛 Troubleshooting

### "Firebase: Error (auth/configuration-not-found)"
- Check that your `.env` file exists and has all the required variables
- Restart your dev server after creating `.env`

### "Missing or insufficient permissions"
- Check your Firestore security rules
- Make sure you're authenticated (logged in)

### "Firebase App not initialized"
- Check that all environment variables are set correctly
- Make sure they start with `VITE_` prefix

### Import errors
- Make sure Firebase is installed: `npm install firebase`
- Check that imports are from `firebase/...` not `@firebase/...`

## 📚 Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Guide](https://firebase.google.com/docs/firestore)
- [Firebase Auth Guide](https://firebase.google.com/docs/auth)
- [Firebase Hosting](https://firebase.google.com/docs/hosting)
- [Firebase Functions](https://firebase.google.com/docs/functions)

## 💰 Pricing

Firebase has a generous free tier (Spark Plan):

**Free Tier Includes:**
- 50,000 reads/day
- 20,000 writes/day
- 20,000 deletes/day
- 1 GB storage
- 10 GB/month transfer
- Authentication unlimited users

**Paid Plan (Blaze):**
- Pay as you go
- Only pay for usage beyond free tier
- Typically costs $0-5/month for small apps

[View detailed pricing](https://firebase.google.com/pricing)

---

🎉 **Setup Complete!** Your app is now connected to Firebase and ready for development.
