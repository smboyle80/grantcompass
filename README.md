# GrantCompass

AI-powered grant discovery and writing assistant for nonprofits. Powered by Anthropic Claude + Tinyfish web agent.

## Features

- **Find grants** — match grants to your org's mission, focus area, budget, and geography
- **Scan website** *(Tinyfish-powered)* — a real browser agent navigates your website, reads About/Programs/Impact pages, and surfaces grants tailored to what it actually finds
- **Review writing** — upload a PDF or paste a draft proposal for scored feedback
- **Checklist builder** — generate a prioritized pre-submission checklist for any grant
- **Saved grants** — bookmark grants across sessions

---

## Deploying to Netlify

### 1. Get your API keys

**Anthropic API key**
- Sign up at [console.anthropic.com](https://console.anthropic.com)
- Create an API key (starts with `sk-ant-...`)

**Tinyfish API key**
- Log in to your Tinyfish account and copy your API key

### 2. Deploy to Netlify
1. Go to [netlify.com](https://netlify.com) → **Add new site** → **Deploy manually**
2. Drag and drop this entire `grantcompass` folder into the deploy window
3. Netlify detects `netlify.toml` and configures automatically

### 3. Add environment variables
In your Netlify dashboard: **Site settings** → **Environment variables** → add both:

| Key | Value |
|-----|-------|
| `ANTHROPIC_API_KEY` | your Anthropic key (`sk-ant-...`) |
| `TINYFISH_API_KEY` | your Tinyfish API key |

Then go to **Deploys** → **Trigger deploy**.

---

## File structure

```
grantcompass/
├── index.html                        # Main app
├── netlify.toml                      # Netlify config
├── README.md
└── netlify/
    └── functions/
        ├── claude.js                 # Proxies Claude API (hides Anthropic key)
        ├── scan-start.js             # Starts a Tinyfish website scan
        └── scan-status.js            # Polls Tinyfish for scan completion
```

## How it works

- **Grant discovery, writing review, checklist**: all routed through `claude.js` → Anthropic API
- **Website scanning**: `scan-start.js` launches a Tinyfish browser agent on the nonprofit's URL; `scan-status.js` polls until done; the extracted content is then sent to Claude for grant matching

Both API keys stay server-side and are never exposed to the browser.

---

## Cost estimate

| Service | Cost per use | 50 orgs × 20 uses/mo |
|---------|-------------|----------------------|
| Anthropic API | ~$0.01–0.03 | ~$10–30/mo |
| Tinyfish scans | varies by plan | check your plan limits |
| Netlify functions | free tier: 125k/mo | free |
