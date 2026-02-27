"""
Shopify Store Audit & Fix Script — The Prop Center
Connects to your Shopify store, finds issues, and fixes them.

Usage:
    pip install requests python-dotenv
    python shopify_audit.py --audit          # Just audit, no changes
    python shopify_audit.py --fix-pricing    # Fix broken sale prices
    python shopify_audit.py --fix-all        # Fix everything
"""

import os
import json
import argparse
import requests
from dotenv import load_dotenv

load_dotenv()

STORE_URL = os.getenv("SHOPIFY_STORE_URL", "thepropcenter.myshopify.com")
ACCESS_TOKEN = os.getenv("SHOPIFY_ACCESS_TOKEN")
API_VERSION = os.getenv("SHOPIFY_API_VERSION", "2024-01")

BASE_URL = f"https://{STORE_URL}/admin/api/{API_VERSION}"
HEADERS = {
    "X-Shopify-Access-Token": ACCESS_TOKEN,
    "Content-Type": "application/json",
}


def api_get(endpoint, params=None):
    resp = requests.get(f"{BASE_URL}/{endpoint}", headers=HEADERS, params=params)
    resp.raise_for_status()
    return resp.json()


def api_put(endpoint, data):
    resp = requests.put(f"{BASE_URL}/{endpoint}", headers=HEADERS, json=data)
    resp.raise_for_status()
    return resp.json()


def get_all_products():
    """Fetch all products with pagination."""
    products = []
    params = {"limit": 250}
    while True:
        data = api_get("products.json", params)
        batch = data.get("products", [])
        products.extend(batch)
        if len(batch) < 250:
            break
        params["page_info"] = data.get("next_page_info")
    return products


def audit_pricing(products):
    """Find products where compare_at_price < price (broken sale pricing)."""
    broken = []
    for p in products:
        for v in p.get("variants", []):
            price = float(v.get("price", 0) or 0)
            compare = float(v.get("compare_at_price", 0) or 0)
            if compare > 0 and compare < price:
                broken.append({
                    "product_id": p["id"],
                    "product_title": p["title"],
                    "variant_id": v["id"],
                    "price": price,
                    "compare_at_price": compare,
                    "issue": "compare_at_price is LESS than price — sale tag is wrong",
                })
    return broken


def fix_pricing(broken_products):
    """
    Fix broken pricing by swapping compare_at_price and price,
    so the sale is displayed correctly.
    """
    fixed = []
    for item in broken_products:
        # Swap: the higher number should be compare_at_price (crossed-out original)
        # the lower number should be price (sale price)
        new_compare = item["price"]       # the currently higher number becomes original
        new_price = item["compare_at_price"]  # the lower becomes the sale price

        payload = {
            "variant": {
                "id": item["variant_id"],
                "price": str(new_price),
                "compare_at_price": str(new_compare),
            }
        }
        result = api_put(
            f"variants/{item['variant_id']}.json", payload
        )
        fixed.append(result)
        print(f"  Fixed: {item['product_title']} — price now ${new_price}, was ${new_compare}")
    return fixed


def audit_descriptions(products):
    """Find products with short or generic descriptions."""
    weak = []
    for p in products:
        body = p.get("body_html", "") or ""
        text = body.replace("<br>", " ").replace("</p>", " ")
        word_count = len(text.split())
        if word_count < 50:
            weak.append({
                "product_id": p["id"],
                "title": p["title"],
                "word_count": word_count,
                "current_description": body[:200],
            })
    return weak


def audit_collections():
    """List all collections so we can identify clutter."""
    custom = api_get("custom_collections.json")
    smart = api_get("smart_collections.json")
    all_collections = (
        custom.get("custom_collections", [])
        + smart.get("smart_collections", [])
    )
    return all_collections


def print_audit_report(products, broken_pricing, weak_descriptions, collections):
    print("\n" + "=" * 60)
    print("  THE PROP CENTER — STORE AUDIT REPORT")
    print("=" * 60)

    print(f"\nTOTAL PRODUCTS: {len(products)}")
    print(f"TOTAL COLLECTIONS: {len(collections)}")

    print(f"\n--- PRICING ISSUES ({len(broken_pricing)} found) ---")
    if broken_pricing:
        for item in broken_pricing:
            print(f"  [!] {item['product_title']}")
            print(f"      Price: ${item['price']}  |  Compare-at: ${item['compare_at_price']}")
            print(f"      Issue: {item['issue']}")
    else:
        print("  No pricing issues found.")

    print(f"\n--- WEAK DESCRIPTIONS ({len(weak_descriptions)} products) ---")
    if weak_descriptions:
        for item in weak_descriptions[:10]:
            print(f"  [!] {item['title']} — only {item['word_count']} words")
    else:
        print("  All descriptions look okay.")

    print(f"\n--- COLLECTIONS ---")
    for c in collections:
        print(f"  - {c['title']} (ID: {c['id']})")

    print("\n" + "=" * 60)
    print("  Run with --fix-pricing to auto-fix pricing issues")
    print("  Run with --fix-descriptions to rewrite weak descriptions")
    print("=" * 60 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Shopify Store Audit & Fix Tool")
    parser.add_argument("--audit", action="store_true", help="Run audit only")
    parser.add_argument("--fix-pricing", action="store_true", help="Fix broken sale prices")
    parser.add_argument("--fix-descriptions", action="store_true", help="Rewrite weak descriptions with AI")
    parser.add_argument("--fix-all", action="store_true", help="Run all fixes")
    args = parser.parse_args()

    if not ACCESS_TOKEN:
        print("ERROR: SHOPIFY_ACCESS_TOKEN not set in .env file")
        print("Copy .env.example to .env and fill in your credentials.")
        return

    print("Connecting to Shopify store...")
    products = get_all_products()
    print(f"Loaded {len(products)} products.")

    broken_pricing = audit_pricing(products)
    weak_descriptions = audit_descriptions(products)
    collections = audit_collections()

    print_audit_report(products, broken_pricing, weak_descriptions, collections)

    if args.fix_pricing or args.fix_all:
        if broken_pricing:
            print(f"\nFixing {len(broken_pricing)} pricing issues...")
            fix_pricing(broken_pricing)
            print("Pricing fixed!")
        else:
            print("No pricing issues to fix.")

    if args.fix_descriptions or args.fix_all:
        print("\nDescription rewriting requires: python description_rewriter.py")
        print("(Separate script to avoid API rate limits)")


if __name__ == "__main__":
    main()
