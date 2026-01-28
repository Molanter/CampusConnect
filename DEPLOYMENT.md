# GitHub Pages Deployment

This directory contains the configuration for deploying CampusConnect to GitHub Pages.

## Quick Start

1. **Run the setup script**:
   ```bash
   ./setup-github-pages.sh
   ```

2. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Setup GitHub Pages deployment"
   git push origin main
   ```

3. **Enable GitHub Pages**:
   - Go to your repository on GitHub
   - Navigate to **Settings** → **Pages**
   - Under "Build and deployment", select **GitHub Actions**
   - Click **Save**

4. **Wait for deployment** (1-2 minutes)
   - Check the **Actions** tab for deployment status
   - Your site will be live at `https://username.github.io/repo-name`

## Files

- `.github/workflows/deploy.yml` - GitHub Actions workflow for automatic deployment
- `Site/public/404.html` - Handles client-side routing on GitHub Pages
- `Site/next.config.ts` - Configured for static export with `output: 'export'`
- `setup-github-pages.sh` - Setup helper script

## Important Notes

### API Routes
GitHub Pages only serves static files. Your API routes (`/api/expand-map-url`, `/api/suggest`) will **not work**. Consider:
- Moving them to Firebase Functions
- Using a separate backend service
- Implementing client-side alternatives

### Environment Variables
- Only `NEXT_PUBLIC_*` variables work in static builds
- Add them as **Repository Secrets** in GitHub Settings → Secrets and variables → Actions

### basePath Configuration
If deploying to `username.github.io/repo-name`:
1. Edit `Site/next.config.ts`
2. Uncomment: `basePath: '/CampusConnect'` (replace with your repo name)

If deploying to a custom domain or `username.github.io` (root), leave it commented out.

## Troubleshooting

See the full deployment guide: `.agent/workflows/deploy-hosting.md`

## Manual Deployment

Trigger manually from the **Actions** tab → **Deploy to GitHub Pages** → **Run workflow**
