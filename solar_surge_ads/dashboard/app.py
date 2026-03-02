"""
Solar Surge — Ad Performance Dashboard
========================================
Flask web app that shows live Facebook ad metrics with SCALE/WATCH/KILL labels.

Run:
  python dashboard/app.py
  → opens at http://localhost:5000
"""

import json
import os
import sys
from datetime import datetime, timedelta

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request
from flask_cors import CORS

# Allow imports from parent dir
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from analyzer import (
    MIN_IMPRESSIONS_FOR_VERDICT,
    CPL_SCALE_MAX,
    CPL_WATCH_MAX,
    CTR_SCALE_MIN,
    CTR_WATCH_MIN,
    fetch_ad_insights,
    verdict,
    build_recommendation,
    init_api,
)

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAUNCHED_ADS_PATH = os.path.join(BASE_DIR, "launched_ads.json")
COPY_BANK_PATH = os.path.join(BASE_DIR, "copy_bank.json")

app = Flask(__name__)
CORS(app)


def load_launched():
    with open(LAUNCHED_ADS_PATH) as f:
        return json.load(f)


def load_copy_bank():
    with open(COPY_BANK_PATH) as f:
        return json.load(f)


def get_copy_for_ad(name_tag: str, copy_bank: list) -> dict:
    for ad in copy_bank:
        if ad["name_tag"] == name_tag:
            return ad
    return {}


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/summary")
def api_summary():
    """Return high-level account summary."""
    try:
        launched = load_launched()
        return jsonify({
            "campaign": launched["campaign"],
            "ad_set": launched["ad_set"],
            "lead_form": launched["lead_form"],
            "ad_count": len(launched["ads"]),
            "last_updated": launched["meta"].get("last_updated"),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/ads")
def api_ads():
    """Return all ads with live performance metrics."""
    days = int(request.args.get("days", 7))
    try:
        init_api()
        launched = load_launched()
        copy_bank = load_copy_bank()["ads"]
        ads = launched.get("ads", [])
        results = []

        for ad_record in ads:
            metrics = fetch_ad_insights(ad_record["id"], days=days)
            label, explanation = verdict(metrics)
            copy = get_copy_for_ad(ad_record["name"], copy_bank)

            results.append({
                "id": ad_record["id"],
                "name": ad_record["name"],
                "angle": ad_record.get("angle", ""),
                "status": ad_record.get("status", "PAUSED"),
                "verdict": label,
                "explanation": explanation,
                "copy": {
                    "hook": copy.get("hook", ""),
                    "body": copy.get("body", ""),
                    "cta": copy.get("cta", ""),
                },
                "metrics": {
                    "impressions": metrics.get("impressions", 0),
                    "spend": metrics.get("spend", 0.0),
                    "ctr": metrics.get("ctr", 0.0),
                    "leads": metrics.get("leads", 0),
                    "cpl": metrics.get("cpl"),
                },
                "error": metrics.get("error"),
            })

        total_spend = sum(r["metrics"]["spend"] for r in results)
        total_leads = sum(r["metrics"]["leads"] for r in results)
        overall_cpl = round(total_spend / total_leads, 2) if total_leads > 0 else None

        return jsonify({
            "ads": results,
            "totals": {
                "spend": round(total_spend, 2),
                "leads": total_leads,
                "cpl": overall_cpl,
            },
            "recommendation": build_recommendation(results),
            "thresholds": {
                "min_impressions": MIN_IMPRESSIONS_FOR_VERDICT,
                "cpl_scale_max": CPL_SCALE_MAX,
                "cpl_watch_max": CPL_WATCH_MAX,
                "ctr_scale_min": CTR_SCALE_MIN,
                "ctr_watch_min": CTR_WATCH_MIN,
            },
            "fetched_at": datetime.utcnow().isoformat() + "Z",
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/ad/<ad_id>/history")
def api_ad_history(ad_id):
    """Return 7-day daily breakdown for a single ad."""
    try:
        init_api()
        from facebook_business.adobjects.ad import Ad
        ad = Ad(ad_id)
        insights = ad.get_insights(
            fields=["impressions", "spend", "ctr", "actions", "cost_per_action_type", "date_start"],
            params={
                "time_increment": 1,
                "date_preset": "last_7d",
            }
        )

        history = []
        for row in insights:
            leads = sum(
                int(a.get("value", 0)) for a in row.get("actions", [])
                if a.get("action_type") in ("lead", "onsite_conversion.lead_grouped")
            )
            spend = float(row.get("spend", 0))
            history.append({
                "date": row.get("date_start"),
                "impressions": int(row.get("impressions", 0)),
                "spend": round(spend, 2),
                "ctr": float(row.get("ctr", 0)),
                "leads": leads,
                "cpl": round(spend / leads, 2) if leads > 0 else None,
            })

        return jsonify({"ad_id": ad_id, "history": history})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    print("\n🌞 Solar Surge Dashboard starting at http://localhost:5000\n")
    app.run(debug=True, port=5000)
