"""
Solar Surge — Run Now
======================
One script. Runs all steps for both clients.
Uses plain requests — no Facebook SDK needed.

Usage:
    pip install requests python-dotenv
    python run_now.py

What it does (all in order):
  1. Tests API connection
  2. Creates campaign + ad set for SGS (Scotland)
  3. Creates campaign + ad set for HES (South Wales)
  4. Creates lead form for SGS
  5. Creates lead form for HES
  6. Creates 5 ads for SGS
  7. Creates 5 ads for HES
  8. Logs every asset ID to clients/sgs/launched_ads.json + clients/hes/launched_ads.json
  9. Prints full summary

Everything is created PAUSED — nothing spends until you activate in Ads Manager.
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path

import requests
from dotenv import load_dotenv

# ── Load credentials ───────────────────────────────────────────────────────
BASE = Path(__file__).parent
load_dotenv(BASE / ".env")

TOKEN      = os.getenv("FACEBOOK_ACCESS_TOKEN")
ACCOUNT_ID = os.getenv("AD_ACCOUNT_ID")   # e.g. act_601150485509219
PAGE_ID    = os.getenv("PAGE_ID")
PP_URL     = os.getenv("PRIVACY_POLICY_URL", "https://solar.velta-agency.com/privacypolicy")
FB         = "https://graph.facebook.com/v21.0"

TODAY = datetime.utcnow().strftime("%Y-%m-%d")

# ── Helpers ────────────────────────────────────────────────────────────────
def fb_get(path, params=None):
    p = {"access_token": TOKEN, **(params or {})}
    r = requests.get(f"{FB}/{path}", params=p, timeout=20)
    d = r.json()
    if "error" in d:
        raise RuntimeError(f"FB error on GET /{path}: {d['error']['message']}")
    return d

def fb_post(path, data=None, json_body=None):
    p = {"access_token": TOKEN}
    if json_body:
        r = requests.post(f"{FB}/{path}", params=p, json=json_body, timeout=20)
    else:
        r = requests.post(f"{FB}/{path}", params=p, data=data or {}, timeout=20)
    d = r.json()
    if "error" in d:
        raise RuntimeError(f"FB error on POST /{path}: {d['error']['message']}")
    return d

def load_json(path): return json.loads(Path(path).read_text())
def save_json(path, data): Path(path).write_text(json.dumps(data, indent=2))

def update_launched(client, key, value):
    p = BASE / "clients" / client / "launched_ads.json"
    d = load_json(p)
    d["meta"]["last_updated"] = datetime.utcnow().isoformat() + "Z"
    if key in ("campaign", "ad_set", "lead_form"):
        d[key].update(value)
    elif key == "ads":
        d["ads"].append(value)
    save_json(p, d)
    return d

def ok(msg):  print(f"  ✅  {msg}")
def info(msg):print(f"  ℹ️   {msg}")
def err(msg): print(f"  ❌  {msg}"); sys.exit(1)
def head(msg):print(f"\n{'─'*60}\n  {msg}\n{'─'*60}")

# ── Step 1: API test ───────────────────────────────────────────────────────
def test_api():
    head("STEP 1 — Testing API connection")
    d = fb_get(ACCOUNT_ID, {"fields": "name,currency,account_status"})
    ok(f"Connected to: {d.get('name')} ({d.get('currency')})")
    ok(f"Account status: {d.get('account_status')}")

# ── Step 2 & 3: Create campaign + ad set ──────────────────────────────────
def create_campaign_structure(client):
    head(f"Creating campaign structure for [{client.upper()}]")
    cfg = load_json(BASE / "clients" / client / "campaign_config.json")
    launched = load_json(BASE / "clients" / client / "launched_ads.json")

    # --- Campaign ---
    if launched["campaign"].get("id"):
        info(f"Campaign already exists: {launched['campaign']['id']} — skipping")
        return

    camp_name = cfg["campaign"]["name"].replace("{DATE}", TODAY)
    d = fb_post(f"{ACCOUNT_ID}/campaigns", {
        "name": camp_name,
        "objective": "OUTCOME_LEADS",
        "status": "PAUSED",
        "special_ad_categories": "[]",
    })
    camp_id = d["id"]
    ok(f"Campaign created: {camp_id} — {camp_name}")
    update_launched(client, "campaign", {"id": camp_id, "name": camp_name, "status": "PAUSED"})

    # --- Ad set ---
    # Build location targeting based on client
    if client == "sgs":
        geo = {"regions": [{"key": "2346"}]}   # Scotland
    else:
        geo = {"regions": [{"key": "2347"}]}   # Wales

    targeting = json.dumps({
        "geo_locations": {**geo, "location_types": ["home", "recent"]},
        "age_min": 35,
        "age_max": 65,
        "publisher_platforms": ["facebook", "instagram"],
        "facebook_positions": ["feed"],
        "instagram_positions": ["stream"],
        "device_platforms": ["mobile", "desktop"],
        "flexible_spec": [{
            "interests": [
                {"id": "6003139266461"},   # Home improvement
                {"id": "6003263791658"},   # Renewable energy
                {"id": "6003145597495"},   # Energy conservation
                {"id": "6003348530498"},   # Solar energy
            ]
        }]
    })

    adset = fb_post(f"{ACCOUNT_ID}/adsets", {
        "name": cfg["ad_set"]["name"],
        "campaign_id": camp_id,
        "daily_budget": str(cfg["campaign"]["daily_budget_pence"]),
        "billing_event": "IMPRESSIONS",
        "optimization_goal": "LEAD_GENERATION",
        "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
        "status": "PAUSED",
        "targeting": targeting,
        "promoted_object": json.dumps({"page_id": PAGE_ID}),
    })
    adset_id = adset["id"]
    ok(f"Ad set created: {adset_id} — {cfg['ad_set']['name']}")
    update_launched(client, "ad_set", {"id": adset_id, "name": cfg["ad_set"]["name"], "status": "PAUSED"})

# ── Step 4 & 5: Create lead forms ─────────────────────────────────────────
def create_form(client):
    head(f"Creating lead form for [{client.upper()}]")
    cfg = load_json(BASE / "clients" / client / "campaign_config.json")
    launched = load_json(BASE / "clients" / client / "launched_ads.json")
    fc = cfg["lead_form"]

    if launched["lead_form"].get("id"):
        info(f"Form already exists: {launched['lead_form']['id']} — skipping")
        return

    questions = [
        {"type": "FIRST_NAME"},
        {"type": "LAST_NAME"},
        {"type": "PHONE"},
        {"type": "EMAIL"},
        {
            "type": "CUSTOM",
            "label": "Do you own your home?",
            "options": [
                {"value": "own_outright", "key": "Yes, own it outright"},
                {"value": "mortgage",     "key": "Yes, I have a mortgage"},
                {"value": "renting",      "key": "No, I rent"},
            ]
        }
    ]

    payload = {
        "name": fc["name"],
        "form_type": "MORE_VOLUME",
        "locale": "EN_GB",
        "questions": json.dumps(questions),
        "privacy_policy": json.dumps({"url": PP_URL, "link_text": "Privacy Policy"}),
        "intro": json.dumps({
            "headline": fc["intro"]["headline"],
            "description": {"content": fc["intro"]["description"]}
        }),
        "thank_you_body": json.dumps({
            "headline": fc["thank_you"]["headline"],
            "description": fc["thank_you"]["description"],
            "button_type": "VIEW_WEBSITE",
            "button_text": fc["thank_you"]["cta_text"],
            "website_url": f"https://www.facebook.com/{PAGE_ID}"
        }),
        "tracking_parameters": json.dumps([
            {"key": "ad_name",      "value": "{{ad.name}}"},
            {"key": "adset_name",   "value": "{{adset.name}}"},
            {"key": "campaign_name","value": "{{campaign.name}}"},
            {"key": "client",       "value": client},
        ])
    }

    d = fb_post(f"{PAGE_ID}/leadgen_forms", payload)
    form_id = d["id"]
    ok(f"Lead form created: {form_id} — {fc['name']}")
    update_launched(client, "lead_form", {"id": form_id, "name": fc["name"]})

# ── Step 6 & 7: Create 5 ads ───────────────────────────────────────────────
def create_ads(client):
    head(f"Creating 5 ads for [{client.upper()}]")
    launched = load_json(BASE / "clients" / client / "launched_ads.json")
    copy_bank = load_json(BASE / "clients" / client / "copy_bank.json")

    adset_id = launched["ad_set"].get("id")
    form_id  = launched["lead_form"].get("id")

    if not adset_id: err(f"[{client.upper()}] No ad_set_id — run create_campaign_structure first")
    if not form_id:  err(f"[{client.upper()}] No form_id — run create_form first")
    if launched["ads"]: info(f"Ads already exist ({len(launched['ads'])}) — skipping"); return

    for ad_copy in copy_bank["ads"]:
        message = f"{ad_copy['hook']}\n\n{ad_copy['body']}\n\n{ad_copy['cta']}"

        # Creative
        creative_payload = {
            "name": f"Creative — {ad_copy['name_tag']}",
            "object_story_spec": json.dumps({
                "page_id": PAGE_ID,
                "link_data": {
                    "message": message,
                    "call_to_action": {
                        "type": "LEARN_MORE",
                        "value": {"lead_gen_form_id": form_id}
                    }
                }
            })
        }
        creative = fb_post(f"{ACCOUNT_ID}/adcreatives", creative_payload)
        creative_id = creative["id"]

        # Ad
        ad = fb_post(f"{ACCOUNT_ID}/ads", {
            "name": ad_copy["name_tag"],
            "adset_id": adset_id,
            "creative": json.dumps({"creative_id": creative_id}),
            "status": "PAUSED",
        })
        ad_id = ad["id"]
        ok(f"Ad created: {ad_id} — {ad_copy['name_tag']}")
        update_launched(client, "ads", {
            "id":         ad_id,
            "name":       ad_copy["name_tag"],
            "creative_id": creative_id,
            "angle":      ad_copy["angle"],
            "status":     "PAUSED"
        })

# ── Step 8: Summary ────────────────────────────────────────────────────────
def print_summary():
    head("COMPLETE — Asset Summary")
    for client in ["sgs", "hes"]:
        cfg = load_json(BASE / "clients" / client / "campaign_config.json")
        d   = load_json(BASE / "clients" / client / "launched_ads.json")
        print(f"\n  [{client.upper()}] {cfg['client_label']}")
        print(f"    Campaign  : {d['campaign'].get('id') or 'MISSING'}")
        print(f"    Ad Set    : {d['ad_set'].get('id')   or 'MISSING'}")
        print(f"    Form      : {d['lead_form'].get('id') or 'MISSING'}")
        print(f"    Ads       : {len(d['ads'])} / 5")
        for ad in d["ads"]:
            print(f"      • [{ad['status']}] {ad['name']} ({ad['id']})")
    print(f"""
  ⚠️  ALL ASSETS ARE PAUSED.
  To activate: go to Facebook Ads Manager → find campaigns starting with SGS / HES → turn on.
  Or use the Netlify dashboard to enable individual ads.
""")

# ── Main ───────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    if not TOKEN:
        err("FACEBOOK_ACCESS_TOKEN not found in .env")

    try:
        test_api()
        create_campaign_structure("sgs")
        create_campaign_structure("hes")
        create_form("sgs")
        create_form("hes")
        create_ads("sgs")
        create_ads("hes")
        print_summary()
    except RuntimeError as e:
        print(f"\n  ❌  {e}\n")
        sys.exit(1)
