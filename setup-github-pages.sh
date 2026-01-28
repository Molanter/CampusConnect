#!/bin/bash

# GitHub Pages Deployment Setup Script for CampusConnect

echo "🚀 Setting up GitHub Pages deployment for CampusConnect..."
echo ""

# Check if git repository exists
if [ ! -d ".git" ]; then
    echo "❌ Error: Not a git repository. Please initialize git first:"
    echo "   git init"
    echo "   git add ."
    echo "   git commit -m 'Initial commit'"
    exit 1
fi

# Check if remote exists
if ! git remote get-url origin > /dev/null 2>&1; then
    echo "⚠️  No git remote found. Please add your GitHub repository:"
    echo "   git remote add origin https://github.com/USERNAME/REPO.git"
    echo ""
    read -p "Enter your GitHub repository URL: " repo_url
    git remote add origin "$repo_url"
    echo "✅ Remote added"
fi

echo ""
echo "📋 Setup Checklist:"
echo ""
echo "1. ✅ GitHub Actions workflow created (.github/workflows/deploy.yml)"
echo "2. ✅ Next.js configured for static export (Site/next.config.ts)"
echo "3. ✅ 404.html created for client-side routing"
echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Push your code to GitHub:"
echo "   git add ."
echo "   git commit -m 'Add GitHub Pages deployment'"
echo "   git push -u origin main"
echo ""
echo "2. Enable GitHub Pages in your repository:"
echo "   • Go to Settings → Pages"
echo "   • Set Source to 'GitHub Actions'"
echo "   • Save"
echo ""
echo "3. (Optional) Add environment secrets:"
echo "   • Go to Settings → Secrets and variables → Actions"
echo "   • Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"
echo ""
echo "4. Your site will be available at:"
echo "   https://USERNAME.github.io/REPO-NAME"
echo ""
echo "✨ Setup complete! Push to main branch to trigger deployment."
