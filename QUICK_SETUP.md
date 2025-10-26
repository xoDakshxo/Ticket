# ⚡ Reddit Integration - Quick Setup

## 1️⃣ Install (30 seconds)

```bash
cd functions
npm install
```

## 2️⃣ Get Gemini API Key (1 minute)

Visit: https://makersuite.google.com/app/apikey

Click "Create API Key" → Copy the key

## 3️⃣ Configure Firebase (30 seconds)

```bash
firebase functions:config:set gemini.api_key="YOUR_GEMINI_API_KEY_HERE"
```

## 4️⃣ Build & Deploy (2 minutes)

```bash
cd functions
npm run build
cd ..
firebase deploy --only functions
```

Wait for: ✅ Deploy complete!

## 5️⃣ Test (1 minute)

1. Open your app
2. Go to **Settings**
3. Enter subreddit: `typescript`
4. Select: Last 7 days
5. Click **"Add Thread"**
6. Watch it sync! 🎉

---

## ✅ Done!

Your Reddit integration is live with AI-powered summarization!

**See full guide:** [REDDIT_SETUP_GUIDE.md](./REDDIT_SETUP_GUIDE.md)

---

## 🐛 Quick Troubleshooting

**Error: "Gemini API key not configured"**
```bash
firebase functions:config:set gemini.api_key="YOUR_KEY"
firebase deploy --only functions
```

**Error: "Function not found"**
```bash
firebase deploy --only functions
```

**View Logs:**
```bash
firebase functions:log --only redditSync
```
