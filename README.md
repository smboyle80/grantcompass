# GrantCompass

AI-powered grant discovery and writing assistant for nonprofits. Powered by Anthropic Claude + Tinyfish web agent.

## Deploying to Vercel (free)

### 1. Push to GitHub
1. Create a new repo at github.com
2. Upload or push all files in this folder to the repo root

### 2. Deploy on Vercel
1. Go to [vercel.com](https://vercel.com) and sign up with your GitHub account
2. Click **Add New Project** → import your GitHub repo
3. Leave all build settings as default — Vercel auto-detects everything
4. Click **Deploy**

### 3. Add environment variables
In your Vercel project dashboard: **Settings** → **Environment Variables** → add:

| Key | Value |
|-----|-------|
| `ANTHROPIC_API_KEY` | your Anthropic key (`sk-ant-...`) |
| `TINYFISH_API_KEY` | your Tinyfish API key |

Then go to **Deployments** → click the three dots on the latest deploy → **Redeploy**.

## File structure

```
grantcompass/
├── index.html          # Main app
├── vercel.json         # Vercel config (30s function timeout)
├── README.md
└── api/
    ├── claude.js           # Proxies Anthropic API calls
    ├── get-tinyfish-key.js # Vends Tinyfish key to browser
    └── scan-status.js      # Polls Tinyfish run status
```

## How the website scanner works
1. Browser fetches Tinyfish key from `/api/get-tinyfish-key`
2. Browser opens SSE stream directly to Tinyfish (no server timeout)
3. Once run_id arrives, browser polls `/api/scan-status` every 4s
4. On completion, result is sent to Claude for grant matching
