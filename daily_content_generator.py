"""
Daily Content Generator — The Prop Center
Generates 3 social posts per day for balloon artists and event decorators:
  Post 1: Viral video repost (finds trending content to reshare)
  Post 2: AI-generated product spotlight post
  Post 3: AI-generated inspiration/tips post

Output: JSON file with all 3 posts ready for Make.com or direct API posting.

Usage:
    python daily_content_generator.py                  # Generate today's 3 posts
    python daily_content_generator.py --preview        # Print posts, don't save
    python daily_content_generator.py --post-type all  # All 3 (default)
    python daily_content_generator.py --post-type product   # Product post only
    python daily_content_generator.py --post-type inspiration  # Inspiration only
"""

import os
import json
import random
import argparse
import requests
import anthropic
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

STORE_URL = os.getenv("SHOPIFY_STORE_URL", "thepropcenter.myshopify.com")
ACCESS_TOKEN = os.getenv("SHOPIFY_ACCESS_TOKEN")
API_VERSION = os.getenv("SHOPIFY_API_VERSION", "2024-01")
BASE_URL = f"https://{STORE_URL}/admin/api/{API_VERSION}"
SHOPIFY_HEADERS = {
    "X-Shopify-Access-Token": ACCESS_TOKEN,
    "Content-Type": "application/json",
}

claude_client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

BRAND_VOICE = """
You are the social media voice for THE PROP CENTER — a store built specifically
for balloon artists, event decorators, and party professionals.

Brand personality:
- Enthusiastic and knowledgeable about event decoration
- Speaks peer-to-peer (decorator to decorator), not salesy
- Celebrates creativity and professionalism
- Uses industry language naturally (installations, backdrops, foil bouquets, etc.)
- Emojis: use sparingly, only where they add energy (🎈🎉✨)

The audience: small business owners running balloon and event decoration companies.
They want tips, inspiration, product ideas, and content that helps their business grow.
"""

# Hashtag sets for the niche
HASHTAGS_PRODUCT = [
    "#balloonbusiness", "#eventdecor", "#balloonartist", "#partydecorator",
    "#propcenter", "#eventprofs", "#balloondesign", "#decoratorsofinstagram",
    "#partysupplies", "#eventplanning", "#balloondecor", "#weddingdecor",
]

HASHTAGS_INSPIRATION = [
    "#balloondecor", "#eventinspo", "#partyinspo", "#balloonart",
    "#eventdesign", "#decorationideas", "#ballooninstallation",
    "#weddinginspo", "#birthdaydecor", "#corporateevents",
]

HASHTAGS_REPOST = [
    "#balloonartist", "#balloondecor", "#eventdecor", "#partydecorator",
    "#balloonbusiness", "#balloondesign", "#propcenter",
]

# Inspiration topic pool — rotates to keep content fresh
INSPIRATION_TOPICS = [
    "5 balloon arch color combos that are trending this season",
    "How to price your balloon installations for corporate events",
    "The balloon supplies every professional decorator needs in their kit",
    "3 mistakes new balloon business owners make (and how to avoid them)",
    "How to upsell clients from simple balloon bunches to full installations",
    "Quick tips for transporting large balloon arrangements without damage",
    "How to build a balloon business portfolio that attracts premium clients",
    "Organic vs foil balloons: when to use each for maximum impact",
    "Behind-the-scenes setup tips for large wedding balloon arches",
    "How to handle last-minute event decoration requests professionally",
    "Building recurring clients from one-time birthday party bookings",
    "The best social media content types for balloon decoration businesses",
]

# CTA pool — rotates to avoid repetition
PRODUCT_CTAS = [
    "Link in bio — shop now at thepropcenter.com",
    "Available now at thepropcenter.com — link in bio",
    "Shop this and more at thepropcenter.com",
    "Get yours at thepropcenter.com before it sells out",
]

INSPIRATION_CTAS = [
    "Follow us for more tips for event pros. 🎈",
    "Save this post for your next event planning session.",
    "Tag a fellow decorator who needs to see this!",
    "Follow The Prop Center for weekly tips for balloon and event pros.",
]


def get_random_product():
    """Fetch a random product from the store to feature."""
    if not ACCESS_TOKEN:
        # Return dummy product for testing without API
        return {
            "title": "Professional LED Balloon Light Kit",
            "body_html": "<p>Light up your events with our LED kit.</p>",
            "images": [{"src": "https://example.com/image.jpg"}],
            "variants": [{"price": "29.99"}],
        }

    resp = requests.get(
        f"{BASE_URL}/products.json",
        headers=SHOPIFY_HEADERS,
        params={"limit": 250},
    )
    resp.raise_for_status()
    products = resp.json().get("products", [])
    # Filter to products that have images
    with_images = [p for p in products if p.get("images")]
    return random.choice(with_images) if with_images else random.choice(products)


def generate_product_post(product):
    """Generate a product spotlight post for Instagram/TikTok caption."""
    price = product.get("variants", [{}])[0].get("price", "")
    price_str = f"${price}" if price else ""
    image_url = product.get("images", [{}])[0].get("src", "")

    prompt = f"""
Write a social media caption for this product post on Instagram and TikTok.

Product: {product['title']}
Price: {price_str}
Description: {product.get('body_html', '')[:300]}

Requirements:
- 3-5 sentences max
- Hook in the first line (make a decorator stop scrolling)
- Mention one specific use case at an event (wedding, birthday, corporate, etc.)
- End with this CTA: "{random.choice(PRODUCT_CTAS)}"
- Add these hashtags at the end on a new line: {" ".join(random.sample(HASHTAGS_PRODUCT, 8))}
- Do not use more than 2 emojis total

Return only the caption text, nothing else.
"""

    message = claude_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=300,
        system=BRAND_VOICE,
        messages=[{"role": "user", "content": prompt}],
    )

    caption = message.content[0].text.strip()
    return {
        "type": "product_spotlight",
        "product_title": product["title"],
        "product_id": product.get("id"),
        "image_url": image_url,
        "caption": caption,
        "platforms": ["instagram", "tiktok"],
        "generated_at": datetime.now().isoformat(),
    }


def generate_inspiration_post():
    """Generate a tips/inspiration post."""
    topic = random.choice(INSPIRATION_TOPICS)

    prompt = f"""
Write a social media tips post for balloon artists and event decorators.

Topic: {topic}

Requirements:
- Start with a bold hook/question (make them stop scrolling)
- 3-5 bullet points or a short numbered list with real, actionable advice
- Keep each point concise (1-2 lines max)
- End with: "{random.choice(INSPIRATION_CTAS)}"
- Add hashtags on a new line at the end: {" ".join(random.sample(HASHTAGS_INSPIRATION, 8))}
- Maximum 150 words before hashtags
- Use line breaks between points for readability

Return only the caption text, nothing else.
"""

    message = claude_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=350,
        system=BRAND_VOICE,
        messages=[{"role": "user", "content": prompt}],
    )

    caption = message.content[0].text.strip()
    return {
        "type": "inspiration_tips",
        "topic": topic,
        "caption": caption,
        "image_prompt": generate_image_prompt(topic),
        "platforms": ["instagram", "tiktok"],
        "generated_at": datetime.now().isoformat(),
    }


def generate_image_prompt(topic):
    """Generate a prompt for AI image generation (DALL-E, Midjourney, etc.)."""
    prompt = f"""
Write a short image generation prompt for this social media post topic:
"{topic}"

The image should be:
- Relevant to balloon/event decoration
- Professional and visually striking
- Suitable for Instagram/TikTok
- Bright, colorful, high-energy

Return ONLY the image generation prompt (max 50 words), nothing else.
"""
    message = claude_client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=100,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text.strip()


def generate_repost_brief():
    """
    Generate a search brief and caption template for the daily viral repost.
    Since we can't auto-pull from Instagram/TikTok without their APIs,
    this produces a brief for what to search + a caption to use when reposting.
    """
    search_terms = [
        "balloon arch wedding", "balloon installation birthday",
        "event decor ideas", "balloon business tips", "party decoration setup",
        "balloon garland DIY", "balloon ceiling decor", "luxury event decor",
        "balloon mosaic setup", "organic balloon arch",
    ]
    chosen_term = random.choice(search_terms)

    caption_template = f"""Credit: @[TAG ORIGINAL CREATOR HERE] ✨

This is exactly the kind of stunning work that balloon decorators are doing right now. If you're looking to level up your setups, The Prop Center has everything you need.

{" ".join(random.sample(HASHTAGS_REPOST, 6))}
"""

    return {
        "type": "viral_repost",
        "search_term": chosen_term,
        "search_instructions": (
            f"Search TikTok and Instagram for: '{chosen_term}' "
            f"— pick a video with 10K+ views from the last 30 days. "
            f"Download it, tag the original creator, and use the caption below."
        ),
        "caption_template": caption_template,
        "platforms": ["instagram", "tiktok"],
        "generated_at": datetime.now().isoformat(),
    }


def main():
    parser = argparse.ArgumentParser(description="Daily Content Generator for The Prop Center")
    parser.add_argument("--preview", action="store_true", help="Print posts, don't save")
    parser.add_argument(
        "--post-type",
        choices=["all", "product", "inspiration", "repost"],
        default="all",
        help="Which post type to generate",
    )
    args = parser.parse_args()

    if not os.getenv("ANTHROPIC_API_KEY"):
        print("ERROR: ANTHROPIC_API_KEY not set in .env")
        return

    today = datetime.now().strftime("%Y-%m-%d")
    posts = []

    print(f"\nGenerating content for {today}...\n")

    if args.post_type in ("all", "repost"):
        print("Post 1: Viral Repost Brief...")
        posts.append(generate_repost_brief())
        print("Done.")

    if args.post_type in ("all", "product"):
        print("Post 2: Product Spotlight...")
        product = get_random_product()
        posts.append(generate_product_post(product))
        print("Done.")

    if args.post_type in ("all", "inspiration"):
        print("Post 3: Inspiration/Tips Post...")
        posts.append(generate_inspiration_post())
        print("Done.")

    output = {
        "date": today,
        "store": "The Prop Center",
        "posts": posts,
        "posting_schedule": {
            "post_1_repost": "9:00 AM",
            "post_2_product": "1:00 PM",
            "post_3_inspiration": "6:00 PM",
        },
    }

    if args.preview:
        print("\n" + "=" * 60)
        print("PREVIEW — POSTS FOR TODAY")
        print("=" * 60)
        for i, post in enumerate(posts, 1):
            print(f"\n--- POST {i}: {post['type'].upper()} ---")
            if post["type"] == "viral_repost":
                print(f"Search for: {post['search_term']}")
                print(f"Instructions: {post['search_instructions']}")
                print(f"\nCaption:\n{post['caption_template']}")
            else:
                print(f"Caption:\n{post['caption']}")
                if post.get("image_prompt"):
                    print(f"\nImage Prompt: {post['image_prompt']}")
        print("=" * 60)
    else:
        filename = f"posts_{today}.json"
        with open(filename, "w") as f:
            json.dump(output, f, indent=2)
        print(f"\nSaved to {filename}")
        print("Send this file to Make.com webhook or use post_to_social.py to publish.")


if __name__ == "__main__":
    main()
