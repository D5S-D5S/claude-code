"""
Solar Surge — Multi-Client Ad Performance Dashboard
======================================================
Flask web app showing live Facebook metrics for SGS and HES clients.

Run:
  python dashboard/app.py
  → http://localhost:5000
"""

import json
import os
import sys
from datetime import datetime, timedelta

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request
from flask_cors import CORS

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from analyzer import (
    MIN_IMPRESSIONS_FOR_VERDICT,
    CPL_SCALE_MAX, CPL_WATCH_MAX, CTR_SCALE_MIN, CTR_WATCH_MIN,
    fetch_ad_insights, verdict, build_recommendation, init_api, analyse_client,
    CLIENTS,
)

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLIENTS_DIR = os.path.join(BASE_DIR, "clients")

app = Flask(__name__)
CORS(app)


def load_json(path):
    with open(path) as f:
        return json.load(f)


def client_path(client, filename):
    return os.path.join(CLIENTS_DIR, client, filename)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/clients")
def api_clients():
    """Return list of configured clients with their campaign status."""
    result = {}
    for key, label in CLIENTS.items():
        try:
            cfg = load_json(client_path(key, "campaign_config.json"))
            launched = load_json(client_path(key, "launched_ads.json"))
            result[key] = {
                "label": label,
                "campaign_id": launched["campaign"].get("id"),
                "campaign_name": launched["campaign"].get("name"),
                "ad_count": len(launched["ads"]),
                "postcode_areas": cfg.get("postcode_areas", []),
                "finance_available": cfg.get("finance_available", False),
                "mcs_certified": cfg.get("mcs_certified", True),
                "system_size": cfg.get("system_size_kw") or cfg.get("system_size_kwh"),
            }
        except Exception as e:
            result[key] = {"label": label, "error": str(e)}
    return jsonify(result)


@app.route("/api/ads/<client>")
def api_ads(client):
    """Return live performance for all ads of a client."""
    if client not in CLIENTS:
        return jsonify({"error": f"Unknown client: {client}"}), 404

    days = int(request.args.get("days", 7))
    try:
        init_api()
        launched = load_json(client_path(client, "launched_ads.json"))
        cfg = load_json(client_path(client, "campaign_config.json"))
        copy_lookup = {
            a["name_tag"]: a
            for a in load_json(client_path(client, "copy_bank.json"))["ads"]
        }
        ads = launched.get("ads", [])
        results = []

        for ad_record in ads:
            metrics = fetch_ad_insights(ad_record["id"], days=days)
            label, explanation = verdict(metrics)
            copy = copy_lookup.get(ad_record["name"], {})
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

        return jsonify({
            "client": client,
            "client_label": CLIENTS[client],
            "campaign": launched["campaign"],
            "ad_set": launched["ad_set"],
            "ads": results,
            "totals": {
                "spend": round(total_spend, 2),
                "leads": total_leads,
                "cpl": round(total_spend / total_leads, 2) if total_leads else None,
            },
            "config": {
                "postcode_areas": cfg.get("postcode_areas", []),
                "finance_available": cfg.get("finance_available", False),
                "mcs_certified": cfg.get("mcs_certified", True),
                "installs_per_month": cfg.get("installs_per_month"),
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
    """7-day daily breakdown for a single ad."""
    try:
        init_api()
        from facebook_business.adobjects.ad import Ad
        ad = Ad(ad_id)
        insights = ad.get_insights(
            fields=["impressions", "spend", "ctr", "actions", "date_start"],
            params={"time_increment": 1, "date_preset": "last_7d"}
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
                "cpl": round(spend / leads, 2) if leads else None,
            })
        return jsonify({"ad_id": ad_id, "history": history})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/copy/<client>")
def api_copy(client):
    """Return full copy bank for a client."""
    if client not in CLIENTS:
        return jsonify({"error": f"Unknown client: {client}"}), 404
    try:
        return jsonify(load_json(client_path(client, "copy_bank.json")))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    print("\n🌞 Solar Surge Dashboard → http://localhost:5000\n")
    app.run(debug=True, port=5000)
