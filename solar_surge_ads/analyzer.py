"""
Solar Surge Ad Performance Analyzer — Multi-Client
====================================================
Reads launched_ads.json for a given client, fetches live Facebook metrics,
and outputs SCALE / WATCH / KILL verdicts with plain-English recommendations.

Usage:
  python analyzer.py --client sgs           — full analysis for SGS
  python analyzer.py --client hes           — full analysis for HES
  python analyzer.py --client sgs --ad SGS_BF_Premium10kW  — single ad
  python analyzer.py --client sgs --json    — machine-readable output
  python analyzer.py all                    — both clients side by side
"""

import json
import os
import sys
from datetime import datetime, timedelta

from dotenv import load_dotenv
from facebook_business.adobjects.ad import Ad
from facebook_business.api import FacebookAdsApi

load_dotenv()

ACCESS_TOKEN = os.getenv("FACEBOOK_ACCESS_TOKEN")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CLIENTS_DIR = os.path.join(BASE_DIR, "clients")

CLIENTS = {
    "sgs": "Client 1 — Scotland",
    "hes": "Client 2 — South Wales",
}

# ── Decision thresholds ───────────────────────────────────────────────────────
MIN_IMPRESSIONS_FOR_VERDICT = 500
CPL_SCALE_MAX  = 8.0    # £8
CPL_WATCH_MAX  = 15.0   # £15
CTR_SCALE_MIN  = 1.5    # 1.5%
CTR_WATCH_MIN  = 1.0    # 1.0%


def init_api():
    FacebookAdsApi.init(access_token=ACCESS_TOKEN)


def client_path(client: str, filename: str) -> str:
    return os.path.join(CLIENTS_DIR, client, filename)


def load_json(path: str) -> dict:
    with open(path) as f:
        return json.load(f)


def fetch_ad_insights(ad_id: str, days: int = 7) -> dict:
    since = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
    until = datetime.utcnow().strftime("%Y-%m-%d")
    try:
        ad = Ad(ad_id)
        insights = ad.get_insights(
            fields=["impressions", "spend", "ctr", "actions", "cost_per_action_type"],
            params={"time_range": {"since": since, "until": until}}
        )
    except Exception as e:
        return {"error": str(e)}

    if not insights:
        return {"impressions": 0, "spend": 0.0, "ctr": 0.0, "leads": 0, "cpl": None}

    row = insights[0]
    impressions = int(row.get("impressions", 0))
    spend = float(row.get("spend", 0.0))
    ctr = float(row.get("ctr", 0.0))
    leads = sum(
        int(a.get("value", 0)) for a in row.get("actions", [])
        if a.get("action_type") in ("lead", "onsite_conversion.lead_grouped")
    )
    return {
        "impressions": impressions,
        "spend": round(spend, 2),
        "ctr": round(ctr, 3),
        "leads": leads,
        "cpl": round(spend / leads, 2) if leads > 0 else None,
    }


def verdict(metrics: dict) -> tuple[str, str]:
    if "error" in metrics:
        return "⚠️ ERROR", f"Could not fetch data: {metrics['error']}"

    impressions = metrics.get("impressions", 0)
    cpl = metrics.get("cpl")
    ctr = metrics.get("ctr", 0.0)
    leads = metrics.get("leads", 0)

    if impressions < MIN_IMPRESSIONS_FOR_VERDICT:
        return "⏳ GATHERING DATA", (
            f"Only {impressions} impressions. Need "
            f"{MIN_IMPRESSIONS_FOR_VERDICT - impressions} more before verdict."
        )

    if leads == 0:
        return "❌ KILL", f"{impressions:,} impressions, 0 leads. Creative not converting."
    if ctr < CTR_WATCH_MIN:
        return "❌ KILL", f"CTR {ctr:.2f}% below 1% floor. Not generating enough clicks."
    if cpl and cpl > CPL_WATCH_MAX:
        return "❌ KILL", f"CPL £{cpl:.2f} above £{CPL_WATCH_MAX:.0f} kill threshold."
    if cpl and cpl <= CPL_SCALE_MAX and ctr >= CTR_SCALE_MIN:
        return "✅ SCALE", (
            f"CPL £{cpl:.2f} ✓ (target <£{CPL_SCALE_MAX:.0f}) | "
            f"CTR {ctr:.2f}% ✓ (target >{CTR_SCALE_MIN:.1f}%). Increase budget."
        )
    return "⚠️ WATCH", f"CPL {'£'+str(cpl) if cpl else 'N/A'} | CTR {ctr:.2f}%. Borderline — run 48hrs more."


def build_recommendation(results: list) -> str:
    kills  = [r for r in results if "KILL"    in r["verdict"]]
    scales = [r for r in results if "SCALE"   in r["verdict"]]
    watches= [r for r in results if "WATCH"   in r["verdict"]]
    pending= [r for r in results if "GATHERING" in r["verdict"]]
    parts = []
    if kills:
        parts.append(f"Kill {', '.join(r['name'] for r in kills)}.")
    if scales:
        parts.append(f"Scale {', '.join(r['name'] for r in scales)} — reallocate budget from killed ads.")
    if watches:
        parts.append(f"Let {', '.join(r['name'] for r in watches)} run 48hrs more.")
    if pending:
        parts.append(f"Still gathering data for {', '.join(r['name'] for r in pending)}.")
    return " ".join(parts) or "No actionable data yet. Check after each ad hits 500 impressions."


def analyse_client(client: str, filter_name: str = None, days: int = 7) -> dict:
    """Fetch and analyse all ads for a client. Returns structured results."""
    launched = load_json(client_path(client, "launched_ads.json"))
    copy_bank = {a["name_tag"]: a for a in load_json(client_path(client, "copy_bank.json"))["ads"]}
    ads = launched.get("ads", [])
    if filter_name:
        ads = [a for a in ads if a["name"] == filter_name]

    results = []
    for ad_record in ads:
        metrics = fetch_ad_insights(ad_record["id"], days=days)
        label, explanation = verdict(metrics)
        copy = copy_bank.get(ad_record["name"], {})
        results.append({
            "id": ad_record["id"],
            "name": ad_record["name"],
            "angle": ad_record.get("angle", ""),
            "verdict": label,
            "explanation": explanation,
            "copy": {
                "hook": copy.get("hook", ""),
                "body": copy.get("body", ""),
                "cta": copy.get("cta", ""),
            },
            "metrics": metrics,
        })

    total_spend = sum(r["metrics"].get("spend", 0) for r in results)
    total_leads = sum(r["metrics"].get("leads", 0) for r in results)
    return {
        "client": client,
        "client_label": CLIENTS.get(client, client),
        "ads": results,
        "totals": {
            "spend": round(total_spend, 2),
            "leads": total_leads,
            "cpl": round(total_spend / total_leads, 2) if total_leads else None,
        },
        "recommendation": build_recommendation(results),
        "fetched_at": datetime.utcnow().isoformat() + "Z",
    }


def print_analysis(data: dict):
    label = data["client_label"]
    results = data["ads"]
    totals = data["totals"]

    print(f"\n{'='*68}")
    print(f"  [{data['client'].upper()}] {label.upper()}")
    print(f"  Analysed: {data['fetched_at'][:16]} UTC")
    print(f"{'='*68}")

    for r in results:
        m = r["metrics"]
        print(f"\n  {'─'*63}")
        print(f"  {r['verdict']}  |  {r['name']}")
        print(f"  Angle: {r['angle']}")
        print(f"  {'─'*63}")
        if "error" not in m:
            print(f"  Impressions : {m.get('impressions', 0):,}")
            print(f"  CTR         : {m.get('ctr', 0):.2f}%")
            print(f"  Leads       : {m.get('leads', 0)}")
            print(f"  CPL         : {'£'+str(m['cpl']) if m.get('cpl') else 'N/A'}")
            print(f"  Spend       : £{m.get('spend', 0):.2f}")
        print(f"\n  → {r['explanation']}")

    print(f"\n{'='*68}")
    print(f"  TOTAL SPEND : £{totals['spend']:.2f}")
    print(f"  TOTAL LEADS : {totals['leads']}")
    if totals.get("cpl"):
        print(f"  OVERALL CPL : £{totals['cpl']:.2f}")
    print(f"\n  📋 {data['recommendation']}")
    print(f"{'='*68}\n")


if __name__ == "__main__":
    args = sys.argv[1:]
    client = None
    filter_name = None
    json_mode = False
    run_all = False

    if "all" in args:
        run_all = True
        args.remove("all")

    if "--json" in args:
        json_mode = True
        args.remove("--json")

    if "--client" in args:
        idx = args.index("--client")
        if idx + 1 < len(args):
            client = args[idx + 1]

    if "--ad" in args:
        idx = args.index("--ad")
        if idx + 1 < len(args):
            filter_name = args[idx + 1]

    if not client and not run_all:
        print("\nUsage: python analyzer.py --client sgs|hes [--ad NAME] [--json]")
        print("       python analyzer.py all\n")
        sys.exit(1)

    init_api()
    targets = list(CLIENTS.keys()) if run_all else [client]

    if json_mode:
        out = [analyse_client(c, filter_name) for c in targets]
        print(json.dumps(out if run_all else out[0], indent=2))
    else:
        for c in targets:
            data = analyse_client(c, filter_name)
            print_analysis(data)
