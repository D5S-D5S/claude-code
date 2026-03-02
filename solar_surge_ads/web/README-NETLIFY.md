# Solar Surge Dashboard — Netlify Deploy Guide

## Deploy in 4 steps

### 1. Push this repo to GitHub (already done)

### 2. Connect to Netlify
- Go to https://app.netlify.com → "Add new site" → "Import an existing project"
- Choose your GitHub repo
- Set **Base directory**: `solar_surge_ads/web`
- Set **Publish directory**: `public`
- Set **Functions directory**: `netlify/functions`

### 3. Add environment variables in Netlify
Site Settings → Environment Variables → Add:

| Key | Value |
|-----|-------|
| `FACEBOOK_ACCESS_TOKEN` | Your FB access token |
| `AD_ACCOUNT_ID` | `act_601150485509219` |
| `PAGE_ID` | `103574711752837` |

### 4. Deploy
Click "Deploy site". Done. Your dashboard is live.

---

## Features

| Feature | Description |
|---------|-------------|
| **Client tabs** | SGS (Scotland) and HES (South Wales) switch instantly |
| **Metric cards** | Total spend, leads, blended CPL, scale/watch/kill counts |
| **Recommendation** | Plain-English action banner updated per client |
| **Ad cards** | SCALE/WATCH/KILL badge, impressions bar, CTR, leads, CPL, spend |
| **Full copy view** | Expandable hook/body/CTA per ad |
| **Enable/Pause** | Toggle any ad live from the dashboard |
| **7-day chart** | Daily impressions + leads + spend per ad |
| **Leads table** | All leads with name, phone, email, home ownership |
| **Search leads** | Filter leads by any field |
| **Export CSV** | Download all leads as a .csv |
| **Date range** | Switch between 3 / 7 / 14 / 30 day views |

---

## Local development

Install Netlify CLI:
```bash
npm install -g netlify-cli
```

Run locally (from `solar_surge_ads/web/`):
```bash
# Create .env file with your credentials
cp ../../.env .env

netlify dev
# → http://localhost:8888
```

---

## Security note
The Facebook access token lives only in Netlify's server-side environment variables.
It is **never exposed to the browser** — all Facebook API calls go through the
Netlify Functions (server-side Node.js).
