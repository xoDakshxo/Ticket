# Firebase Deployment Guide

Complete guide for deploying Loopd to Firebase.

## Prerequisites

- Firebase CLI installed: `npm install -g firebase-tools`
- Firebase project created
- Environment variables configured

## Quick Deploy

```bash
# Build the project
npm run build

# Login to Firebase (if not already)
firebase login

# Deploy everything
firebase deploy
```

## Deploy Specific Components

### Deploy Hosting Only
```bash
npm run build
firebase deploy --only hosting
```

### Deploy Firestore Rules
```bash
firebase deploy --only firestore:rules
```

### Deploy Firestore Indexes
```bash
firebase deploy --only firestore:indexes
```

### Deploy Functions
```bash
firebase deploy --only functions
```

## Initial Setup

### 1. Initialize Firebase (First Time Only)

```bash
firebase init
```

Select:
- **Firestore**: Configure rules and indexes
- **Functions**: Set up Cloud Functions (optional)
- **Hosting**: Deploy web app

Answers:
- Use existing project: **Select your Firebase project**
- Firestore rules file: `firestore.rules`
- Firestore indexes file: `firestore.indexes.json`
- What language for Functions: **TypeScript**
- Use ESLint: **Yes**
- Install dependencies: **Yes**
- Public directory: `dist`
- Configure as single-page app: **Yes**
- Set up automatic builds with GitHub: **No** (or Yes if you want)

### 2. Deploy Security Rules

The `firestore.rules` file is already configured. Deploy it:

```bash
firebase deploy --only firestore:rules
```

### 3. Deploy Indexes

```bash
firebase deploy --only firestore:indexes
```

Wait 5-10 minutes for indexes to build.

### 4. Build & Deploy App

```bash
# Build production bundle
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

Your app will be live at: `https://YOUR_PROJECT_ID.web.app`

## Continuous Deployment

### Option 1: GitHub Actions

Create `.github/workflows/firebase-hosting.yml`:

```yaml
name: Deploy to Firebase Hosting

on:
  push:
    branches:
      - main

jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install dependencies
        run: npm install

      - name: Build
        run: npm run build
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}

      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          channelId: live
          projectId: your-project-id
```

Add secrets in GitHub Settings → Secrets and variables → Actions.

### Option 2: Firebase Automatic Deploys

```bash
firebase init hosting:github
```

Follow the prompts to set up automatic deploys on push.

## Environment Variables

Firebase Hosting doesn't support server-side environment variables. All variables must be in your `.env` file and bundled at build time.

**For production:**

1. Create `.env.production`:
```env
VITE_FIREBASE_API_KEY=your_production_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

2. Build with production env:
```bash
npm run build  # Automatically uses .env.production
```

## Custom Domain

### 1. Add Custom Domain in Firebase Console

1. Go to Hosting → Custom domains
2. Click "Add custom domain"
3. Enter your domain (e.g., `app.yourdomain.com`)

### 2. Configure DNS

Add these records at your DNS provider:

```
Type: A
Name: @  (or subdomain)
Value: [Firebase IPs shown in console]

Type: A
Name: @  (or subdomain)
Value: [Firebase IPs shown in console]
```

Or use CNAME:
```
Type: CNAME
Name: subdomain
Value: your-project.web.app
```

SSL certificates are provisioned automatically (takes a few hours).

## Performance Optimization

### Enable Compression

Already configured in `firebase.json`:
```json
{
  "hosting": {
    "headers": [
      {
        "source": "**/*.@(js|css)",
        "headers": [{
          "key": "Cache-Control",
          "value": "max-age=31536000"
        }]
      }
    ]
  }
}
```

### Prerender for SEO

Install prerender plugin:
```bash
npm install -D vite-plugin-prerender
```

Update `vite.config.ts`:
```typescript
import { VitePluginRadar } from 'vite-plugin-radar'

export default defineConfig({
  plugins: [
    react(),
    VitePluginRadar({
      analytics: { id: 'YOUR_GA_ID' }
    })
  ]
})
```

## Monitoring

### View Hosting Analytics

Firebase Console → Hosting → Dashboard

Metrics:
- Requests
- Bandwidth
- Load times

### View Function Logs

```bash
firebase functions:log
```

Or in Firebase Console → Functions → Logs

### Set Up Alerts

Firebase Console → Alerts:
- Budget alerts
- Performance alerts
- Crash alerts

## Rollback

If deployment has issues:

```bash
# View previous deploys
firebase hosting:channel:list

# Rollback to previous version
firebase hosting:clone SOURCE_SITE_ID:SOURCE_CHANNEL_ID DEST_SITE_ID:live
```

## Multi-Environment Setup

### Development
```bash
firebase use dev
firebase deploy
```

### Staging
```bash
firebase use staging
firebase deploy
```

### Production
```bash
firebase use production
firebase deploy
```

Create aliases:
```bash
firebase use --add
```

## Cost Monitoring

### Free Tier (Spark Plan)
- 10 GB storage
- 360 MB/day bandwidth
- 125K function invocations/day

### Paid Tier (Blaze Plan)
- Pay as you go
- First 10 GB storage: free
- First 360 MB/day bandwidth: free
- $0.026/GB after that

Set budget alerts in Firebase Console → Billing.

## Troubleshooting

### Build Fails
```bash
# Clear cache
rm -rf node_modules dist
npm install
npm run build
```

### Deploy Fails
```bash
# Check Firebase CLI version
firebase --version

# Update if needed
npm install -g firebase-tools@latest

# Re-authenticate
firebase login --reauth
```

### Functions Not Working
```bash
# Check logs
firebase functions:log --only functionName

# Test locally
cd functions
npm run serve
```

### Security Rules Error
```bash
# Validate rules
firebase firestore:rules:validate

# Deploy rules only
firebase deploy --only firestore:rules
```

## Best Practices

1. **Always test locally first**
   ```bash
   firebase emulators:start
   ```

2. **Use preview channels for testing**
   ```bash
   firebase hosting:channel:deploy preview
   ```

3. **Monitor costs regularly**

4. **Keep backups of Firestore data**
   ```bash
   gcloud firestore export gs://your-bucket/backups
   ```

5. **Use version control for all config files**

## Additional Resources

- [Firebase Hosting Docs](https://firebase.google.com/docs/hosting)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Functions Docs](https://firebase.google.com/docs/functions)

---

🚀 **Ready to deploy?** Run `npm run build && firebase deploy`
