# Deploying RSSHub to Vercel

There are two primary methods to deploy your RSSHub project to Vercel:

---

## Method 1: Automatic Git Deployments (Recommended)

Vercel's GitHub integration automatically triggers a deployment whenever you push commits to your repository.

1. **Production Deployments**:
    - Every push to the `production` branch will trigger a production deployment.
    - Command:
        ```bash
        git push origin production
        ```
2. **Preview Deployments**:
    - Pushing to other branches (like `master`) will trigger preview deployments.

---

## Method 2: Manual Deployment via Vercel CLI

If you want to deploy directly from your local terminal without pushing to GitHub first, you can use the Vercel CLI.

### 1. Installation

Ensure you have the Vercel CLI installed globally:

```bash
npm install -g vercel
# or
pnpm add -g vercel
```

### 2. Login & Link (First Time Only)

Log in to your Vercel account and link this project folder:

```bash
vercel login
vercel link
```

### 3. Deploy to Preview

Run this command to build and upload a preview deployment:

```bash
vercel
```

### 4. Deploy to Production

To push a build directly to your live production environment:

```bash
vercel --prod
```
