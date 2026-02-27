# The Prop Center — Store Automation

Automation toolkit for thepropcenter.com — Shopify store management and daily social posting for balloon artists and event decorators.

## Quick Start

```bash
pip install -r requirements.txt
cp .env.example .env
# Fill in your credentials in .env
```

## Scripts

### 1. Store Audit & Pricing Fix
```bash
python shopify_audit.py --audit          # Audit only, no changes
python shopify_audit.py --fix-pricing    # Fix broken sale prices
python shopify_audit.py --fix-all        # Fix pricing + report everything
```
Run this first. Finds and fixes the broken pricing issue (bounce house showing $2,303 sale vs $1,150 original).

### 2. AI Product Description Rewriter
```bash
python description_rewriter.py --dry-run     # Preview rewrites
python description_rewriter.py --limit 5     # Rewrite 5 products
python description_rewriter.py --all         # Rewrite all thin descriptions
```
Rewrites every product description to speak directly to balloon artists and event decorators.

### 3. Daily Content Generator (3 posts/day)
```bash
python daily_content_generator.py --preview            # Preview today's posts
python daily_content_generator.py                      # Generate + save to JSON
python daily_content_generator.py --post-type product  # Product post only
```
Generates 3 posts per day:
- **9am** — Viral repost brief (search term + caption for reposting)
- **1pm** — AI product spotlight (pulls a random product from your store)
- **6pm** — Tips/inspiration post for balloon decorators

### 4. Make.com Workflow
Import `make_workflow_blueprint.json` into Make.com to automate posting to Instagram and TikTok.

## Credentials Needed

| Credential | Where to get it |
|---|---|
| `SHOPIFY_ACCESS_TOKEN` | Shopify Admin → Settings → Apps → Develop Apps → Create app → Admin API access token |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| Instagram | Make.com → Connections → Instagram for Business |
| TikTok | Make.com → Connections → TikTok |

## Priority Order

1. Run `shopify_audit.py --fix-pricing` first (fixes the pricing trust issue)
2. Run `description_rewriter.py --limit 10` to improve top products
3. Set up Make.com workflow for daily posting
4. Schedule `daily_content_generator.py` to run daily

## Security Note

Never commit your `.env` file. Share credentials only through secure means, never in chat messages.