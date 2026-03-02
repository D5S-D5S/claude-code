"""
Solar Surge Facebook Ads Launcher
==================================
Creates campaign, ad set, lead form, and 5 ads — all PAUSED.
Nothing goes live until you type CONFIRM.

Run order:
  1. python launcher.py test          — read-only API connection test
  2. python launcher.py show-copy     — print all 5 ad variations
  3. python launcher.py show-form     — print lead form structure
  4. python launcher.py create-form   — create the lead form (requires PRIVACY_POLICY_URL in .env)
  5. python launcher.py create-campaign — build campaign + ad set + 5 ads (all PAUSED)
  6. python launcher.py summary       — print full summary of created assets
"""

import json
import os
import sys
from datetime import datetime

from dotenv import load_dotenv
from facebook_business.adobjects.adaccount import AdAccount
from facebook_business.adobjects.campaign import Campaign
from facebook_business.adobjects.adset import AdSet
from facebook_business.adobjects.ad import Ad
from facebook_business.adobjects.adcreative import AdCreative
from facebook_business.adobjects.leadgenform import LeadgenForm
from facebook_business.api import FacebookAdsApi

# ── Load credentials ──────────────────────────────────────────────────────────
load_dotenv()

ACCESS_TOKEN = os.getenv("FACEBOOK_ACCESS_TOKEN")
AD_ACCOUNT_ID = os.getenv("AD_ACCOUNT_ID")
PAGE_ID = os.getenv("PAGE_ID")
PRIVACY_POLICY_URL = os.getenv("PRIVACY_POLICY_URL", "")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
COPY_BANK_PATH = os.path.join(BASE_DIR, "copy_bank.json")
LEAD_FORM_PATH = os.path.join(BASE_DIR, "lead_form.json")
LAUNCHED_ADS_PATH = os.path.join(BASE_DIR, "launched_ads.json")


# ── Helpers ───────────────────────────────────────────────────────────────────

def init_api():
    """Initialise Facebook Ads API."""
    FacebookAdsApi.init(access_token=ACCESS_TOKEN)
    return AdAccount(AD_ACCOUNT_ID)


def load_json(path):
    with open(path, "r") as f:
        return json.load(f)


def save_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"  ✓ Saved → {path}")


def update_launched(key, value):
    """Safely update launched_ads.json."""
    data = load_json(LAUNCHED_ADS_PATH)
    data["meta"]["last_updated"] = datetime.utcnow().isoformat() + "Z"
    if key in ("campaign", "ad_set", "lead_form"):
        data[key].update(value)
    elif key == "ads":
        data["ads"].append(value)
    save_json(LAUNCHED_ADS_PATH, data)


# ── Commands ──────────────────────────────────────────────────────────────────

def cmd_test():
    """Read-only API connection test."""
    print("\n🔍 Testing API connection (read-only)…")
    try:
        account = init_api()
        info = account.api_get(fields=["name", "currency", "account_status"])
        print(f"  ✅ Connected to ad account: {info.get('name')}")
        print(f"     Currency : {info.get('currency')}")
        status_map = {1: "ACTIVE", 2: "DISABLED", 3: "UNSETTLED", 7: "PENDING_RISK_REVIEW",
                      8: "PENDING_SETTLEMENT", 9: "IN_GRACE_PERIOD", 100: "PENDING_CLOSURE",
                      101: "CLOSED", 201: "ANY_ACTIVE", 202: "ANY_CLOSED"}
        status_code = info.get("account_status")
        print(f"     Status   : {status_map.get(status_code, status_code)}")

        campaigns = account.get_campaigns(fields=["name", "status"], params={"limit": 5})
        print(f"\n  📋 Last {len(campaigns)} campaign(s) on account:")
        for c in campaigns:
            print(f"     • [{c['status']}] {c['name']} (id: {c['id']})")
        print("\n  ✅ API test passed. Ready to build.\n")
    except Exception as e:
        print(f"\n  ❌ API test failed: {e}\n")
        sys.exit(1)


def cmd_show_copy():
    """Pretty-print all 5 ad copy variations."""
    copy_bank = load_json(COPY_BANK_PATH)
    print(f"\n{'='*60}")
    print("  SOLAR SURGE — 5 AD COPY VARIATIONS (Bottom of Funnel)")
    print(f"{'='*60}")
    for i, ad in enumerate(copy_bank["ads"], 1):
        print(f"\n{'─'*60}")
        print(f"  AD {i} — {ad['name_tag']}")
        print(f"  Angle: {ad['angle']}")
        print(f"{'─'*60}")
        print(f"\n  HOOK:\n  {ad['hook']}")
        print(f"\n  BODY:\n  {ad['body']}")
        print(f"\n  CTA:\n  {ad['cta']}")
    print(f"\n{'='*60}\n")


def cmd_show_form():
    """Pretty-print the lead form structure."""
    form = load_json(LEAD_FORM_PATH)
    cfg = form["form_config"]
    print(f"\n{'='*60}")
    print("  SOLAR SURGE — LEAD FORM STRUCTURE")
    print(f"{'='*60}")
    print(f"\n  Form Type   : {cfg['form_type']} (high volume, low friction)")
    print(f"  Locale      : {cfg['locale']}")
    print(f"\n  ── INTRO ──")
    print(f"  Headline    : {cfg['intro']['headline']}")
    print(f"  Description : {cfg['intro']['description']}")
    print(f"\n  ── PRE-FILLED FIELDS (from Facebook profile) ──")
    for field in cfg["prefilled_fields"]:
        print(f"  • {field['label']}")
    print(f"\n  ── CUSTOM QUESTION ──")
    q = cfg["custom_questions"][0]
    print(f"  Q: {q['label']}")
    for opt in q["options"]:
        print(f"     ○ {opt}")
    print(f"\n  ── THANK YOU SCREEN ──")
    ty = cfg["thank_you_screen"]
    print(f"  Headline    : {ty['headline']}")
    print(f"  Description : {ty['description']}")
    print(f"  CTA Button  : {ty['cta_button_text']}")
    pp = cfg["privacy_policy"]["url"]
    pp_status = "⚠️  NOT SET — add PRIVACY_POLICY_URL to .env" if "PLACEHOLDER" in pp else f"✅  {pp}"
    print(f"\n  Privacy URL : {pp_status}")
    print(f"\n{'='*60}\n")


def cmd_create_form():
    """Create the Facebook Instant Form."""
    if not PRIVACY_POLICY_URL:
        print("\n  ❌ PRIVACY_POLICY_URL is not set in .env. Add it before creating the form.\n")
        sys.exit(1)

    print("\n📋 Creating Facebook Instant Form…")
    form_config = load_json(LEAD_FORM_PATH)["form_config"]
    account = init_api()

    # Build questions list for API
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
                {"value": "mortgage", "key": "Yes, I have a mortgage"},
                {"value": "renting", "key": "No, I rent"},
            ]
        }
    ]

    params = {
        "name": form_config["name"],
        "form_type": form_config["form_type"],
        "locale": form_config["locale"],
        "questions": questions,
        "privacy_policy": {
            "url": PRIVACY_POLICY_URL,
            "link_text": "Privacy Policy"
        },
        "intro": {
            "headline": form_config["intro"]["headline"],
            "description": {"content": form_config["intro"]["description"]}
        },
        "thank_you_body": {
            "headline": form_config["thank_you_screen"]["headline"],
            "description": form_config["thank_you_screen"]["description"],
            "button_type": "VIEW_WEBSITE",
            "button_text": form_config["thank_you_screen"]["cta_button_text"],
            "website_url": f"https://www.facebook.com/{PAGE_ID}"
        },
        "tracking_parameters": form_config["tracking_parameters"]
    }

    # Create form on the Page (not ad account)
    from facebook_business.adobjects.page import Page
    page = Page(PAGE_ID)
    form = page.create_leadgen_form(params=params)
    form_id = form["id"]
    print(f"  ✅ Lead form created: {form_id}")

    # Update lead_form.json with the real ID
    form_data = load_json(LEAD_FORM_PATH)
    form_data["form_id"] = form_id
    form_data["meta"]["status"] = "CREATED"
    save_json(LEAD_FORM_PATH, form_data)

    # Update launched_ads.json
    update_launched("lead_form", {"id": form_id, "name": form_config["name"]})
    print(f"\n  Form ID logged to launched_ads.json\n")


def cmd_create_campaign():
    """Build campaign, ad set, and 5 ads — ALL PAUSED."""
    # Check form exists
    form_data = load_json(LEAD_FORM_PATH)
    form_id = form_data.get("form_id")
    if not form_id:
        print("\n  ❌ No form_id found. Run: python launcher.py create-form first.\n")
        sys.exit(1)

    copy_bank = load_json(COPY_BANK_PATH)
    account = init_api()
    today = datetime.utcnow().strftime("%Y-%m-%d")

    # ── 1. Campaign ────────────────────────────────────────────────────────────
    print("\n🚀 Creating CAMPAIGN (PAUSED)…")
    campaign_name = f"Solar Surge — Lead Gen — Bottom Funnel — {today}"
    campaign = account.create_campaign(params={
        "name": campaign_name,
        "objective": "LEAD_GENERATION",
        "status": "PAUSED",
        "special_ad_categories": [],
        "budget_rebalance_flag": True,
    })
    campaign_id = campaign["id"]
    print(f"  ✅ Campaign created: {campaign_id} — {campaign_name}")
    update_launched("campaign", {"id": campaign_id, "name": campaign_name, "status": "PAUSED"})

    # ── 2. Ad Set ──────────────────────────────────────────────────────────────
    print("\n📦 Creating AD SET (PAUSED)…")
    adset_name = "UK Homeowners — Broad — 35-65+"

    # Targeting spec
    targeting = {
        "geo_locations": {"countries": ["GB"]},
        "age_min": 35,
        "age_max": 65,
        "publisher_platforms": ["facebook", "instagram"],
        "facebook_positions": ["feed"],
        "instagram_positions": ["stream"],
        "device_platforms": ["mobile", "desktop"],
        "flexible_spec": [
            {
                "interests": [
                    {"id": "6003139266461", "name": "Home improvement"},
                    {"id": "6003263791658", "name": "Renewable energy"},
                    {"id": "6003145597495", "name": "Energy conservation"},
                    {"id": "6003348530498", "name": "Solar energy"},
                ]
            }
        ],
        "demographics": [
            {"id": "6012238760132", "name": "Homeowners"}
        ]
    }

    ad_set = account.create_ad_set(params={
        "name": adset_name,
        "campaign_id": campaign_id,
        "daily_budget": 1000,           # £10.00 in pence
        "billing_event": "IMPRESSIONS",
        "optimization_goal": "LEAD_GENERATION",
        "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
        "status": "PAUSED",
        "targeting": targeting,
        "promoted_object": {
            "page_id": PAGE_ID,
            "offer_id": None            # removed once form attached at ad level
        },
    })
    adset_id = ad_set["id"]
    print(f"  ✅ Ad set created: {adset_id} — {adset_name}")
    update_launched("ad_set", {"id": adset_id, "name": adset_name, "status": "PAUSED"})

    # ── 3. Ads (5 total) ───────────────────────────────────────────────────────
    print("\n🎨 Creating 5 ADS (all PAUSED)…")
    for ad_copy in copy_bank["ads"]:
        ad_name = ad_copy["name_tag"]
        message = f"{ad_copy['hook']}\n\n{ad_copy['body']}\n\n{ad_copy['cta']}"

        # Creative — text-only, use page profile image
        creative = account.create_ad_creative(params={
            "name": f"Creative — {ad_name}",
            "object_story_spec": {
                "page_id": PAGE_ID,
                "link_data": {
                    "message": message,
                    "call_to_action": {
                        "type": "LEARN_MORE",
                        "value": {"lead_gen_form_id": form_id}
                    }
                }
            }
        })
        creative_id = creative["id"]

        # Ad
        ad = account.create_ad(params={
            "name": ad_name,
            "adset_id": adset_id,
            "creative": {"creative_id": creative_id},
            "status": "PAUSED",
        })
        ad_id = ad["id"]
        print(f"  ✅ Ad created: {ad_id} — {ad_name}")
        update_launched("ads", {
            "id": ad_id,
            "name": ad_name,
            "creative_id": creative_id,
            "angle": ad_copy["angle"],
            "status": "PAUSED"
        })

    print("\n  ✅ All assets created and logged. Nothing is live.")
    print("  Run: python launcher.py summary  — to review everything.\n")


def cmd_summary():
    """Print a full summary of all created assets."""
    data = load_json(LAUNCHED_ADS_PATH)
    print(f"\n{'='*60}")
    print("  SOLAR SURGE — ASSET SUMMARY")
    print(f"{'='*60}")
    print(f"\n  Last updated : {data['meta'].get('last_updated', 'N/A')}")
    print(f"\n  CAMPAIGN")
    c = data["campaign"]
    print(f"    ID     : {c.get('id', 'NOT CREATED')}")
    print(f"    Name   : {c.get('name', '—')}")
    print(f"    Status : {c.get('status', '—')}")
    print(f"\n  AD SET")
    s = data["ad_set"]
    print(f"    ID     : {s.get('id', 'NOT CREATED')}")
    print(f"    Name   : {s.get('name', '—')}")
    print(f"    Status : {s.get('status', '—')}")
    print(f"\n  LEAD FORM")
    lf = data["lead_form"]
    print(f"    ID     : {lf.get('id', 'NOT CREATED')}")
    print(f"    Name   : {lf.get('name', '—')}")
    print(f"\n  ADS ({len(data['ads'])} total)")
    for ad in data["ads"]:
        print(f"    • [{ad.get('status')}] {ad['name']} (id: {ad['id']})")
    print(f"\n{'─'*60}")
    print("  ⚠️  ALL ASSETS ARE PAUSED. Nothing is live.")
    print("  Type CONFIRM to activate (separate activation script required).")
    print(f"{'='*60}\n")


# ── Entry point ───────────────────────────────────────────────────────────────

COMMANDS = {
    "test": cmd_test,
    "show-copy": cmd_show_copy,
    "show-form": cmd_show_form,
    "create-form": cmd_create_form,
    "create-campaign": cmd_create_campaign,
    "summary": cmd_summary,
}

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        print(f"\nUsage: python launcher.py <command>")
        print(f"Commands: {', '.join(COMMANDS.keys())}\n")
        sys.exit(1)
    COMMANDS[sys.argv[1]]()
