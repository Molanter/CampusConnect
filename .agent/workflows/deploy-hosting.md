---
description: Deploy the Next.js app to Firebase Hosting with Cloud Functions
---

# Firebase Hosting Deployment with Next.js (Full SSR Support)

This workflow deploys CampusConnect to Firebase Hosting using Firebase Frameworks, which provides full Next.js support including API routes, dynamic pages, and server-side rendering.

## ✅ What Works

- ✅ All Next.js features (SSR, ISR, API routes)
- ✅ Dynamic routes (`/admin/campuses/[id]`)
- ✅ API routes (`/api/expand-map-url`, `/api/suggest`)
- ✅ Image optimization
- ✅ Middleware
- ✅ Everything in your app!

## Prerequisites

1. **Firebase CLI** (already installed)
   ```bash
   firebase --version  # Should be 13.0.0 or higher
   ```

2. **Firebase Project** (already set up)
   - Project ID: `campus-vibes-e34f0`
   - Blaze (pay-as-you-go) plan required for Cloud Functions

3. **Node.js 18+**
   ```bash
   node --version
   ```

## One-Time Setup

### 1. Verify Firebase Plan

Firebase Frameworks requires the **Blaze (pay-as-you-go) plan** because it uses Cloud Functions.

Check your plan:
```bash
firebase projects:list
```

If you're on the Spark (free) plan, upgrade:
1. Go to https://console.firebase.google.com/project/campus-vibes-e34f0/overview
2. Click "Upgrade" in the bottom left
3. Select "Blaze" plan
4. **Don't worry**: You still get free tier limits, only pay for usage beyond that

### 2. Initialize Firebase Frameworks (Already Done)

The `firebase.json` is already configured with:
```json
{
  "hosting": {
    "source": "Site"
  }
}
```

This tells Firebase to use the Next.js app in the `Site/` directory.

## Deployment

### Quick Deploy

From the project root:

```bash
firebase deploy --only hosting
```

That's it! Firebase will:
1. Detect your Next.js app
2. Build it automatically
3. Deploy to Cloud Functions
4. Set up hosting
5. Give you a live URL

### First Deployment

The first deployment takes ~5-10 minutes because it:
- Installs dependencies
- Builds the Next.js app
- Creates Cloud Functions
- Sets up hosting

Subsequent deployments are faster (~2-3 minutes).

### Deploy Specific Components

```bash
# Deploy only hosting
firebase deploy --only hosting

# Deploy only functions
firebase deploy --only functions

# Deploy everything
firebase deploy
```

## Environment Variables

### Add Environment Variables

Firebase Frameworks automatically uses your `.env.local` file, but for production:

1. Go to Firebase Console → Functions
2. Click "Environment variables"
3. Add your variables:
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
   - Any other `NEXT_PUBLIC_*` variables

Or use the CLI:
```bash
firebase functions:config:set google.maps_key="YOUR_API_KEY"
```

## Viewing Your Site

After deployment:

- **Live URL**: https://campus-vibes-e34f0.web.app
- **Custom domain**: Configure in Firebase Console → Hosting

## Local Testing

Test the Firebase Frameworks setup locally:

```bash
# Install dependencies
cd Site
npm install

# Run Firebase emulators
cd ..
firebase emulators:start
```

This runs your Next.js app exactly as it will run on Firebase.

## Monitoring & Logs

### View Deployment Logs

```bash
firebase functions:log
```

### Firebase Console

- **Hosting**: https://console.firebase.google.com/project/campus-vibes-e34f0/hosting
- **Functions**: https://console.firebase.google.com/project/campus-vibes-e34f0/functions
- **Analytics**: Built-in performance monitoring

## Cost Optimization

### Free Tier Limits (Monthly)

**Hosting:**
- 10 GB storage
- 360 MB/day bandwidth (~10 GB/month)

**Cloud Functions:**
- 2M invocations
- 400,000 GB-seconds compute time
- 200,000 CPU-seconds

**Typical Usage:**
- 10k users: Well within free tier
- 100k users: ~$150-200/month
- 1M users: ~$2,000-2,500/month

### Optimization Tips

1. **Enable Caching**
   - Firebase automatically caches static assets
   - Configure cache headers in `firebase.json` if needed

2. **Use CDN**
   - Firebase Hosting uses global CDN automatically
   - No additional configuration needed

3. **Optimize Images**
   - Next.js Image component works with Firebase
   - Automatic optimization and caching

## Troubleshooting

### Build Fails

**Error**: "Could not find Next.js app"
**Fix**: Make sure `firebase.json` has `"source": "Site"`

**Error**: "Functions deployment failed"
**Fix**: Ensure you're on Blaze plan

### Slow Deployments

First deployment is always slow. Subsequent deployments are faster.

To speed up:
```bash
# Skip functions if you only changed frontend
firebase deploy --only hosting:site
```

### 404 Errors

If you get 404s after deployment:
1. Check Firebase Console → Hosting
2. Verify deployment completed
3. Clear browser cache
4. Check function logs: `firebase functions:log`

### API Routes Not Working

**Check**:
1. Are you on Blaze plan?
2. Did deployment complete successfully?
3. Check function logs for errors

## Comparison: Firebase vs GitHub Pages

| Feature | Firebase Frameworks | GitHub Pages |
|---------|-------------------|--------------|
| **API Routes** | ✅ Yes | ❌ No |
| **Dynamic Routes** | ✅ Yes | ❌ No |
| **SSR** | ✅ Yes | ❌ No |
| **Cost (100k users)** | ~$200/mo | Free (but limited) |
| **Setup Complexity** | Medium | Easy |
| **All Features Work** | ✅ Yes | ❌ No |

## CI/CD with GitHub Actions

Want automatic deployments? Create `.github/workflows/firebase-deploy.yml`:

```yaml
name: Deploy to Firebase

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install -g firebase-tools
      - run: firebase deploy --only hosting --token ${{ secrets.FIREBASE_TOKEN }}
```

Get token: `firebase login:ci`

## Next Steps

1. **Deploy now**: `firebase deploy --only hosting`
2. **Test your site**: Visit the URL Firebase provides
3. **Set up custom domain** (optional): Firebase Console → Hosting
4. **Monitor costs**: Firebase Console → Usage

## Support

- **Firebase Docs**: https://firebase.google.com/docs/hosting/frameworks/nextjs
- **Next.js Docs**: https://nextjs.org/docs
- **Firebase Support**: https://firebase.google.com/support

---

**Ready to deploy?** Run:
```bash
firebase deploy --only hosting
```

Your site will be live in ~5-10 minutes! 🚀
