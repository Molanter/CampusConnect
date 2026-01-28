---
description: Deploy the Next.js app to GitHub Pages
---

# GitHub Pages Deployment Workflow

This workflow deploys the CampusConnect Next.js application to GitHub Pages using static export.

## Prerequisites

1. **GitHub Repository**
   - Your code must be in a GitHub repository
   - You need write access to the repository

2. **GitHub Pages Enabled**
   - Go to your repository Settings → Pages
   - Under "Build and deployment", select "GitHub Actions" as the source

## One-Time Setup

### 1. Enable GitHub Pages

1. Go to your GitHub repository
2. Click **Settings** → **Pages**
3. Under "Build and deployment":
   - **Source**: Select "GitHub Actions"
4. Click **Save**

### 2. Add Environment Variables (if needed)

If your app uses environment variables (like Google Maps API key):

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add secrets like:
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
   - Any other `NEXT_PUBLIC_*` variables

### 3. Configure basePath (if using username.github.io/repo-name)

If deploying to `https://username.github.io/CampusConnect`:

1. Edit `Site/next.config.ts`
2. Uncomment the `basePath` line:
   ```typescript
   basePath: '/CampusConnect',
   ```

**Note**: If deploying to a custom domain or `username.github.io` (root), leave `basePath` commented out.

## Deployment

### Automatic Deployment

Every time you push to the `main` branch, GitHub Actions will automatically:
1. Build your Next.js app
2. Export it as static files
3. Deploy to GitHub Pages

```bash
git add .
git commit -m "Deploy to GitHub Pages"
git push origin main
```

### Manual Deployment

You can also trigger deployment manually:

1. Go to your repository on GitHub
2. Click **Actions** tab
3. Select "Deploy to GitHub Pages" workflow
4. Click **Run workflow** → **Run workflow**

## Viewing Your Site

After deployment completes (usually 1-2 minutes):

- **Repository Pages**: `https://username.github.io/CampusConnect`
- **Custom Domain**: Configure in Settings → Pages → Custom domain

## Local Testing

Before deploying, test the static export locally:

```bash
cd Site
npm run build
npx serve out
```

Visit `http://localhost:3000` to preview.

## Important Notes

### API Routes Not Supported

GitHub Pages only serves static files. The following API routes will NOT work:
- `/api/expand-map-url`
- `/api/suggest`

**Solutions**:
1. **Move to Firebase Functions**: Keep these as serverless functions
2. **Use External API**: Call a separate backend service
3. **Client-side only**: Remove server-side API dependencies

### Environment Variables

- Only `NEXT_PUBLIC_*` variables work in static export
- Server-side environment variables won't be available
- Add secrets in GitHub repository settings

### Image Optimization

- Next.js Image optimization is disabled (`unoptimized: true`)
- Images are served as-is without automatic optimization
- Consider optimizing images before adding them to the project

## Troubleshooting

### Blank Page After Deployment

**Cause**: Incorrect `basePath` configuration

**Fix**: 
- If deploying to `username.github.io/repo-name`, set `basePath: '/repo-name'`
- If deploying to root domain, remove or comment out `basePath`

### 404 on Page Refresh

**Cause**: GitHub Pages doesn't support client-side routing by default

**Fix**: The `.nojekyll` file is automatically added by the workflow. If issues persist, add a `404.html` that redirects to `index.html`.

### Build Fails

**Cause**: TypeScript errors or missing dependencies

**Fix**:
1. Run `npm run build` locally to see errors
2. Fix TypeScript errors
3. Ensure all dependencies are in `package.json`

### Assets Not Loading

**Cause**: Incorrect asset paths

**Fix**: Ensure `basePath` matches your deployment URL structure

## Workflow File Location

`.github/workflows/deploy.yml`

## Monitoring Deployments

1. Go to **Actions** tab in your repository
2. Click on the latest workflow run
3. View build logs and deployment status

## Custom Domain Setup

1. Go to **Settings** → **Pages**
2. Enter your custom domain
3. Add DNS records as instructed by GitHub
4. Wait for DNS propagation (can take up to 24 hours)
