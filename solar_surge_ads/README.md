# Solar Surge — Facebook Lead Gen System

Bottom-of-funnel Facebook ad campaign for UK solar lead generation.
£10/day · 5 ads · LEAD_GENERATION objective · All assets start PAUSED.

---

## Setup

```bash
cd solar_surge_ads
pip install -r requirements.txt
```

Add your privacy policy URL to `.env`:
```
PRIVACY_POLICY_URL=https://yourdomain.com/privacy
```

---

## Run Order

### Step 1 — Test API connection (read-only)
```bash
python launcher.py test
```

### Step 2 — Review the 5 ad copy variations
```bash
python launcher.py show-copy
```

### Step 3 — Review the lead form structure
```bash
python launcher.py show-form
```

### Step 4 — Create the lead form (requires PRIVACY_POLICY_URL)
```bash
python launcher.py create-form
```

### Step 5 — Build campaign + ad set + 5 ads (all PAUSED)
```bash
python launcher.py create-campaign
```

### Step 6 — Review full summary before going live
```bash
python launcher.py summary
```

---

## Analyzer (CLI)

After ads have run and gathered impressions:

```bash
# Full analysis
python analyzer.py

# Single ad
python analyzer.py --ad SS_BF_HomeValue

# JSON output (for integrations)
python analyzer.py --json
```

**Decision thresholds:**
| Label | Condition |
|-------|-----------|
| ✅ SCALE | CPL < £8 AND CTR > 1.5% |
| ⚠️ WATCH | CPL £8–£15 or CTR 1–1.5% |
| ❌ KILL | CPL > £15 OR CTR < 1% OR 500 imp + 0 leads |

Minimum 500 impressions before a verdict is issued.

---

## Dashboard (Web UI)

```bash
python dashboard/app.py
```

Open **http://localhost:5000** in your browser.

Features:
- Live metrics per ad (impressions, CTR, leads, CPL, spend)
- SCALE / WATCH / KILL badges with colour coding
- 7-day history chart per ad (click "View 7-day history")
- Plain-English recommendation banner
- Adjustable time range (3 / 7 / 14 / 30 days)

---

## Project Structure

```
solar_surge_ads/
├── .env                     # Credentials — never commit
├── .gitignore
├── requirements.txt
├── copy_bank.json           # 5 ad copy variations
├── lead_form.json           # Form structure + ID after creation
├── launcher.py              # Creates all Facebook assets
├── launched_ads.json        # All created asset IDs
├── analyzer.py              # CLI performance analysis
├── dashboard/
│   ├── app.py               # Flask web server
│   └── templates/
│       └── index.html       # Dashboard UI
└── README.md
```

---

## Safety Rules

- **NEVER** publish anything without typing CONFIRM
- **NEVER** set any ad/campaign to ACTIVE — everything starts PAUSED
- Always run `python launcher.py test` first
- `.env` is gitignored — credentials never leave your machine
- Every created asset ID is logged to `launched_ads.json` immediately
