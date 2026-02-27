"""
AI-Powered Product Description Rewriter — The Prop Center
Rewrites product descriptions to speak directly to balloon artists and event decorators.

Usage:
    pip install requests python-dotenv anthropic
    python description_rewriter.py --dry-run     # Preview rewrites, no changes saved
    python description_rewriter.py --limit 5      # Rewrite first 5 weak products
    python description_rewriter.py --all          # Rewrite all weak descriptions
"""

import os
import json
import time
import argparse
import requests
import anthropic
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

claude_client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

# Niche context injected into every rewrite prompt
NICHE_CONTEXT = """
You are writing for THE PROP CENTER, an online store serving balloon artists,
event decorators, party planners, wedding decorators, and corporate event
professionals. The customers are small business owners who:
- Run balloon decoration businesses (weddings, birthdays, corporates, quinceañeras)
- Need professional, reliable equipment and supplies
- Care about quality, delivery speed, and value for their business
- Want to impress their own clients with stunning event setups

Tone: Professional but approachable. Speak directly to them as a fellow
business owner who understands their world.
"""

REWRITE_PROMPT = """
Here is a product from The Prop Center store:

Product Title: {title}
Current Description: {current_description}
Product Type: {product_type}
Tags: {tags}

Rewrite the product description following these rules:
1. Start with a bold hook that speaks directly to event decorators/balloon artists
2. 2-3 sentences on what the product does and why it matters for their business
3. A short bullet list (3-5 points) of key features/benefits
4. End with a brief call to action
5. Use HTML formatting (<strong>, <ul><li>, <p>)
6. Keep it under 200 words total
7. Never mention "dropshipping" or supplier names
8. Focus on how this helps them WOW their clients and grow their business

Return ONLY the HTML description, no explanation.
"""


def api_get(endpoint, params=None):
    resp = requests.get(f"{BASE_URL}/{endpoint}", headers=HEADERS, params=params)
    resp.raise_for_status()
    return resp.json()


def api_put(endpoint, data):
    resp = requests.put(f"{BASE_URL}/{endpoint}", headers=HEADERS, json=data)
    resp.raise_for_status()
    return resp.json()


def get_products_needing_rewrite(min_word_count=50):
    """Get all products with thin or missing descriptions."""
    products = []
    params = {"limit": 250}
    all_products = []

    while True:
        data = api_get("products.json", params)
        batch = data.get("products", [])
        all_products.extend(batch)
        if len(batch) < 250:
            break

    for p in all_products:
        body = p.get("body_html", "") or ""
        text = body.replace("<br>", " ").replace("</p>", " ").replace("<p>", " ")
        word_count = len(text.split())
        if word_count < min_word_count:
            products.append(p)

    return products


def rewrite_description(product):
    """Use Claude to rewrite a single product description."""
    prompt = REWRITE_PROMPT.format(
        title=product.get("title", ""),
        current_description=product.get("body_html", "(no description)"),
        product_type=product.get("product_type", ""),
        tags=", ".join(product.get("tags", "").split(",")),
    )

    message = claude_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=500,
        system=NICHE_CONTEXT,
        messages=[{"role": "user", "content": prompt}],
    )

    return message.content[0].text.strip()


def update_product_description(product_id, new_description):
    """Push the rewritten description to Shopify."""
    payload = {
        "product": {
            "id": product_id,
            "body_html": new_description,
        }
    }
    return api_put(f"products/{product_id}.json", payload)


def main():
    parser = argparse.ArgumentParser(description="AI Product Description Rewriter")
    parser.add_argument("--dry-run", action="store_true", help="Preview without saving")
    parser.add_argument("--limit", type=int, default=None, help="Max products to rewrite")
    parser.add_argument("--all", action="store_true", help="Rewrite all weak descriptions")
    parser.add_argument("--min-words", type=int, default=50, help="Min word count threshold")
    args = parser.parse_args()

    if not ACCESS_TOKEN:
        print("ERROR: SHOPIFY_ACCESS_TOKEN not set in .env")
        return

    if not os.getenv("ANTHROPIC_API_KEY"):
        print("ERROR: ANTHROPIC_API_KEY not set in .env")
        return

    print(f"Fetching products with fewer than {args.min_words} words in description...")
    products = get_products_needing_rewrite(args.min_words)
    print(f"Found {len(products)} products needing rewrites.")

    if args.limit:
        products = products[: args.limit]
        print(f"Processing first {args.limit} products.")

    if not products:
        print("All products already have good descriptions!")
        return

    results = []
    for i, product in enumerate(products, 1):
        print(f"\n[{i}/{len(products)}] Rewriting: {product['title']}")

        new_description = rewrite_description(product)

        if args.dry_run:
            print("--- PREVIEW (not saved) ---")
            print(new_description[:500])
            print("---")
        else:
            update_product_description(product["id"], new_description)
            print(f"  Saved to Shopify.")
            results.append({"id": product["id"], "title": product["title"]})
            # Respect API rate limits
            time.sleep(0.5)

    if not args.dry_run:
        print(f"\nDone! Rewrote {len(results)} product descriptions.")
        with open("rewrite_log.json", "w") as f:
            json.dump(results, f, indent=2)
        print("Log saved to rewrite_log.json")


if __name__ == "__main__":
    main()
