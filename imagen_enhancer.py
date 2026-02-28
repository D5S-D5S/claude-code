"""
imagen_enhancer.py
==================
Enhances Shopify product images using Google Imagen 3 (Vertex AI).

For each product it:
  1. Downloads the current featured image
  2. Sends it to Imagen 3 with a luxury-studio prompt (edit / inpaint)
  3. Uploads the enhanced image back to Shopify via the REST API
  4. Sets it as the product's featured image

Setup (one-time):
  pip install google-cloud-aiplatform pillow requests python-dotenv

Credentials:
  - Create a GCP service account with "Vertex AI User" role
  - Download the JSON key and set GOOGLE_APPLICATION_CREDENTIALS below
  - Enable the Vertex AI API in your GCP project

Usage:
  python imagen_enhancer.py --dry-run          # preview which products would be processed
  python imagen_enhancer.py --limit 3          # enhance first 3 products
  python imagen_enhancer.py                    # enhance all products
  python imagen_enhancer.py --product-id 123   # enhance a single product by ID
"""

import os
import io
import sys
import json
import time
import base64
import argparse
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# ── Shopify credentials (from .env) ─────────────────────────────────────────
SHOPIFY_STORE    = os.getenv("SHOPIFY_STORE_URL", "")          # e.g. 521086-82.myshopify.com
SHOPIFY_TOKEN    = os.getenv("SHOPIFY_ACCESS_TOKEN", "")
SHOPIFY_VERSION  = os.getenv("SHOPIFY_API_VERSION", "2024-01")
SHOPIFY_BASE     = f"https://{SHOPIFY_STORE}/admin/api/{SHOPIFY_VERSION}"

# ── Google / Vertex AI credentials ──────────────────────────────────────────
# Option A: path to service-account JSON key
GCP_KEY_FILE     = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "gcp_service_account.json")
# Option B: set these directly if you prefer env vars
GCP_PROJECT_ID   = os.getenv("GCP_PROJECT_ID", "YOUR_GCP_PROJECT_ID")
GCP_LOCATION     = os.getenv("GCP_LOCATION",    "us-central1")

# Imagen 3 model
IMAGEN_MODEL     = "imagegeneration@006"   # Imagen 3 GA model ID on Vertex AI

# Enhancement prompt — locked down so every image shares the exact same visual style
ENHANCEMENT_PROMPT = (
    "Pure white seamless studio background (#FFFFFF), identical for all images. "
    "Soft diffuse overhead lighting with a single gentle fill light from the left. "
    "Product centred with 10% padding on all sides. "
    "Subtle soft-edged drop shadow directly beneath the product, opacity 20%. "
    "No gradients, no reflections, no props, no text overlays. "
    "Keep exact product colours, textures, and proportions. "
    "Final result: high-end e-commerce product photo, 2000x2000 pixels, square crop."
)

# Path to the resume log — completed product IDs are stored here
PROGRESS_LOG = Path(__file__).parent / "enhanced_products.json"

HEADERS = {
    "X-Shopify-Access-Token": SHOPIFY_TOKEN,
    "Content-Type": "application/json",
}


# ── Shopify helpers ──────────────────────────────────────────────────────────

def get_all_products():
    products, page_info = [], None
    while True:
        params = {"limit": 250, "fields": "id,title,images"}
        if page_info:
            params["page_info"] = page_info
        r = requests.get(f"{SHOPIFY_BASE}/products.json", headers=HEADERS, params=params)
        r.raise_for_status()
        batch = r.json().get("products", [])
        products.extend(batch)
        link = r.headers.get("Link", "")
        if 'rel="next"' not in link:
            break
        # parse next page_info from Link header
        for part in link.split(","):
            if 'rel="next"' in part:
                page_info = part.split("page_info=")[1].split("&")[0].rstrip(">")
                break
    return products


def download_image(url: str) -> bytes:
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    return r.content


def upload_image_to_shopify(product_id: int, image_bytes: bytes, alt: str = "") -> dict:
    """Upload image bytes as base64 to Shopify and return the created image object."""
    payload = {
        "image": {
            "attachment": base64.b64encode(image_bytes).decode("utf-8"),
            "filename":   f"enhanced_{product_id}.jpg",
            "alt":        alt or "Enhanced product image",
            "position":   1,
        }
    }
    r = requests.post(
        f"{SHOPIFY_BASE}/products/{product_id}/images.json",
        headers=HEADERS,
        json=payload,
    )
    r.raise_for_status()
    return r.json().get("image", {})


def delete_image(product_id: int, image_id: int):
    requests.delete(
        f"{SHOPIFY_BASE}/products/{product_id}/images/{image_id}.json",
        headers=HEADERS,
    )


# ── Vertex AI / Imagen 3 helpers ─────────────────────────────────────────────

def get_vertex_client():
    """Initialise Vertex AI. Raises ImportError if SDK not installed."""
    try:
        import vertexai
        from vertexai.preview.vision_models import ImageGenerationModel
    except ImportError:
        sys.exit(
            "ERROR: google-cloud-aiplatform is not installed.\n"
            "Run: pip install google-cloud-aiplatform"
        )

    # Authenticate
    if os.path.exists(GCP_KEY_FILE):
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = GCP_KEY_FILE

    vertexai.init(project=GCP_PROJECT_ID, location=GCP_LOCATION)
    return ImageGenerationModel.from_pretrained(IMAGEN_MODEL)


def enhance_image(model, image_bytes: bytes) -> bytes:
    """
    Send image to Imagen 3 for editing and return enhanced JPEG bytes.
    Uses the edit_image() method (inpainting / style transfer).
    """
    from vertexai.preview.vision_models import Image as VertexImage

    source_image = VertexImage(image_bytes=image_bytes)
    response = model.edit_image(
        base_image=source_image,
        prompt=ENHANCEMENT_PROMPT,
        number_of_images=1,
        # guidance_scale controls how strictly the prompt is followed (1–20)
        guidance_scale=12,
    )
    if not response.images:
        raise RuntimeError("Imagen 3 returned no images.")
    return response.images[0]._image_bytes


def standardise_image(image_bytes: bytes, size: int = 2000) -> bytes:
    """
    Paste the image onto a pure-white 2000×2000 canvas with centred padding.
    Guarantees every uploaded image is pixel-identical in dimensions and
    background colour, regardless of what Imagen 3 returns.
    """
    from PIL import Image

    img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    canvas = Image.new("RGB", (size, size), (255, 255, 255))
    img.thumbnail((size, size), Image.LANCZOS)
    offset = ((size - img.width) // 2, (size - img.height) // 2)
    canvas.paste(img, offset, mask=img.split()[3])
    buf = io.BytesIO()
    canvas.save(buf, format="JPEG", quality=95, optimize=True)
    return buf.getvalue()


# ── Main ─────────────────────────────────────────────────────────────────────

def load_progress() -> set:
    """Return set of already-enhanced product IDs from the progress log."""
    if PROGRESS_LOG.exists():
        return set(json.loads(PROGRESS_LOG.read_text()))
    return set()


def save_progress(done: set):
    PROGRESS_LOG.write_text(json.dumps(sorted(done), indent=2))


def process_product(model, product: dict, dry_run: bool = False, done: set = None):
    pid   = product["id"]
    title = product["title"]
    images = product.get("images", [])

    if done and pid in done:
        print(f"  SKIP  {title} — already enhanced")
        return

    if not images:
        print(f"  SKIP  {title} — no images")
        return

    featured = images[0]
    src_url  = featured["src"]

    print(f"\n  Processing: {title}")
    print(f"    Image URL : {src_url}")

    if dry_run:
        print(f"    DRY RUN   — would enhance and re-upload")
        return

    print(f"    Downloading original image...")
    original_bytes = download_image(src_url)

    print(f"    Sending to Imagen 3 ({IMAGEN_MODEL})...")
    try:
        enhanced_bytes = enhance_image(model, original_bytes)
    except Exception as e:
        print(f"    ERROR enhancing: {e}")
        return

    print(f"    Standardising to 2000×2000 white canvas...")
    enhanced_bytes = standardise_image(enhanced_bytes)

    print(f"    Uploading enhanced image to Shopify...")
    new_img = upload_image_to_shopify(pid, enhanced_bytes, alt=featured.get("alt", title))

    # Delete the old featured image so the new one takes position 1
    print(f"    Removing old image (ID {featured['id']})...")
    delete_image(pid, featured["id"])

    print(f"    Done — new image ID: {new_img.get('id')}")

    if done is not None:
        done.add(pid)
        save_progress(done)


def main():
    parser = argparse.ArgumentParser(description="Enhance Shopify product images with Imagen 3")
    parser.add_argument("--dry-run",    action="store_true", help="Preview without making changes")
    parser.add_argument("--limit",      type=int, default=0, help="Max products to process (0 = all)")
    parser.add_argument("--product-id", type=int, default=0, help="Process a single product by ID")
    parser.add_argument("--reset",      action="store_true", help="Clear the progress log and re-process all products")
    args = parser.parse_args()

    # Validate credentials
    if not SHOPIFY_TOKEN:
        sys.exit("ERROR: SHOPIFY_ACCESS_TOKEN not set in .env")
    if GCP_PROJECT_ID == "YOUR_GCP_PROJECT_ID":
        sys.exit(
            "ERROR: GCP_PROJECT_ID is not configured.\n"
            "Set GCP_PROJECT_ID in your .env file or edit this script directly."
        )

    # Progress log — lets long runs be safely interrupted and resumed
    if args.reset and PROGRESS_LOG.exists():
        PROGRESS_LOG.unlink()
        print("Progress log cleared — will re-process all products.")
    done = load_progress()
    if done:
        print(f"Resuming — {len(done)} products already enhanced, will skip them.")

    print("Connecting to Shopify...")
    if args.product_id:
        r = requests.get(f"{SHOPIFY_BASE}/products/{args.product_id}.json", headers=HEADERS)
        r.raise_for_status()
        products = [r.json()["product"]]
    else:
        print("Fetching all products...")
        products = get_all_products()
        products = [p for p in products if p.get("images")]

    if args.limit:
        products = products[: args.limit]

    print(f"Products to process: {len(products)} ({len(done)} already done, will skip)")

    if not args.dry_run:
        print("Initialising Vertex AI / Imagen 3...")
        model = get_vertex_client()
    else:
        model = None
        print("DRY RUN — no changes will be made\n")

    for product in products:
        process_product(model, product, dry_run=args.dry_run, done=done)
        if not args.dry_run:
            time.sleep(1)  # stay within Shopify rate limits

    print(f"\nDone. {len(done)} total products enhanced.")


if __name__ == "__main__":
    main()
