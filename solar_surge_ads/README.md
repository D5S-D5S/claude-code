# Solar Surge — Facebook Lead Gen System (Multi-Client)

Bottom-of-funnel Facebook ad campaigns for UK solar lead generation.
£10/day per client · 5 ads each · LEAD_GENERATION objective · All PAUSED.

---

## Clients

| Key | Client | Region | Postcodes | Finance | System |
|-----|--------|--------|-----------|---------|--------|
| `sgs` | Smart Group Scotland | Scotland | AB DD PH FK KY G EH ML | ❌ No | 10kW |
| `hes` | Home Eco Solutions | South Wales | SA CF NP | ✅ Yes | 5kWh |

---

## Setup

```bash
cd solar_surge_ads
pip install -r requirements.txt
```

**Privacy policy:** Create a page at `http://solar.velta-agency.com/privacy-policy`
It's already set in `.env` — but Facebook will reject the form creation if the URL 404s.

---

## Run Order — Per Client

All commands require `--client sgs` or `--client hes`.

```bash
# 1. Test API (no client needed)
python launcher.py test

# 2. See all clients
python launcher.py show-clients

# 3. Review 5 ad copy variations
python launcher.py --client sgs show-copy
python launcher.py --client hes show-copy

# 4. Review lead form structure
python launcher.py --client sgs show-form
python launcher.py --client hes show-form

# 5. Create lead forms
python launcher.py --client sgs create-form
python launcher.py --client hes create-form

# 6. Build campaigns + ad sets + 5 ads (all PAUSED)
python launcher.py --client sgs create-campaign
python launcher.py --client hes create-campaign

# 7. Review full summaries
python launcher.py --client sgs summary
python launcher.py --client hes summary
```

---

## Analyzer (CLI)

```bash
# Both clients at once
python analyzer.py all

# Single client
python analyzer.py --client sgs
python analyzer.py --client hes

# Single ad
python analyzer.py --client sgs --ad SGS_BF_Premium10kW

# JSON output
python analyzer.py --client sgs --json
```

**Decision thresholds (per ad, after 500+ impressions):**

| Label | Condition |
|-------|-----------|
| ✅ SCALE | CPL < £8 AND CTR > 1.5% |
| ⚠️ WATCH | CPL £8–£15 or CTR 1–1.5% |
| ❌ KILL | CPL > £15 OR CTR < 1% OR 500 imp + 0 leads |

---

## Dashboard (Web UI)

```bash
python dashboard/app.py
# → http://localhost:5000
```

Features:
- Client tabs (SGS in blue / HES in purple)
- Live metrics per ad — impressions, CTR, leads, CPL, spend
- SCALE / WATCH / KILL / GATHERING DATA badges
- Plain-English recommendation banner per client
- 7-day Chart.js history chart per ad
- Config strip (postcodes, finance, MCS, installs/month)
- Adjustable time range (3 / 7 / 14 / 30 days)

---

## Project Structure

```
solar_surge_ads/
├── .env                         # Credentials + privacy policy URL
├── .gitignore
├── requirements.txt
├── launcher.py                  # Multi-client campaign builder CLI
├── analyzer.py                  # Multi-client SCALE/WATCH/KILL engine
├── clients/
│   ├── sgs/                     # Smart Group Scotland
│   │   ├── copy_bank.json       # 5 bottom-funnel ad variations
│   │   ├── campaign_config.json # Targeting + campaign settings
│   │   └── launched_ads.json   # Asset IDs (auto-populated)
│   └── hes/                     # Home Eco Solutions
│       ├── copy_bank.json
│       ├── campaign_config.json
│       └── launched_ads.json
├── dashboard/
│   ├── app.py                   # Flask web server
│   └── templates/
│       └── index.html           # Dashboard UI
└── README.md
```

---

## Safety Rules

- Everything starts **PAUSED** — nothing goes live without CONFIRM
- `.env` is gitignored — credentials stay local
- All asset IDs logged to `clients/<client>/launched_ads.json` immediately
- Always run `python launcher.py test` before creating anything
