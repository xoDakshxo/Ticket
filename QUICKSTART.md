# 🚀 Quick Start - Firebase Setup

## What's Been Done

✅ Firebase SDK installed (firebase@12.4.0)
✅ Firebase configuration file created (`src/lib/firebase.ts`)
✅ Supabase-compatible API wrapper created
✅ All 10 components updated to use Firebase
✅ Environment variables configured
✅ `.gitignore` updated
✅ Production build tested successfully

## 📝 Next Steps (5 minutes to get running)

### 1. Create Firebase Project

Go to https://console.firebase.google.com and:

1. Click **"Add project"**
2. Name it: `loopd` (or your preferred name)
3. Disable Google Analytics (optional, can enable later)
4. Click **"Create project"**

### 2. Enable Authentication

1. In Firebase Console, click **"Build" → "Authentication"**
2. Click **"Get started"**
3. Click **"Sign-in method"** tab
4. Enable **"Email/Password"** (toggle ON)
5. Click **"Save"**

### 3. Create Firestore Database

1. In Firebase Console, click **"Build" → "Firestore Database"**
2. Click **"Create database"**
3. Choose **"Start in production mode"**
4. Select location closest to you
5. Click **"Enable"**

### 4. Update Security Rules

In Firestore Database → **Rules** tab, paste:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write all collections
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Click **"Publish"**

### 5. Get Your Firebase Config

1. In Firebase Console, click the **gear icon** ⚙️ → **"Project settings"**
2. Scroll down to **"Your apps"** section
3. Click the **Web icon** (`</>`)
4. Register your app with nickname: `loopd-web`
5. Copy the `firebaseConfig` object

### 6. Configure Your Local Environment

Create a `.env` file in your project root:

```bash
cp .env.example .env
```

Open `.env` and paste your Firebase config values:

```env
VITE_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890
```

### 7. Start Development Server

```bash
npm run dev
```

Open http://localhost:8080

### 8. Test It Out!

1. Click **"Sign Up"** tab
2. Create account with:
   - Email: `test@example.com`
   - Password: `password123`
3. You should be redirected to the dashboard

Verify in Firebase Console:
- Go to **Authentication** → **Users**
- Your test user should appear

## 🎉 You're Done!

Your app is now connected to Firebase. Data will persist in Firestore!

## 📚 Additional Resources

- **Full Setup Guide**: See `FIREBASE_SETUP.md` for advanced configuration
- **Firebase Console**: https://console.firebase.google.com
- **Firebase Docs**: https://firebase.google.com/docs

## 🔧 Troubleshooting

**"Firebase: Error (auth/configuration-not-found)"**
- Make sure `.env` file exists with all variables
- Restart dev server: `npm run dev`

**"Missing or insufficient permissions"**
- Check Firestore security rules allow authenticated users
- Make sure you're logged in

**Environment variables not working**
- All variables MUST start with `VITE_`
- Restart dev server after changing `.env`

## 📁 File Structure

```
/Users/dakshbagga/Code/Ticket/
├── .env                    ← YOUR CONFIG (create this!)
├── .env.example            ← Template
├── FIREBASE_SETUP.md       ← Detailed guide
├── QUICKSTART.md          ← This file
├── src/
│   └── lib/
│       ├── firebase.ts     ← Firebase client
│       └── mockSupabase.ts ← Old mock (not used)
└── package.json
```

## 🌐 Deploy to Firebase Hosting (Optional)

Once everything works locally:

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize
firebase init hosting

# Build & deploy
npm run build
firebase deploy
```

Your app will be live at: `https://your-project.firebaseapp.com`

---

**Need help?** Check `FIREBASE_SETUP.md` for detailed documentation.
