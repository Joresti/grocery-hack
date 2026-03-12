# Seed Data Specification

Realistic Hamilton-area test data for local development. Hamilton is the MVP launch city. Run via `npm run seed` from the backend.

## Store Brands (6)

| name | flyer_url | scrape_status |
|------|-----------|---------------|
| No Frills | https://www.nofrills.ca/en/deals/flyer | ok |
| FreshCo | https://www.freshco.com/flyer/ | ok |
| Food Basics | https://www.foodbasics.ca/flyer.html | ok |
| Fortinos | https://www.fortinos.ca/en/deals/flyer | ok |
| Metro | https://www.metro.ca/en/flyer | ok |
| Walmart Supercentre | https://www.walmart.ca/en/flyer | ok |

## Store Locations (12 — 2 per brand)

All in the Hamilton / Burlington / Stoney Creek area. Real addresses with approximate lat/lng.

| brand | address | city | region | postal_zip | lat | lng |
|-------|---------|------|--------|------------|-----|-----|
| No Frills | 1550 Upper James St | Hamilton | ON | L9B 1K3 | 43.2270 | -79.8680 |
| No Frills | 2 King St E | Stoney Creek | ON | L8G 1J4 | 43.2175 | -79.7633 |
| FreshCo | 1579 Main St W | Hamilton | ON | L8S 1E6 | 43.2590 | -79.9110 |
| FreshCo | 875 Main St E | Hamilton | ON | L8M 1L7 | 43.2470 | -79.8360 |
| Food Basics | 668 Upper James St | Hamilton | ON | L9C 2Z1 | 43.2390 | -79.8680 |
| Food Basics | 2255 Barton St E | Hamilton | ON | L8H 7T3 | 43.2440 | -79.7990 |
| Fortinos | 65 Mall Rd | Hamilton | ON | L8V 5B5 | 43.2350 | -79.8950 |
| Fortinos | 50 Dundurn St S | Hamilton | ON | L8P 4K3 | 43.2570 | -79.8840 |
| Metro | 999 Upper Wentworth St | Hamilton | ON | L9A 4V5 | 43.2350 | -79.8500 |
| Metro | 2301 Fairview St | Burlington | ON | L7R 2E3 | 43.3250 | -79.8080 |
| Walmart Supercentre | 1227 Barton St E | Hamilton | ON | L8H 2V4 | 43.2510 | -79.8240 |
| Walmart Supercentre | 900 Maple Ave | Burlington | ON | L7S 2J8 | 43.3370 | -79.7690 |

## Deals (60 — 10 per brand)

All valid for current week. Mix of categories. Realistic Canadian prices.

### No Frills
| item_name | category | sale_price | regular_price | unit |
|-----------|----------|------------|---------------|------|
| Boneless Skinless Chicken Breast | Meat | 4.97 | 8.99 | /lb |
| Broccoli Crowns | Produce | 1.47 | 2.99 | /each |
| Astro Yogurt 750g | Dairy | 3.47 | 5.49 | /each |
| San Remo Pasta 900g | Pantry | 1.97 | 3.99 | /each |
| Green Seedless Grapes | Produce | 2.47 | 4.99 | /lb |
| Extra Lean Ground Beef | Meat | 5.97 | 9.99 | /lb |
| Wonder Bread White | Bakery | 2.47 | 3.99 | /each |
| Cloverleaf Tuna 170g | Pantry | 1.27 | 2.49 | /each |
| English Cucumbers | Produce | 0.97 | 1.99 | /each |
| No Name Butter 454g | Dairy | 4.47 | 6.99 | /each |

### FreshCo
| item_name | category | sale_price | regular_price | unit |
|-----------|----------|------------|---------------|------|
| Chicken Thighs Bone-In | Meat | 2.97 | 5.99 | /lb |
| Romaine Hearts 3pk | Produce | 2.97 | 4.49 | /each |
| Bertolli Olive Oil 1L | Pantry | 8.97 | 13.99 | /each |
| Strawberries 1lb | Produce | 2.49 | 4.99 | /each |
| Pork Loin Chops | Meat | 3.47 | 6.99 | /lb |
| Black Diamond Cheese 400g | Dairy | 5.97 | 8.99 | /each |
| Minute Maid Orange Juice 2.63L | Beverages | 3.47 | 5.99 | /each |
| Red Peppers | Produce | 1.47 | 2.99 | /each |
| Basmati Rice 1.8kg | Pantry | 4.97 | 7.99 | /each |
| Eggs Large 12pk | Dairy | 3.47 | 5.49 | /each |

### Food Basics
| item_name | category | sale_price | regular_price | unit |
|-----------|----------|------------|---------------|------|
| Atlantic Salmon Fillets | Seafood | 7.97 | 12.99 | /lb |
| Avocados 5pk | Produce | 3.97 | 6.99 | /each |
| Catelli Spaghetti 500g | Pantry | 1.27 | 2.29 | /each |
| Roma Tomatoes | Produce | 1.47 | 2.99 | /lb |
| Lean Ground Turkey | Meat | 4.97 | 7.99 | /lb |
| Compliments Frozen Vegetables 750g | Frozen | 2.47 | 4.49 | /each |
| Chapman's Ice Cream 2L | Frozen | 3.97 | 6.99 | /each |
| Garlic Bulbs 3pk | Produce | 1.47 | 2.49 | /each |
| Lactantia Milk 2L | Dairy | 4.47 | 5.99 | /each |
| Compliments Canned Beans 540ml | Pantry | 0.97 | 1.79 | /each |

### Fortinos
| item_name | category | sale_price | regular_price | unit |
|-----------|----------|------------|---------------|------|
| PC Free Run Chicken Breast | Meat | 6.97 | 10.99 | /lb |
| Baby Spinach 312g | Produce | 3.47 | 5.99 | /each |
| PC Blue Menu Whole Wheat Pasta | Pantry | 2.47 | 4.29 | /each |
| Sweet Potatoes | Produce | 0.97 | 1.99 | /lb |
| AAA Striploin Steak | Meat | 11.97 | 19.99 | /lb |
| PC Butter Croissants 8pk | Bakery | 4.97 | 7.49 | /each |
| Mushrooms 227g | Produce | 1.97 | 3.49 | /each |
| PC Marinara Sauce 650ml | Pantry | 2.97 | 4.99 | /each |
| Tropicana Juice 1.54L | Beverages | 3.97 | 6.49 | /each |
| PC Greek Yogurt 750g | Dairy | 4.47 | 6.99 | /each |

### Metro
| item_name | category | sale_price | regular_price | unit |
|-----------|----------|------------|---------------|------|
| Irresistibles Chicken Sausages | Meat | 4.97 | 7.99 | /each |
| Asparagus | Produce | 2.47 | 4.99 | /bunch |
| Selection Canola Oil 946ml | Pantry | 2.97 | 4.99 | /each |
| Blueberries Pint | Produce | 2.97 | 5.99 | /each |
| Shrimp Ring 31-40 340g | Seafood | 7.97 | 12.99 | /each |
| Irresistibles Hummus 227g | Deli | 2.97 | 4.49 | /each |
| Mini Cucumbers 6pk | Produce | 1.97 | 3.49 | /each |
| Selection Jasmine Rice 900g | Pantry | 2.47 | 3.99 | /each |
| Neilson Milk 4L | Dairy | 5.97 | 7.49 | /each |
| Selection Tomato Sauce 680ml | Pantry | 1.47 | 2.49 | /each |

### Walmart Supercentre
| item_name | category | sale_price | regular_price | unit |
|-----------|----------|------------|---------------|------|
| Great Value Chicken Drumsticks | Meat | 1.97 | 3.99 | /lb |
| Bananas | Produce | 0.27 | 0.69 | /lb |
| Great Value Spaghetti Sauce 680ml | Pantry | 1.47 | 2.97 | /each |
| Yellow Onions 3lb bag | Produce | 1.97 | 3.49 | /each |
| Pork Shoulder Roast | Meat | 2.97 | 5.99 | /lb |
| Heinz Ketchup 1L | Pantry | 3.47 | 5.97 | /each |
| Great Value Frozen Corn 750g | Frozen | 1.47 | 2.97 | /each |
| Celery | Produce | 1.47 | 2.99 | /each |
| Great Value Eggs 18pk | Dairy | 4.47 | 6.97 | /each |
| Great Value Whole Wheat Bread | Bakery | 1.97 | 3.47 | /each |

## Meals (15)

System-generated meals. Mix of proteins, cuisines, and difficulty. Each has `ingredient_keywords` for deal matching.

| name | tagline | difficulty | servings | protein | cuisine | keywords |
|------|---------|------------|----------|---------|---------|----------|
| Honey Garlic Chicken Stir-Fry | Sticky, savory, 20 minutes flat | easy | 4 | chicken | asian | chicken, broccoli, garlic, rice, soy sauce, honey |
| One-Pan Lemon Herb Salmon | Fancy dinner, zero effort | easy | 4 | salmon | mediterranean | salmon, asparagus, lemon, olive oil, garlic |
| Veggie Black Bean Tacos | Taco Tuesday, upgraded | easy | 4 | none | mexican | black bean, tortilla, red pepper, cilantro, lime |
| Classic Beef Bolognese | Sunday sauce, weeknight speed | medium | 6 | beef | italian | beef, pasta, tomato, garlic, onion, olive oil |
| Sheet Pan Pork Chops | Oven does the work | easy | 4 | pork | american | pork, sweet potato, broccoli, olive oil, garlic |
| Shrimp Fried Rice | Takeout flavor, homemade | easy | 4 | shrimp | asian | shrimp, rice, egg, garlic, soy sauce, onion |
| Chicken Caesar Salad | Crispy croutons, creamy dressing | easy | 4 | chicken | american | chicken, lettuce, bread, garlic, lemon |
| Turkey Stuffed Peppers | Colorful, protein-packed | medium | 4 | turkey | american | turkey, red pepper, rice, tomato, onion, cheese |
| Creamy Mushroom Pasta | Comfort food in 25 minutes | easy | 4 | none | italian | pasta, mushroom, garlic, butter, onion |
| Teriyaki Chicken Bowl | Sweet, salty, crunchy | easy | 4 | chicken | asian | chicken, rice, broccoli, cucumber, soy sauce |
| Baked Salmon with Dill | Simple, elegant, foolproof | easy | 4 | salmon | scandinavian | salmon, lemon, garlic, olive oil, asparagus |
| Beef Taco Bowl | Everything you love, no shell | easy | 4 | beef | mexican | beef, rice, tomato, lettuce, avocado, onion |
| Pork Stir-Fry with Noodles | Wok-tossed goodness | easy | 4 | pork | asian | pork, egg, garlic, soy sauce, onion, noodle |
| Mediterranean Chickpea Bowl | Fresh, bright, filling | easy | 4 | none | mediterranean | chickpea, cucumber, tomato, olive oil, lemon |
| Chicken Parmesan | Crispy outside, cheesy inside | medium | 4 | chicken | italian | chicken, pasta, tomato, cheese, bread, garlic |

Each meal gets full `ingredients` (with quantity + unit), `steps` (4-6), `filter_tags`, `taste_tags`, `prep_time_minutes`, `cook_time_minutes`, and `tips`. These are generated during seed script execution — not pre-written here.

## Users (5)

All located in the Hamilton area.

| display_name | email | postal_code | budget | dietary_restrictions | max_stores | household_size |
|-------------|-------|-------------|--------|---------------------|------------|----------------|
| Jessica M | jessica@test.groceryhack.com | L8P 1A1 | 100 | [] | 2 | 4 |
| Marcus T | marcus@test.groceryhack.com | L8H 3Z5 | 75 | [] | 1 | 2 |
| Priya K | priya@test.groceryhack.com | L8S 3L3 | 120 | ["vegetarian"] | 2 | 4 |
| David L | david@test.groceryhack.com | L9C 5N2 | 60 | ["gluten-free"] | 1 | 1 |
| Sarah C | sarah@test.groceryhack.com | L7R 1R2 | 90 | [] | 2 | 3 |

All users get password `testpassword123` (hashed).

## User Meal Preferences (swipe data)

Generate 8-12 swipes per user to enable collaborative filtering. Distribution: ~60% liked, ~40% skipped. Ensure some shared likes between users to make collaborative filtering work:

- Jessica and Sarah both like: Honey Garlic Chicken, Sheet Pan Pork Chops, Beef Taco Bowl
- Marcus and David both like: Classic Beef Bolognese, Shrimp Fried Rice
- Priya likes all vegetarian meals + Mediterranean Chickpea Bowl

## Important Items

| user | items |
|------|-------|
| Jessica M | Milk 2L, Eggs dozen, Bread, Bananas, Yogurt |
| Marcus T | Milk 2L, Coffee beans, Rice |
| Priya K | Milk 2L, Bread, Spinach, Tofu |
| David L | Eggs dozen, Chicken breast, Broccoli |
| Sarah C | Milk 4L, Eggs 18pk, Butter, Bananas, Bread, Orange juice |

## Seed Script

```bash
# backend/package.json
{
  "scripts": {
    "seed": "tsx src/db/seed.ts",
    "seed:reset": "psql -f schema.sql && tsx src/db/seed.ts"
  }
}
```

The seed script:
1. Truncates all tables (CASCADE)
2. Inserts store brands
3. Inserts store locations
4. Inserts deals (all valid from Monday to Sunday of current week)
5. Inserts meals with full recipe data
6. Inserts users (with hashed passwords)
7. Inserts user meal preferences (swipe data)
8. Inserts important items
9. Logs summary: "Seeded: 6 brands, 12 locations, 60 deals, 15 meals, 5 users"

All IDs are deterministic UUIDs (derived from name hashes) so seed data is idempotent — running it twice produces the same result.
