"""
Solar Surge Facebook Ads Launcher — Multi-Client
==================================================
Creates campaigns, ad sets, lead forms, and 5 ads per client.
Everything starts PAUSED. Nothing goes live until you type CONFIRM.

Usage:
  python launcher.py --client sgs <command>
  python launcher.py --client hes <command>
  python launcher.py <command>          ← for shared commands (test, show-clients)

Commands:
  test              Read-only API connection test
  show-clients      List available clients
  show-copy         Print all 5 ad copy variations for the client
  show-form         Print lead form structure for the client
  create-form       Create the lead form (requires PRIVACY_POLICY_URL in .env)
  create-campaign   Build campaign + ad set (PAUSED) — no form required
  create-ads        Add 5 ads to existing campaign (requires form_id)
  summary           Print full summary of created assets for the client

Examples:
  python launcher.py test
  python launcher.py --client sgs create-campaign    # creates structure, PAUSED
  python launcher.py --client sgs create-form        # after privacy policy URL is live
  python launcher.py --client sgs create-ads         # after form is created
  python launcher.py --client sgs summary
"""

import json
import os
import sys
from datetime import datetime

from dotenv import load_dotenv
from facebook_business.adobjects.adaccount import AdAccount
from facebook_business.adobjects.ad import Ad
from facebook_business.adobjects.page import Page
from facebook_business.api import FacebookAdsApi

load_dotenv()

ACCESS_TOKEN = os.getenv("FACEBOOK_ACCESS_TOKEN")
AD_ACCOUNT_ID = os.getenv("AD_ACCOUNT_ID")
PAGE_ID = os.getenv("PAGE_ID")
PRIVACY_POLICY_URL = os.getenv("PRIVACY_POLICY_URL", "")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CLIENTS_DIR = os.path.join(BASE_DIR, "clients")

CLIENTS = {
    "sgs": "Client 1 — Smart Group Scotland (Simon Flynn)",
    "hes": "Client 2 — Home Eco Solutions (James Davies)",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def init_api():
    FacebookAdsApi.init(access_token=ACCESS_TOKEN)
    return AdAccount(AD_ACCOUNT_ID)


def client_path(client: str, filename: str) -> str:
    return os.path.join(CLIENTS_DIR, client, filename)


def load_json(path: str) -> dict:
    with open(path) as f:
        return json.load(f)


def save_json(path: str, data: dict):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"  ✓ Saved → {path}")


def update_launched(client: str, key: str, value: dict):
    path = client_path(client, "launched_ads.json")
    data = load_json(path)
    data["meta"]["last_updated"] = datetime.utcnow().isoformat() + "Z"
    if key in ("campaign", "ad_set", "lead_form"):
        data[key].update(value)
    elif key == "ads":
        data["ads"].append(value)
    save_json(path, data)


def require_client(client: str | None):
    if not client or client not in CLIENTS:
        print(f"\n  ❌ Client required. Use: --client sgs  or  --client hes")
        print(f"  Available: {', '.join(CLIENTS.keys())}\n")
        sys.exit(1)


def build_geo_targeting(cfg: dict) -> dict:
    """Build Facebook geo targeting spec from campaign config."""
    geo = cfg["ad_set"]["targeting"]["geo_locations"]
    cities = geo.get("cities", [])
    location_types = geo.get("location_types", ["home", "recent"])

    # Facebook API expects city keys from its geo API
    # For UK cities, we use the cities list with a nearby radius
    return {
        "geo_locations": {
            "countries": geo.get("countries", ["GB"]),
            # Note: for the real API call, city keys must be looked up via
            # GET /search?type=adgeolocation&q=<city>&location_types=city
            # The launcher will use country + region as fallback if city keys aren't resolved
            "regions": [{"key": "2346", "name": "Scotland"}]  # FB region key — updated per client below
            if cfg["client"] == "sgs" else
            [{"key": "2347", "name": "Wales"}],
            "location_types": location_types
        },
        "age_min": cfg["ad_set"]["targeting"]["age_min"],
        "age_max": cfg["ad_set"]["targeting"]["age_max"],
        "publisher_platforms": cfg["ad_set"]["targeting"]["publisher_platforms"],
        "facebook_positions": cfg["ad_set"]["targeting"]["facebook_positions"],
        "instagram_positions": cfg["ad_set"]["targeting"]["instagram_positions"],
        "device_platforms": cfg["ad_set"]["targeting"]["device_platforms"],
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
    }


# ── Commands ──────────────────────────────────────────────────────────────────

def cmd_test(_client=None):
    print("\n🔍 Testing API connection (read-only)…")
    try:
        account = init_api()
        info = account.api_get(fields=["name", "currency", "account_status"])
        status_map = {
            1: "ACTIVE", 2: "DISABLED", 3: "UNSETTLED",
            7: "PENDING_RISK_REVIEW", 101: "CLOSED"
        }
        print(f"  ✅ Connected: {info.get('name')}")
        print(f"     Currency : {info.get('currency')}")
        print(f"     Status   : {status_map.get(info.get('account_status'), info.get('account_status'))}")

        campaigns = account.get_campaigns(fields=["name", "status"], params={"limit": 5})
        print(f"\n  📋 Last {len(campaigns)} campaign(s):")
        for c in campaigns:
            print(f"     • [{c['status']}] {c['name']} (id: {c['id']})")
        print("\n  ✅ API test passed. Ready to build.\n")
    except Exception as e:
        print(f"\n  ❌ API test failed: {e}\n")
        sys.exit(1)


def cmd_show_clients(_client=None):
    print(f"\n{'='*55}")
    print("  SOLAR SURGE — CONFIGURED CLIENTS")
    print(f"{'='*55}")
    for key, label in CLIENTS.items():
        cfg = load_json(client_path(key, "campaign_config.json"))
        launched = load_json(client_path(key, "launched_ads.json"))
        campaign_id = launched["campaign"].get("id") or "NOT CREATED"
        postcodes = ", ".join(cfg.get("postcode_areas", []))
        finance = "✅ Yes" if cfg.get("finance_available") else "❌ No"
        print(f"\n  [{key.upper()}] {label}")
        print(f"    Postcodes : {postcodes}")
        print(f"    Finance   : {finance}")
        print(f"    MCS       : {'✅ Yes' if cfg.get('mcs_certified') else '❌ No'}")
        print(f"    Campaign  : {campaign_id}")
    print(f"\n{'='*55}\n")


def cmd_show_copy(client: str):
    copy_bank = load_json(client_path(client, "copy_bank.json"))
    cfg = load_json(client_path(client, "campaign_config.json"))
    print(f"\n{'='*65}")
    print(f"  {copy_bank['client_label'].upper()} — 5 AD COPY VARIATIONS")
    print(f"  Strategy: {copy_bank['strategy'][:80]}…")
    print(f"{'='*65}")
    for i, ad in enumerate(copy_bank["ads"], 1):
        print(f"\n{'─'*65}")
        print(f"  AD {i} — {ad['name_tag']}")
        print(f"  Angle: {ad['angle']}")
        print(f"{'─'*65}")
        print(f"\n  HOOK:\n  {ad['hook']}")
        print(f"\n  BODY:\n  {ad['body']}")
        print(f"\n  CTA:\n  {ad['cta']}")
    print(f"\n{'='*65}\n")


def cmd_show_form(client: str):
    cfg = load_json(client_path(client, "campaign_config.json"))
    fc = cfg["lead_form"]
    pp_status = (f"✅  {PRIVACY_POLICY_URL}" if PRIVACY_POLICY_URL
                 else "⚠️  NOT SET — add PRIVACY_POLICY_URL to .env")
    print(f"\n{'='*65}")
    print(f"  {cfg['client_label'].upper()} — LEAD FORM STRUCTURE")
    print(f"{'='*65}")
    print(f"\n  Form Type   : {fc['form_type']} (high volume, low friction)")
    print(f"  Name        : {fc['name']}")
    print(f"\n  ── INTRO ──")
    print(f"  Headline    : {fc['intro']['headline']}")
    print(f"  Description : {fc['intro']['description']}")
    print(f"\n  ── PRE-FILLED (from Facebook profile) ──")
    for f in ["First Name", "Last Name", "Phone Number", "Email Address"]:
        print(f"  • {f}")
    print(f"\n  ── CUSTOM QUESTION ──")
    print(f"  Q: Do you own your home?")
    for opt in ["Yes, own it outright", "Yes, I have a mortgage", "No, I rent"]:
        print(f"     ○ {opt}")
    print(f"\n  ── THANK YOU SCREEN ──")
    print(f"  Headline    : {fc['thank_you']['headline']}")
    print(f"  Description : {fc['thank_you']['description']}")
    print(f"  CTA Button  : {fc['thank_you']['cta_text']}")
    print(f"\n  Privacy URL : {pp_status}")
    print(f"\n{'='*65}\n")


def cmd_create_form(client: str):
    if not PRIVACY_POLICY_URL:
        print("\n  ❌ PRIVACY_POLICY_URL not set in .env. Add it first.\n")
        sys.exit(1)

    cfg = load_json(client_path(client, "campaign_config.json"))
    fc = cfg["lead_form"]
    print(f"\n📋 Creating lead form for [{client.upper()}] {cfg['client_label']}…")

    init_api()
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
        "name": fc["name"],
        "form_type": fc["form_type"],
        "locale": fc["locale"],
        "questions": questions,
        "privacy_policy": {"url": PRIVACY_POLICY_URL, "link_text": "Privacy Policy"},
        "intro": {
            "headline": fc["intro"]["headline"],
            "description": {"content": fc["intro"]["description"]}
        },
        "thank_you_body": {
            "headline": fc["thank_you"]["headline"],
            "description": fc["thank_you"]["description"],
            "button_type": "VIEW_WEBSITE",
            "button_text": fc["thank_you"]["cta_text"],
            "website_url": f"https://www.facebook.com/{PAGE_ID}"
        },
        "tracking_parameters": [
            {"key": "ad_name", "value": "{{ad.name}}"},
            {"key": "adset_name", "value": "{{adset.name}}"},
            {"key": "campaign_name", "value": "{{campaign.name}}"},
            {"key": "client", "value": client},
        ]
    }

    page = Page(PAGE_ID)
    form = page.create_leadgen_form(params=params)
    form_id = form["id"]
    print(f"  ✅ Form created: {form_id}")
    update_launched(client, "lead_form", {"id": form_id, "name": fc["name"]})
    print(f"  Form ID logged.\n")


def cmd_create_campaign(client: str):
    """Phase 1 — Create campaign + ad set (PAUSED). No form required."""
    cfg = load_json(client_path(client, "campaign_config.json"))
    account = init_api()
    today = datetime.utcnow().strftime("%Y-%m-%d")
    campaign_name = cfg["campaign"]["name"].replace("{DATE}", today)

    # Guard: don't create a duplicate campaign
    launched = load_json(client_path(client, "launched_ads.json"))
    if launched["campaign"].get("id"):
        print(f"\n  ⚠️  Campaign already exists for [{client.upper()}]: {launched['campaign']['id']}")
        print(f"  Run: python launcher.py --client {client} summary\n")
        return

    print(f"\n🚀 [{client.upper()}] Creating CAMPAIGN (PAUSED)…")
    campaign = account.create_campaign(params={
        "name": campaign_name,
        "objective": "LEAD_GENERATION",
        "status": "PAUSED",
        "special_ad_categories": [],
        "budget_rebalance_flag": True,
    })
    campaign_id = campaign["id"]
    print(f"  ✅ Campaign: {campaign_id} — {campaign_name}")
    update_launched(client, "campaign", {"id": campaign_id, "name": campaign_name, "status": "PAUSED"})

    print(f"\n📦 [{client.upper()}] Creating AD SET (PAUSED)…")
    targeting = build_geo_targeting(cfg)
    ad_set = account.create_ad_set(params={
        "name": cfg["ad_set"]["name"],
        "campaign_id": campaign_id,
        "daily_budget": cfg["campaign"]["daily_budget_pence"],
        "billing_event": "IMPRESSIONS",
        "optimization_goal": "LEAD_GENERATION",
        "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
        "status": "PAUSED",
        "targeting": targeting,
        "promoted_object": {"page_id": PAGE_ID},
    })
    adset_id = ad_set["id"]
    print(f"  ✅ Ad set: {adset_id} — {cfg['ad_set']['name']}")
    update_launched(client, "ad_set", {"id": adset_id, "name": cfg["ad_set"]["name"], "status": "PAUSED"})

    print(f"\n  ✅ [{client.upper()}] Campaign structure saved (PAUSED).")
    print(f"  Next: create privacy policy page, then run:")
    print(f"    python launcher.py --client {client} create-form")
    print(f"    python launcher.py --client {client} create-ads\n")


def cmd_create_ads(client: str):
    """Phase 2 — Create 5 ads (PAUSED). Requires form_id from create-form."""
    launched = load_json(client_path(client, "launched_ads.json"))
    form_id = launched["lead_form"].get("id")
    adset_id = launched["ad_set"].get("id")

    if not form_id:
        print(f"\n  ❌ No form_id for [{client.upper()}]. Run create-form first.\n")
        sys.exit(1)
    if not adset_id:
        print(f"\n  ❌ No ad_set_id for [{client.upper()}]. Run create-campaign first.\n")
        sys.exit(1)
    if launched["ads"]:
        print(f"\n  ⚠️  {len(launched['ads'])} ads already exist for [{client.upper()}]. Skipping.\n")
        return

    copy_bank = load_json(client_path(client, "copy_bank.json"))
    account = init_api()

    print(f"\n🎨 [{client.upper()}] Creating 5 ADS (all PAUSED)…")
    for ad_copy in copy_bank["ads"]:
        message = f"{ad_copy['hook']}\n\n{ad_copy['body']}\n\n{ad_copy['cta']}"

        creative = account.create_ad_creative(params={
            "name": f"Creative — {ad_copy['name_tag']}",
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

        ad = account.create_ad(params={
            "name": ad_copy["name_tag"],
            "adset_id": adset_id,
            "creative": {"creative_id": creative["id"]},
            "status": "PAUSED",
        })
        print(f"  ✅ Ad: {ad['id']} — {ad_copy['name_tag']}")
        update_launched(client, "ads", {
            "id": ad["id"],
            "name": ad_copy["name_tag"],
            "creative_id": creative["id"],
            "angle": ad_copy["angle"],
            "status": "PAUSED"
        })

    print(f"\n  ✅ [{client.upper()}] All 5 ads created. Nothing is live.")
    print(f"  Run: python launcher.py --client {client} summary\n")


def cmd_summary(client: str):
    cfg = load_json(client_path(client, "campaign_config.json"))
    data = load_json(client_path(client, "launched_ads.json"))
    print(f"\n{'='*65}")
    print(f"  ASSET SUMMARY — {cfg['client_label'].upper()}")
    print(f"  Last updated: {data['meta'].get('last_updated', 'N/A')}")
    print(f"{'='*65}")
    c = data["campaign"]
    print(f"\n  CAMPAIGN")
    print(f"    ID     : {c.get('id') or 'NOT CREATED'}")
    print(f"    Name   : {c.get('name') or '—'}")
    print(f"    Status : {c.get('status') or '—'}")
    s = data["ad_set"]
    print(f"\n  AD SET")
    print(f"    ID     : {s.get('id') or 'NOT CREATED'}")
    print(f"    Name   : {s.get('name') or '—'}")
    lf = data["lead_form"]
    print(f"\n  LEAD FORM")
    print(f"    ID     : {lf.get('id') or 'NOT CREATED'}")
    print(f"\n  ADS ({len(data['ads'])} / 5)")
    for ad in data["ads"]:
        print(f"    • [{ad.get('status')}] {ad['name']} (id: {ad['id']})")
    print(f"\n  Postcodes : {', '.join(cfg.get('postcode_areas', []))}")
    print(f"  Finance   : {'✅ Yes' if cfg.get('finance_available') else '❌ No'}")
    print(f"  MCS       : {'✅ Yes' if cfg.get('mcs_certified') else '❌ No'}")
    print(f"\n{'─'*65}")
    print(f"  ⚠️  ALL PAUSED. Type CONFIRM to activate (separate step).")
    print(f"{'='*65}\n")


# ── Entry point ───────────────────────────────────────────────────────────────

SHARED_COMMANDS = {"test": cmd_test, "show-clients": cmd_show_clients}
CLIENT_COMMANDS = {
    "show-copy": cmd_show_copy,
    "show-form": cmd_show_form,
    "create-form": cmd_create_form,
    "create-campaign": cmd_create_campaign,
    "create-ads": cmd_create_ads,
    "summary": cmd_summary,
}

if __name__ == "__main__":
    args = sys.argv[1:]

    # Parse --client flag
    client = None
    if "--client" in args:
        idx = args.index("--client")
        if idx + 1 < len(args):
            client = args[idx + 1]
            args = args[:idx] + args[idx + 2:]

    if not args:
        print(f"\nUsage: python launcher.py [--client sgs|hes] <command>")
        print(f"  Shared  : {', '.join(SHARED_COMMANDS.keys())}")
        print(f"  Clients : {', '.join(CLIENT_COMMANDS.keys())}\n")
        sys.exit(1)

    command = args[0]

    if command in SHARED_COMMANDS:
        SHARED_COMMANDS[command]()
    elif command in CLIENT_COMMANDS:
        require_client(client)
        CLIENT_COMMANDS[command](client)
    else:
        print(f"\n  ❌ Unknown command: {command}")
        print(f"  Commands: {', '.join(list(SHARED_COMMANDS) + list(CLIENT_COMMANDS))}\n")
        sys.exit(1)
