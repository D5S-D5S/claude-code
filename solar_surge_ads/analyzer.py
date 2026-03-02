"""
Solar Surge Ad Performance Analyzer
=====================================
Reads launched_ads.json, fetches live performance from Facebook,
and gives you clear SCALE / WATCH / KILL recommendations.

Usage:
  python analyzer.py              — full analysis (all ads)
  python analyzer.py --ad SS_BF_HomeValue   — single ad analysis
  python analyzer.py --json       — machine-readable JSON output
"""

import json
import os
import sys
from datetime import datetime, timedelta

from dotenv import load_dotenv
from facebook_business.adobjects.ad import Ad
from facebook_business.adobjects.adset import AdSet
from facebook_business.adobjects.campaign import Campaign
from facebook_business.api import FacebookAdsApi

load_dotenv()

ACCESS_TOKEN = os.getenv("FACEBOOK_ACCESS_TOKEN")
AD_ACCOUNT_ID = os.getenv("AD_ACCOUNT_ID")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LAUNCHED_ADS_PATH = os.path.join(BASE_DIR, "launched_ads.json")

# ── Thresholds ────────────────────────────────────────────────────────────────
MIN_IMPRESSIONS_FOR_VERDICT = 500
CPL_SCALE_MAX = 8.0       # £8
CPL_WATCH_MAX = 15.0      # £15
CTR_SCALE_MIN = 1.5       # 1.5%
CTR_WATCH_MIN = 1.0       # 1.0%


def init_api():
    FacebookAdsApi.init(access_token=ACCESS_TOKEN)


def load_launched():
    with open(LAUNCHED_ADS_PATH) as f:
        return json.load(f)


def fetch_ad_insights(ad_id: str, days: int = 7) -> dict:
    """Fetch impressions, CPL, leads, CTR, spend for a given ad."""
    since = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
    until = datetime.utcnow().strftime("%Y-%m-%d")

    ad = Ad(ad_id)
    try:
        insights = ad.get_insights(
            fields=["impressions", "spend", "ctr", "actions", "cost_per_action_type"],
            params={
                "date_preset": "last_7d",
                "time_range": {"since": since, "until": until},
            }
        )
    except Exception as e:
        return {"error": str(e)}

    if not insights:
        return {
            "impressions": 0,
            "spend": 0.0,
            "ctr": 0.0,
            "leads": 0,
            "cpl": 0.0,
            "raw": {}
        }

    row = insights[0]

    impressions = int(row.get("impressions", 0))
    spend = float(row.get("spend", 0.0))
    ctr = float(row.get("ctr", 0.0))

    # Extract lead count from actions
    leads = 0
    actions = row.get("actions", [])
    for action in actions:
        if action.get("action_type") in ("lead", "onsite_conversion.lead_grouped"):
            leads += int(action.get("value", 0))

    # CPL
    cpl = round(spend / leads, 2) if leads > 0 else None

    return {
        "impressions": impressions,
        "spend": round(spend, 2),
        "ctr": round(ctr, 3),
        "leads": leads,
        "cpl": cpl,
    }


def verdict(metrics: dict) -> tuple[str, str]:
    """Return (label, explanation) for this ad."""
    impressions = metrics.get("impressions", 0)
    cpl = metrics.get("cpl")
    ctr = metrics.get("ctr", 0.0)
    leads = metrics.get("leads", 0)

    if "error" in metrics:
        return "⚠️ ERROR", f"Could not fetch data: {metrics['error']}"

    if impressions < MIN_IMPRESSIONS_FOR_VERDICT:
        remaining = MIN_IMPRESSIONS_FOR_VERDICT - impressions
        return "⏳ GATHERING DATA", f"Only {impressions} impressions so far. Need {remaining} more before verdict."

    # 500+ impressions reached — make a call
    if impressions >= MIN_IMPRESSIONS_FOR_VERDICT and leads == 0:
        return "❌ KILL", f"{impressions} impressions, 0 leads. This creative is not converting."

    if ctr is not None and ctr < CTR_WATCH_MIN:
        return "❌ KILL", f"CTR {ctr:.2f}% is below the 1% floor. Not generating enough clicks."

    if cpl is not None and cpl > CPL_WATCH_MAX:
        return "❌ KILL", f"CPL £{cpl:.2f} is above £{CPL_WATCH_MAX:.0f} kill threshold."

    if cpl is not None and cpl <= CPL_SCALE_MAX and ctr is not None and ctr >= CTR_SCALE_MIN:
        return "✅ SCALE", f"CPL £{cpl:.2f} ✓ (target <£{CPL_SCALE_MAX:.0f}) | CTR {ctr:.2f}% ✓ (target >{CTR_SCALE_MIN:.1f}%). Increase budget."

    return "⚠️ WATCH", f"CPL £{cpl:.2f if cpl else 'N/A'} | CTR {ctr:.2f}%. Borderline — let it run another 48hrs."


def build_recommendation(results: list[dict]) -> str:
    """Plain-English summary sentence."""
    kills = [r for r in results if "KILL" in r["verdict"]]
    scales = [r for r in results if "SCALE" in r["verdict"]]
    watches = [r for r in results if "WATCH" in r["verdict"]]
    pending = [r for r in results if "GATHERING" in r["verdict"]]

    parts = []
    if kills:
        names = ", ".join(r["name"] for r in kills)
        parts.append(f"Kill {names}.")
    if scales:
        names = ", ".join(r["name"] for r in scales)
        parts.append(f"Scale {names} — reallocate budget from killed ads here.")
    if watches:
        names = ", ".join(r["name"] for r in watches)
        parts.append(f"Let {names} run another 48hrs.")
    if pending:
        names = ", ".join(r["name"] for r in pending)
        parts.append(f"Still gathering data for {names}.")

    if not parts:
        return "No actionable data yet. Check back after each ad hits 500 impressions."

    return " ".join(parts)


def run_analysis(filter_name: str = None, json_output: bool = False):
    init_api()
    launched = load_launched()
    ads = launched.get("ads", [])

    if not ads:
        print("\n  ⚠️  No ads found in launched_ads.json. Run launcher.py first.\n")
        return

    if filter_name:
        ads = [a for a in ads if a["name"] == filter_name]
        if not ads:
            print(f"\n  ❌ No ad named '{filter_name}' found.\n")
            return

    results = []
    for ad_record in ads:
        ad_id = ad_record["id"]
        ad_name = ad_record["name"]
        metrics = fetch_ad_insights(ad_id)
        label, explanation = verdict(metrics)
        results.append({
            "id": ad_id,
            "name": ad_name,
            "angle": ad_record.get("angle", ""),
            "verdict": label,
            "explanation": explanation,
            "metrics": metrics
        })

    if json_output:
        print(json.dumps({"results": results, "recommendation": build_recommendation(results)}, indent=2))
        return

    # Human-readable output
    print(f"\n{'='*65}")
    print("  SOLAR SURGE — AD PERFORMANCE ANALYSIS")
    print(f"  {datetime.utcnow().strftime('%Y-%m-%d %H:%M')} UTC")
    print(f"{'='*65}")

    total_spend = 0.0
    total_leads = 0

    for r in results:
        m = r["metrics"]
        print(f"\n  {'─'*60}")
        print(f"  {r['verdict']}  |  {r['name']}")
        print(f"  Angle: {r['angle']}")
        print(f"  {'─'*60}")
        if "error" not in m:
            print(f"  Impressions : {m.get('impressions', 0):,}")
            print(f"  CTR         : {m.get('ctr', 0.0):.2f}%")
            print(f"  Leads       : {m.get('leads', 0)}")
            cpl_display = f"£{m['cpl']:.2f}" if m.get('cpl') is not None else "N/A (no leads yet)"
            print(f"  CPL         : {cpl_display}")
            print(f"  Spend       : £{m.get('spend', 0.0):.2f}")
            total_spend += m.get("spend", 0.0)
            total_leads += m.get("leads", 0)
        print(f"\n  → {r['explanation']}")

    print(f"\n{'='*65}")
    print(f"  TOTAL SPEND : £{total_spend:.2f}")
    print(f"  TOTAL LEADS : {total_leads}")
    if total_leads > 0:
        overall_cpl = total_spend / total_leads
        print(f"  OVERALL CPL : £{overall_cpl:.2f}")
    print(f"\n  📋 RECOMMENDATION:")
    print(f"  {build_recommendation(results)}")
    print(f"\n{'='*65}\n")


if __name__ == "__main__":
    args = sys.argv[1:]
    filter_name = None
    json_mode = False

    if "--json" in args:
        json_mode = True
        args.remove("--json")

    if "--ad" in args:
        idx = args.index("--ad")
        if idx + 1 < len(args):
            filter_name = args[idx + 1]

    run_analysis(filter_name=filter_name, json_output=json_mode)
