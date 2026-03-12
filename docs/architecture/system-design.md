# GroceryHack — System Design

## Overview

GroceryHack is a weekly grocery and meal planning service that optimizes a user's shopping and meals around what's actually on sale near them. The product is an Ionic React app (deployed as a web app for trial, then to iOS and Android app stores) with a weekly email as the engagement trigger. Users get a personalized plan: meals to cook this week, what to buy, which store to buy it at, and how much they'll save.

The core insight: most meal planning apps start with recipes and generate a shopping list. GroceryHack does the opposite — it starts with what's cheap this week and builds the meal plan from that.

---

## Architecture Summary

Two cron jobs. One database. Two Claude API calls per cycle. Push notification + email out. Ionic React app for the full interactive experience. The entire codebase is TypeScript — frontend, backend API, and background pipelines.

```
Tuesday Night:   Fetch flyers → Claude parses → deals table
Wednesday AM:    For each user → match DB meals to deals → Claude fills gaps
                 → save new meals → check deal watchlist → build plan
                 → send push + email
```

---

## App Architecture: Ionic React + Capacitor

The app is built with Ionic React and Capacitor. One codebase deploys three ways:

**Trial period:** Deployed as a regular web app. Users click an email link and land in the app via their browser. No install required. Token-based access via URL. This is identical to the native experience minus push notifications, haptics, and camera.

**Post-validation:** Same codebase wrapped by Capacitor, submitted to iOS App Store and Google Play. Capacitor provides native access to push notifications (FCM/APNs), camera (for user-reported deals in v2), haptic feedback (for swipe gestures), and offline storage (for in-store shopping list access).

**Why Ionic React:** The entire project is TypeScript — frontend, backend, and pipelines. Ionic React means the frontend shares types directly with the backend via a shared types package. Capacitor adds native deployment with minimal extra code.

---

## Data Model (Postgres)

### users
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| email | text | unique |
| postal_code | text | |
| lat | float | geocoded from postal code |
| lng | float | geocoded from postal code |
| budget | decimal | weekly grocery budget |
| dietary_restrictions | text[] | e.g. ["vegetarian", "gluten-free"] |
| max_stores | int | 1 or 2 — how many stops they're willing to make |
| household_size | int | number of people eating (for meal portioning) |
| household_names | text[] | first names, e.g. ["Marcus", "Jess", "Lily"] — for Feeling Lucky |
| taste_profile | jsonb | weighted tags: {"chicken": 0.8, "asian": 0.7, ...} |
| stripe_customer_id | text | for $4/mo subscription |
| created_at | timestamp | |

### stores
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | e.g. "Kroger" |
| address | text | full street address |
| lat | float | geocoded from address |
| lng | float | geocoded from address |
| flyer_url | text | URL to weekly flyer page |
| submitted_by | uuid | FK → users.id |
| last_scraped_at | timestamp | |
| scrape_status | enum | 'ok', 'failed', 'needs_update' |
| created_at | timestamp | |

### deals
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| store_id | uuid | FK → stores.id |
| item_name | text | normalized name |
| category | text | e.g. "meat", "dairy", "produce" |
| sale_price | decimal | |
| regular_price | decimal | nullable if unknown |
| unit | text | "lb", "each", "oz", "kg" |
| deal_conditions | text | "BOGO", "limit 4", "member price" |
| valid_from | date | |
| valid_to | date | |
| source | enum | 'flyer', 'user_reported' — future-proofing for v2 |
| reported_by | uuid | nullable, FK → users.id, only for user-reported deals |
| report_photo_url | text | nullable, photo of price tag for user-reported deals |
| created_at | timestamp | |

### meals
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | e.g. "Honey Garlic Chicken Thighs" |
| description | text | one-line summary |
| tagline | text | punchy hook, e.g. "Crispy. Sticky. Ridiculously cheap." |
| ingredients | jsonb | [{name, quantity, unit}] — no prices, timeless |
| steps | text[] | 4-6 numbered steps |
| prep_time_minutes | int | |
| cook_time_minutes | int | |
| servings | int | |
| difficulty | enum | 'easy', 'medium' |
| filter_tags | text[] | ["vegetarian", "gluten-free", "dairy-free", etc.] |
| taste_tags | jsonb | {"protein": "chicken", "cuisine": "asian", "method": "stir-fry", "effort": "quick", "flavor": "savory"} |
| tips | text | optional cooking tip |
| ingredient_keywords | text[] | normalized ingredient names for deal matching |
| created_at | timestamp | |

### user_meal_preferences
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → users.id |
| meal_id | uuid | FK → meals.id |
| liked | boolean | true = swiped right, false = swiped left |
| swiped_at | timestamp | |

### deal_watchlist
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → users.id |
| item_keyword | text | normalized item name, e.g. "ny striploin" |
| category | text | e.g. "meat", "produce" |
| price_tier | enum | 'staple', 'premium', 'luxury' — auto-classified |
| benchmark_price | decimal | the sale price when user hearted it |
| benchmark_unit | text | "lb", "kg", "each" |
| store_id | uuid | nullable — null means any store |
| created_at | timestamp | |

### important_items
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → users.id |
| items | jsonb | [{name, quantity, flexible}] |
| submitted_at | timestamp | |

### weekly_plans
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → users.id |
| token | text | unique, used in web app URL |
| plan_data | jsonb | full plan: stops, meals, deals, totals |
| plan_data_alt | jsonb | alternate store count plan |
| watchlist_alerts | jsonb | any watched deals that fired this week |
| week_of | date | |
| created_at | timestamp | |

---

## Pipeline 1: Weekly Flyer Scrape (Tuesday Night)

> **Note:** Pseudocode below uses Python syntax for readability. Implementation is TypeScript (Node.js with Puppeteer for page rendering and @anthropic-ai/sdk for Claude API calls). See `scraper-pipeline.md` for the full specification including the Claude prompt template, vision-based extraction strategy, and error handling.

```python
# Pseudocode — runs as cron every Tuesday at 10pm

for store in db.query("SELECT * FROM stores WHERE scrape_status != 'disabled'"):
    
    # 1. Fetch the flyer page
    try:
        html = http_get(store.flyer_url)
    except:
        store.scrape_status = 'failed'
        notify_user(store.submitted_by, f"{store.name} flyer link is broken")
        continue
    
    # 2. Send to Claude for parsing
    response = claude.messages.create(
        model="claude-haiku-4-5-20251001",
        messages=[{
            "role": "user",
            "content": f"""Extract all grocery deals from this flyer page.
            
            Return JSON array:
            [{{
                "item_name": "Boneless Chicken Breast",
                "category": "meat",
                "sale_price": 2.49,
                "regular_price": 4.99,
                "unit": "lb",
                "deal_conditions": "limit 4 per customer",
                "valid_from": "2026-02-25",
                "valid_to": "2026-03-03"
            }}]
            
            Rules:
            - Normalize item names (no ALL CAPS, no brand-specific formatting)
            - Include unit (lb, oz, each, pack)
            - If regular price not shown, set to null
            - Include any conditions (BOGO, limit, member-only)
            - Only include food and household grocery items
            
            Page content:
            {html}"""
        }]
    )
    
    # 3. Parse and validate
    deals = json.loads(response.content[0].text)
    
    # 4. Clear old deals for this store, insert new ones
    db.execute("DELETE FROM deals WHERE store_id = %s", store.id)
    for deal in deals:
        db.insert("deals", store_id=store.id, **deal)
    
    store.last_scraped_at = now()
    store.scrape_status = 'ok'
```

**Cost per run:** ~$0.02 per store × 15 stores = ~$0.30/week

---

## Pipeline 2: Weekly Plan Generation (Wednesday Morning)

> See `planner-pipeline.md` for the full specification including Claude prompt templates, meal generation, optimizer, and the brand/location model.

```python
# Pseudocode — runs as cron every Wednesday at 7am

SEARCH_RADIUS_KM = 10

for user in db.query("SELECT * FROM users WHERE subscription_active = true"):
    
    # 1. Get user's important items list
    important_items = db.query(
        "SELECT items FROM important_items WHERE user_id = %s ORDER BY submitted_at DESC LIMIT 1",
        user.id
    )
    
    # 2. Find stores within radius
    nearby_stores = db.query("""
        SELECT s.*, haversine(s.lat, s.lng, %s, %s) as distance_km
        FROM stores s
        WHERE haversine(s.lat, s.lng, %s, %s) < %s
        ORDER BY distance_km
    """, user.lat, user.lng, user.lat, user.lng, SEARCH_RADIUS_KM)
    
    # 3. Get all active deals from nearby stores
    store_ids = [s.id for s in nearby_stores]
    deals = db.query("""
        SELECT d.*, s.name as store_name, s.address as store_address
        FROM deals d
        JOIN stores s ON d.store_id = s.id
        WHERE d.store_id = ANY(%s)
        AND CURRENT_DATE BETWEEN d.valid_from AND d.valid_to
    """, store_ids)
    
    # 4. Check deal watchlist
    watchlist = db.query(
        "SELECT * FROM deal_watchlist WHERE user_id = %s", user.id
    )
    watchlist_alerts = []
    for watch in watchlist:
        matching_deals = [d for d in deals 
            if fuzzy_match(d.item_name, watch.item_keyword)
            and d.sale_price <= watch.benchmark_price
            and (watch.store_id is None or d.store_id == watch.store_id)]
        if matching_deals:
            best = min(matching_deals, key=lambda d: d.sale_price)
            watchlist_alerts.append({
                "item": best.item_name,
                "store": best.store_name,
                "sale_price": best.sale_price,
                "regular_price": best.regular_price,
                "benchmark_price": watch.benchmark_price,
                "price_tier": watch.price_tier,
            })
    
    # 5. Find existing meals that match user's filters AND current deals
    user_filters = user.dietary_restrictions
    deal_ingredients = extract_ingredient_keywords(deals)
    
    matching_meals = db.query("""
        SELECT m.*, 
            array_length(
                ARRAY(SELECT unnest(m.ingredient_keywords) INTERSECT SELECT unnest(%s::text[])),
                1
            ) as deal_overlap
        FROM meals m
        WHERE m.filter_tags @> %s
        ORDER BY deal_overlap DESC NULLS LAST
        LIMIT 20
    """, deal_ingredients, user_filters)
    
    # 6. Score meals by taste profile match + deal overlap
    if user.taste_profile:
        for meal in matching_meals:
            meal.taste_score = calculate_taste_match(meal.taste_tags, user.taste_profile)
            meal.combined_score = (meal.deal_overlap or 0) * 0.6 + meal.taste_score * 0.4
        matching_meals.sort(key=lambda m: m.combined_score, reverse=True)
    
    # 7. Generate new meals if needed
    MEALS_NEEDED = 8  # 5 primary + 3 alternates
    good_matches = [m for m in matching_meals if m.deal_overlap and m.deal_overlap >= 2]
    meals_to_generate = max(0, MEALS_NEEDED - len(good_matches))
    
    generated_meals = []
    if meals_to_generate > 0:
        response = claude.messages.create(
            model="claude-sonnet-4-5-20250929",
            messages=[{
                "role": "user",
                "content": f"""Generate {meals_to_generate} dinner recipes using 
                ingredients on sale. Include a punchy tagline for each.
                
                DIETARY RESTRICTIONS: {user_filters}
                HOUSEHOLD SIZE: {user.household_size}
                
                INGREDIENTS ON SALE:
                {json.dumps(format_deal_ingredients(deals))}
                
                EXISTING MEALS TO AVOID DUPLICATING:
                {json.dumps([m.name for m in good_matches])}
                
                Return JSON array with: name, tagline, description, ingredients,
                steps (4-6), prep_time_minutes, cook_time_minutes, servings,
                difficulty, filter_tags, taste_tags, tips, ingredient_keywords."""
            }]
        )
        generated_meals = json.loads(response.content[0].text)
        
        # Save new meals if different enough
        for meal in generated_meals:
            if not is_too_similar(meal, existing_meals=matching_meals):
                db.insert("meals", **meal)
    
    # 8. Build optimized shopping plan (for both store counts)
    selected_meals = pick_best_meals(good_matches + generated_meals, count=5, alternates=3)
    
    plan_response = claude.messages.create(
        model="claude-sonnet-4-5-20250929",
        messages=[{
            "role": "user",
            "content": f"""Build an optimized grocery shopping plan.
            
            USER: Budget ${user.budget}, {user.household_size} people, max {user.max_stores} stores
            IMPORTANT ITEMS: {json.dumps(important_items.items)}
            SELECTED MEALS: {json.dumps(format_meals(selected_meals[:5]))}
            ALTERNATE MEALS: {json.dumps(format_meals(selected_meals[5:]))}
            STORES AND DEALS: {json.dumps(format_stores_and_deals(nearby_stores, deals))}
            
            Build BOTH a {user.max_stores}-store plan AND a {alt_stores}-store plan.
            Include store addresses. Identify 3-5 top deals.
            Calculate cost per serving for each meal against actual deal prices.
            
            Return JSON with: plan, alt_plan (each with stops, meals, 
            top_deals, total, budget_remaining, estimated_savings)."""
        }]
    )
    
    plan = json.loads(plan_response.content[0].text)
    
    # 9. Store plan and send email
    token = generate_unique_token()
    db.insert("weekly_plans",
        user_id=user.id,
        token=token,
        plan_data=plan["plan"],
        plan_data_alt=plan["alt_plan"],
        watchlist_alerts=watchlist_alerts,
        week_of=current_week_start()
    )
    
    html_email = render_email(user, plan, watchlist_alerts, token)
    send_email(user.email, build_subject_line(watchlist_alerts, plan), html_email)
```

**Cost per user per week:** ~$0.02-0.08 (drops over time as meal DB fills)

---

## Taste Profile System

```python
def update_taste_profile(user, meal, liked):
    """Update user's taste profile based on a swipe."""
    profile = user.taste_profile or {}
    weight = 0.1 if liked else -0.05  # likes matter more than skips
    
    # Update from meal's taste tags
    for tag_type, tag_value in meal.taste_tags.items():
        key = f"{tag_type}:{tag_value}"  # e.g. "protein:chicken", "cuisine:asian"
        profile[key] = max(0, min(1, profile.get(key, 0.5) + weight))
    
    # Update from ingredient keywords
    for ingredient in meal.ingredient_keywords:
        key = f"ingredient:{ingredient}"
        profile[key] = max(0, min(1, profile.get(key, 0.5) + weight * 0.5))
    
    user.taste_profile = profile
    db.update("users", user.id, taste_profile=profile)

def update_taste_from_deal_heart(user, deal):
    """Update taste profile when user hearts a deal."""
    profile = user.taste_profile or {}
    
    key = f"ingredient:{normalize(deal.item_name)}"
    profile[key] = max(0, min(1, profile.get(key, 0.5) + 0.15))
    
    cat_key = f"category:{deal.category}"
    profile[cat_key] = max(0, min(1, profile.get(cat_key, 0.5) + 0.1))
    
    user.taste_profile = profile
    db.update("users", user.id, taste_profile=profile)

def calculate_taste_match(meal_tags, profile):
    """Score how well a meal matches a user's taste profile. 0-1."""
    if not profile:
        return 0.5  # neutral for new users
    
    scores = []
    for tag_type, tag_value in meal_tags.items():
        key = f"{tag_type}:{tag_value}"
        if key in profile:
            scores.append(profile[key])
    
    return sum(scores) / len(scores) if scores else 0.5
```

---

## Deal Watchlist Logic

```python
def handle_deal_heart(user, deal):
    """Process when a user hearts a deal."""
    
    # 1. Classify price tier
    price_tier = classify_price_tier(deal.item_name, deal.regular_price)
    # e.g. chicken thighs at $6.99/lb = "staple"
    #      NY striploin at $44.99/kg = "luxury"
    #      salmon at $12.99/lb = "premium"
    
    # 2. Store in watchlist
    db.insert("deal_watchlist",
        user_id=user.id,
        item_keyword=normalize(deal.item_name),
        category=deal.category,
        price_tier=price_tier,
        benchmark_price=deal.sale_price,  # the price they found exciting
        benchmark_unit=deal.unit,
        store_id=None,  # watch at any store
    )
    
    # 3. Also update taste profile (for staples and premiums)
    if price_tier in ("staple", "premium"):
        update_taste_from_deal_heart(user, deal)
    # Luxury hearts do NOT update taste profile — they're aspirational,
    # not weekly rotation items

def classify_price_tier(item_name, regular_price):
    """Classify an item as staple, premium, or luxury."""
    # Simple heuristic — can be refined with data over time
    luxury_keywords = ["striploin", "ribeye", "filet", "lobster", "lamb rack", 
                        "wagyu", "veal", "crab"]
    premium_keywords = ["salmon", "shrimp", "steak", "lamb", "brisket"]
    
    name_lower = item_name.lower()
    if any(k in name_lower for k in luxury_keywords):
        return "luxury"
    if any(k in name_lower for k in premium_keywords):
        return "premium"
    return "staple"
```

---

## Meal Similarity Check

```python
def is_too_similar(new_meal, existing_meals, threshold=0.8):
    """Check if a new meal is too similar to any existing meal."""
    new_keywords = set(new_meal["ingredient_keywords"])
    
    for existing in existing_meals:
        existing_keywords = set(existing.ingredient_keywords)
        if not existing_keywords:
            continue
        
        overlap = len(new_keywords & existing_keywords)
        total = len(new_keywords | existing_keywords)
        similarity = overlap / total  # Jaccard similarity
        
        if new_meal["name"].lower().strip() == existing.name.lower().strip():
            return True
        
        if similarity >= threshold:
            return True
    
    return False
```

---

## Distance Calculation

```python
import math

def haversine(lat1, lng1, lat2, lng2):
    """Distance in km between two lat/lng points."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2 + 
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * 
         math.sin(dlng / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))
```

No Google Maps. No routing API. No per-request cost. One-time geocode when a store is added (free via OpenCage or Nominatim), then pure math. Store addresses link to Google Maps via `https://www.google.com/maps/search/?api=1&query={encoded_address}` for users to navigate themselves.

---

## App UX (Ionic React)

### Access modes
**Trial (web):** Token-based URL access. `groceryhack.com/plan/{token}`. No login, no install. User clicks email link → lands in app in browser.

**v1 (native):** Users download from App Store / Google Play. Real accounts with push notification registration. Token URLs still work as fallback and for sharing.

### Single-scroll experience
No tabs. One continuous scroll. Fixed section order:

**Scroll structure:**

1. **Hero alert** (conditional — only when a watched luxury deal fires) — big, dramatic, unmissable. "🔥 YOUR NY STRIPLOIN IS ON SALE — $28.99/kg." Rare, maybe once a month. Section does not appear if no alerts fired.

2. **Your Recipes on Sale** (conditional — only when a user-uploaded recipe matches deals) — shows which saved recipes just got affordable, with estimated cost vs regular. Does not appear if no recipes match.

3. **Dream Meal Matching** — vibrant cards with heart icon, emoji, tagline, cost per serving, savings. Tap any card to enter full-screen swipe mode across all available meals.

4. **Swipe mode (full-screen, replaces page)** — card stack fills the screen, previous page is hidden. Swipe right = like, left = skip. Haptic feedback on swipe (native only). Exit button returns to scroll. Tap a card for full recipe modal with ingredients (sale vs non-sale styling), steps, tips. Close modal to continue swiping.

5. **Store Meal Deal List + Shopping List** — meals organized under each store showing which deals power them, tappable to open meal modal. Below each store's meals, the ingredient-level shopping list: sale prices with strikethroughs on regular, non-sale items styled differently as pantry items. Store name and address tappable → opens Google Maps. 1/2 store toggle swaps between pre-computed plans.

6. **Notable Deals** — up to 10 best deals with product images, store names, store locations (linked to Google Maps), original price strikethrough, sale price. Heart button on each deal adds to watchlist.

7. **Report a deal (v2, native only)** — button to submit an in-store deal with camera photo capture.

### Sharing: meals and plans

Two sharing mechanics, both available from MVP:

**Meal sharing: "Cook this for me?" and "I'll make this for you!"**

On any meal card (in the scroll, in swipe mode, or in the recipe modal), two share actions. Tap either → enter the recipient's name and email or phone number → optionally pick a date/time → send.

The recipient gets a personalized message:

> "Jessica would like you to cook Honey Garlic Chicken Thighs — she found it on GroceryHack for $2.35/serving. Tap to see the full recipe."

> "Jessica wants to make Sheet Pan Salmon for you! She found it on GroceryHack — $3.75/serving with salmon at 46% off this week."

If a date/time was included, the message includes an "Add to Calendar" link (Google Calendar URL with the meal name, date/time, and recipe link as the description). Works for both sender and recipient.

**Plan sharing: "Share this plan"**

A "Share this plan" button near the savings summary at the top of the scroll. Tap → enter recipient's name and email or phone → send. The recipient gets a message with the weekly savings total and a link to the full plan — the same token-based URL the sender uses.

> "Jessica shared her GroceryHack meal plan with you — 5 meals, $46 total, saving $28 this week. Tap to see the full plan, recipes, and shopping list."

The recipient opens the link and sees the complete plan: all meals, shopping list by store with Google Maps links, deals, savings. The full product experience. At the bottom: "Want your own personalized plan? Sign up free."

**Both sharing features:**
- Recipient does NOT need a GroceryHack account
- Stateless for MVP — no new database tables, just compose and send
- Email via existing email service, SMS via Twilio (~$0.0075/text)
- Calendar links are just Google Calendar URLs — no API needed
- Every share is organic acquisition: meal sharing drives one-to-one discovery, plan sharing gives the recipient the full product experience

### Feeling Lucky 🎰

A "Feeling Lucky" button in the scroll (between meals and shopping list). Tap it to open a full-screen modal.

**First time:** The modal shows "Who's cooking this week?" with a simple text field. Type a name, tap add. Repeat for each household member. Names are saved to the user's profile (`household_names` on the users table) and persist across sessions.

**Return visits:** Names appear pre-filled. Users can delete any name by tapping an X on it, or add new ones. Quick and frictionless.

**The spin:** Tap "Spin!" and a slot-machine animation rolls through two columns — meal names and household names — slowing down and landing on a random combination. "TONIGHT: Marcus is making Black Bean Taco Bowls." Confetti. The selected meal comes from the user's liked pool only, so every result is something they've already approved.

**Implementation:** Almost entirely client-side. The random selection is just `Math.random()` on the liked meals array and the names array. The only backend touch is persisting the names list to the user profile — one field update. No new tables, no API calls for the spin itself.

**Why it matters:** It turns "what's for dinner and who's cooking" into a game. Households make it a weekly ritual. Kids get involved. It reinforces the habit of opening the app every week when the new plan arrives.

### Email + push → app relationship
**Email (trial + fallback):** Static snapshot of the top of the scroll. Hero alert (if any), first couple meal cards, savings total, one CTA: "See your full plan." Every tappable element links to the app.

**Push (v1, primary for native users):** Wednesday morning push with the week's best deal or savings total. Taps directly into the app — no browser, no email, straight to the plan. Mid-week pushes for watchlist alerts and user-reported deals (v2).

Over time, the most engaged users graduate from email to push. Email remains for users who prefer it or haven't installed the native app.

---

## Infrastructure

| Component | Service | Cost |
|-----------|---------|------|
| App server + cron | Railway / Fly.io / small EC2 | $5-15/mo |
| Database | Supabase free tier or Railway Postgres | $0-7/mo |
| Email sending | Resend (free up to 3K/mo) or SES | $0-5/mo |
| Push notifications | Firebase Cloud Messaging (free) or OneSignal | $0-5/mo |
| Claude API | Haiku for scraping, Sonnet for optimization | $5-20/mo at 500 users |
| Geocoding | OpenCage or Nominatim (free) | $0 |
| Apple Developer Program | $99/yr | Required for iOS App Store |
| Google Play Developer | $25 one-time | Required for Google Play |
| Domain | groceryhack.com | $12/yr |
| **Total at 500 users** | | **~$30-60/mo** |

Note: Claude API costs decrease over time as the meal database fills. App store fees are fixed regardless of user count.

---

## Notification Strategy

**Trial period (Weeks 1-5):** Email only. Users click through from email to the web app. No push infrastructure needed yet.

**v1 (Months 2-4):** Push notifications via Firebase Cloud Messaging (Android) and APNs (iOS), sent through Capacitor's Push Notifications plugin.

Push notification types:
- **Wednesday morning:** "Your meal plan is ready — salmon is 46% off this week 🔥" → opens app to plan
- **Watchlist alert (luxury items):** "Your NY striploin is on sale at Tony's — $28.99/kg" → opens app to hero alert
- **Mid-week user-reported deal (v2):** "A GroceryHack member spotted a deal at your Costco" → opens app to deal

Email continues as fallback for users who haven't installed the native app or haven't enabled push. Over time, the most engaged users graduate from email to push naturally.

---

## User-Reported Deals (v2)

Stores like Costco don't publish all deals in flyers — clearance tags, manager's specials, and in-store-only prices are invisible to scrapers. User-reported deals solve this.

```python
# v2 endpoint — user submits a deal they found in-store

def report_deal(user_id, store_id, item_name, sale_price, unit, photo):
    """User reports an in-store deal with a photo of the price tag."""
    
    deal = db.insert("deals",
        store_id=store_id,
        item_name=normalize(item_name),
        category=classify_category(item_name),
        sale_price=sale_price,
        unit=unit,
        source="user_reported",
        reported_by=user_id,
        report_photo_url=upload_photo(photo),
        valid_from=today(),
        valid_to=today() + timedelta(hours=48),  # default 48hr expiry
    )
    
    # Notify users who would care about this deal
    interested_users = find_interested_users(deal, store_id)
    for target_user in interested_users:
        send_push(target_user, f"Deal spotted at {store.name}: {item_name} at ${sale_price}/{unit}")
    
    return deal

def find_interested_users(deal, store_id):
    """Find users near this store whose taste profile or watchlist matches."""
    nearby_users = db.query("""
        SELECT u.* FROM users u
        WHERE haversine(u.lat, u.lng, 
            (SELECT lat FROM stores WHERE id = %s),
            (SELECT lng FROM stores WHERE id = %s)) < 10
        AND u.id != %s
    """, store_id, store_id, deal.reported_by)
    
    interested = []
    for user in nearby_users:
        # Check watchlist match
        watchlist_match = db.query("""
            SELECT * FROM deal_watchlist 
            WHERE user_id = %s AND item_keyword = %s AND benchmark_price >= %s
        """, user.id, normalize(deal.item_name), deal.sale_price)
        
        # Check taste profile match
        taste_match = False
        if user.taste_profile:
            ingredient_key = f"ingredient:{normalize(deal.item_name)}"
            if user.taste_profile.get(ingredient_key, 0) > 0.6:
                taste_match = True
        
        if watchlist_match or taste_match:
            interested.append(user)
    
    return interested
```

**Trust and verification:**
- Photo of price tag required — adds friction that filters junk
- Deals default to 48-hour expiry (in-store specials are short-lived)
- Multiple independent reports of the same deal = high confidence
- Single unverified reports shown with a caveat ("reported by 1 member")
- Submission via Capacitor camera plugin (native only, not available in web app)

**Data moat:** This creates deal data from stores that are impossible to scrape — Costco, local butchers, ethnic grocery stores, farmers' markets. Competitors would need to build the same user base to replicate this data.

---

## What Gets Built First (MVP)

**Week 1:** Scaffold Ionic React project with Capacitor. Database schema (all tables, including `source` field on deals for future user-reported deals). Flyer scraping pipeline. Plan generation with hybrid meal sourcing. Email template. Ionic app with single-scroll layout, tap-to-swipe meal mode, recipe modals, "Cook this for me?" and "I'll make this for you!" sharing via email/SMS with optional calendar link, shopping list with Google Maps links, deal hearts, 1/2 store toggle. Deploy as web app.

**Week 2:** Sign-up form, deploy, open to 20-30 free users for validation

**Weeks 3-5:** Pipeline runs automatically. Measure engagement.

**v1 features (Months 2-4):** Submit to app stores. Push notifications via Capacitor + FCM/APNs. Taste profile system. Deal watchlist with price tier classification. Watchlist hero alerts. Onboarding swipe flow. Offline plan caching.

**v2 features (Months 4-6):** User-reported deals with camera capture. Mid-week push notifications for reported deals. Deal verification system.

**Not in MVP, v1, or v2:** Nutritional tracking, price history, family sharing, pantry tracker, AI-generated meal images, explicit deal alert configuration, social features.

---

## Key Technical Decisions

**Why Ionic React + Capacitor?**
The product we've designed — swipe mechanics, deal hearts, push notifications — is fundamentally an app experience. Ionic React lets us write it once and deploy to web (for trial), iOS, and Android. The UI code is identical. Capacitor adds native push, camera, haptics, and offline storage with minimal extra work. Building a separate native app would be triple the effort for the same result.

**Why deploy as a web app first?**
For the trial, asking 30 strangers to install an app is a bigger ask than "click this email link." Web deployment has zero friction. Once validated, we submit to app stores — same codebase, just flipped from web to native. The web app continues to work as a fallback for users who don't install.

**Why push notifications over email long-term?**
Email open rates plateau around 40-50%. Push notification tap rates are higher. More importantly, push goes directly into the app experience — no browser middleman, no dropout point. The Wednesday push "your plan is ready 🔥" lands on the lock screen and taps into the full swipe/scroll experience. Email remains as fallback, not primary.

**Why hybrid meal generation?**
Pure on-the-fly generation gives inconsistent quality and costs more. Pure pre-populated DB requires upfront work. Hybrid starts empty, fills itself, and naturally reduces API costs over time while keeping content fresh.

**Why store meals without prices?**
Meals are timeless — "chicken stir fry with broccoli and rice" doesn't change. Prices change weekly. The meal itself is permanent; pricing is always recalculated against current deals.

**Why pre-compute both store count plans?**
The 1/2 store toggle should be instant. Extra cost: ~$0.02/user/week. Worth it for UX.

**Why single scroll instead of tabs?**
Tabs hide content. A single scroll creates a narrative that changes weekly based on what's exciting. Dynamic ordering means the most important thing is always first.

**Why tap-to-enter swipe mode?**
The scroll is the primary experience — a curated weekly plan. Swiping is an action you enter when you want to explore or customize. This keeps the default experience simple (scroll and read) while giving power users the ability to shape their preferences.

**Why separate staple hearts from luxury hearts?**
Hearting chicken at 50% off means "I cook chicken regularly, show me more." Hearting striploin at 36% off means "I can't normally afford this, but alert me when it's a steal." Mixing these signals would overlearn — suggesting steak dinners every week to someone who buys steak twice a year.

**Why no explicit deal alert configuration?**
Netflix doesn't ask you to configure recommendations. The heart is the only action. The system classifies price tier automatically and decides whether it feeds the taste profile (staples) or the watchlist (luxury). Zero configuration UI.

**Why user-reported deals in v2 not v1?**
Needs moderation thinking, abuse prevention, submission UI, and the camera integration only works in native (not web app trial). The core product works without it. But the data model is prepped — the `source` field on deals is there from day one.

**Why token-based auth for trial?**
Zero friction. No passwords, no sign-up beyond the initial form. Each plan has a unique unguessable URL. Real accounts with push notification registration come with the app store launch in v1.

**Why simple distance instead of routing?**
Users know how to get to their stores. Store addresses link to Google Maps. GroceryHack tells them *which* store and *what to buy*, not how to navigate.

**Why meal sharing in MVP?**
Every "Cook this for me?" or "I'll make this for you!" message is organic acquisition — a personal recommendation from someone the recipient trusts, with the app name, the recipe, and the savings baked in. Plan sharing takes it further — the recipient sees the full product experience (5 meals, shopping list, savings) through a single link. Both cost almost nothing (email is free, SMS is $0.0075/text), solve real household coordination problems, and are stateless to implement — no new tables, just send and forget.
