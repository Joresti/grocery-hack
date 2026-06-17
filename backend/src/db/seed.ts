import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { pool } from './client.js';

// ============================================================
// Helpers
// ============================================================

/** Deterministic UUID from a name (SHA-256 → UUID v4 format) */
function makeUuid(name: string): string {
  const hash = crypto.createHash('sha256').update(name).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16), // version 4
    ((parseInt(hash[16]!, 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20), // variant
    hash.slice(20, 32),
  ].join('-');
}

/** Get this week's Monday–Sunday date range */
function getCurrentWeekRange(): { validFrom: string; validTo: string } {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    validFrom: monday.toISOString().split('T')[0]!,
    validTo: sunday.toISOString().split('T')[0]!,
  };
}

// ============================================================
// Data definitions
// ============================================================

interface StoreBrand {
  name: string;
  flyerUrl: string;
  scrapeStatus: string;
}

const storeBrands: StoreBrand[] = [
  { name: 'No Frills', flyerUrl: 'https://www.nofrills.ca/en/deals/flyer', scrapeStatus: 'ok' },
  { name: 'FreshCo', flyerUrl: 'https://www.freshco.com/flyer/', scrapeStatus: 'ok' },
  { name: 'Food Basics', flyerUrl: 'https://www.foodbasics.ca/flyer.html', scrapeStatus: 'ok' },
  { name: 'Fortinos', flyerUrl: 'https://www.fortinos.ca/en/deals/flyer', scrapeStatus: 'ok' },
  { name: 'Metro', flyerUrl: 'https://www.metro.ca/en/flyer', scrapeStatus: 'ok' },
  { name: 'Walmart Supercentre', flyerUrl: 'https://www.walmart.ca/en/flyer', scrapeStatus: 'ok' },
];

interface StoreLocation {
  brand: string;
  address: string;
  city: string;
  region: string;
  postalZip: string;
  lat: number;
  lng: number;
}

const storeLocations: StoreLocation[] = [
  { brand: 'No Frills', address: '1550 Upper James St', city: 'Hamilton', region: 'ON', postalZip: 'L8B 1K3', lat: 43.2270, lng: -79.8680 },
  { brand: 'No Frills', address: '2 King St E', city: 'Stoney Creek', region: 'ON', postalZip: 'L8G 1J4', lat: 43.2175, lng: -79.7633 },
  { brand: 'FreshCo', address: '1579 Main St W', city: 'Hamilton', region: 'ON', postalZip: 'L8S 1E6', lat: 43.2590, lng: -79.9110 },
  { brand: 'FreshCo', address: '875 Main St E', city: 'Hamilton', region: 'ON', postalZip: 'L8M 1L7', lat: 43.2470, lng: -79.8360 },
  { brand: 'Food Basics', address: '668 Upper James St', city: 'Hamilton', region: 'ON', postalZip: 'L9C 2Z1', lat: 43.2390, lng: -79.8680 },
  { brand: 'Food Basics', address: '2255 Barton St E', city: 'Hamilton', region: 'ON', postalZip: 'L8H 7T3', lat: 43.2440, lng: -79.7990 },
  { brand: 'Fortinos', address: '65 Mall Rd', city: 'Hamilton', region: 'ON', postalZip: 'L8V 5B5', lat: 43.2350, lng: -79.8950 },
  { brand: 'Fortinos', address: '50 Dundurn St S', city: 'Hamilton', region: 'ON', postalZip: 'L8P 4K3', lat: 43.2570, lng: -79.8840 },
  { brand: 'Metro', address: '999 Upper Wentworth St', city: 'Hamilton', region: 'ON', postalZip: 'L9A 4V5', lat: 43.2350, lng: -79.8500 },
  { brand: 'Metro', address: '2301 Fairview St', city: 'Burlington', region: 'ON', postalZip: 'L7R 2E3', lat: 43.3250, lng: -79.8080 },
  { brand: 'Walmart Supercentre', address: '1227 Barton St E', city: 'Hamilton', region: 'ON', postalZip: 'L8H 2V4', lat: 43.2510, lng: -79.8240 },
  { brand: 'Walmart Supercentre', address: '900 Maple Ave', city: 'Burlington', region: 'ON', postalZip: 'L7S 2J8', lat: 43.3370, lng: -79.7690 },
];

interface Deal {
  brand: string;
  itemName: string;
  category: string;
  salePrice: number;
  regularPrice: number;
  unit: string;
}

const deals: Deal[] = [
  // No Frills (10)
  { brand: 'No Frills', itemName: 'Boneless Skinless Chicken Breast', category: 'Meat', salePrice: 4.97, regularPrice: 8.99, unit: '/lb' },
  { brand: 'No Frills', itemName: 'Broccoli Crowns', category: 'Produce', salePrice: 1.47, regularPrice: 2.99, unit: '/each' },
  { brand: 'No Frills', itemName: 'Astro Yogurt 750g', category: 'Dairy', salePrice: 3.47, regularPrice: 5.49, unit: '/each' },
  { brand: 'No Frills', itemName: 'San Remo Pasta 900g', category: 'Pantry', salePrice: 1.97, regularPrice: 3.99, unit: '/each' },
  { brand: 'No Frills', itemName: 'Green Seedless Grapes', category: 'Produce', salePrice: 2.47, regularPrice: 4.99, unit: '/lb' },
  { brand: 'No Frills', itemName: 'Extra Lean Ground Beef', category: 'Meat', salePrice: 5.97, regularPrice: 9.99, unit: '/lb' },
  { brand: 'No Frills', itemName: 'Wonder Bread White', category: 'Bakery', salePrice: 2.47, regularPrice: 3.99, unit: '/each' },
  { brand: 'No Frills', itemName: 'Cloverleaf Tuna 170g', category: 'Pantry', salePrice: 1.27, regularPrice: 2.49, unit: '/each' },
  { brand: 'No Frills', itemName: 'English Cucumbers', category: 'Produce', salePrice: 0.97, regularPrice: 1.99, unit: '/each' },
  { brand: 'No Frills', itemName: 'No Name Butter 454g', category: 'Dairy', salePrice: 4.47, regularPrice: 6.99, unit: '/each' },
  // FreshCo (10)
  { brand: 'FreshCo', itemName: 'Chicken Thighs Bone-In', category: 'Meat', salePrice: 2.97, regularPrice: 5.99, unit: '/lb' },
  { brand: 'FreshCo', itemName: 'Romaine Hearts 3pk', category: 'Produce', salePrice: 2.97, regularPrice: 4.49, unit: '/each' },
  { brand: 'FreshCo', itemName: 'Bertolli Olive Oil 1L', category: 'Pantry', salePrice: 8.97, regularPrice: 13.99, unit: '/each' },
  { brand: 'FreshCo', itemName: 'Strawberries 1lb', category: 'Produce', salePrice: 2.49, regularPrice: 4.99, unit: '/each' },
  { brand: 'FreshCo', itemName: 'Pork Loin Chops', category: 'Meat', salePrice: 3.47, regularPrice: 6.99, unit: '/lb' },
  { brand: 'FreshCo', itemName: 'Black Diamond Cheese 400g', category: 'Dairy', salePrice: 5.97, regularPrice: 8.99, unit: '/each' },
  { brand: 'FreshCo', itemName: 'Minute Maid Orange Juice 2.63L', category: 'Beverages', salePrice: 3.47, regularPrice: 5.99, unit: '/each' },
  { brand: 'FreshCo', itemName: 'Red Peppers', category: 'Produce', salePrice: 1.47, regularPrice: 2.99, unit: '/each' },
  { brand: 'FreshCo', itemName: 'Basmati Rice 1.8kg', category: 'Pantry', salePrice: 4.97, regularPrice: 7.99, unit: '/each' },
  { brand: 'FreshCo', itemName: 'Eggs Large 12pk', category: 'Dairy', salePrice: 3.47, regularPrice: 5.49, unit: '/each' },
  // Food Basics (10)
  { brand: 'Food Basics', itemName: 'Atlantic Salmon Fillets', category: 'Seafood', salePrice: 7.97, regularPrice: 12.99, unit: '/lb' },
  { brand: 'Food Basics', itemName: 'Avocados 5pk', category: 'Produce', salePrice: 3.97, regularPrice: 6.99, unit: '/each' },
  { brand: 'Food Basics', itemName: 'Catelli Spaghetti 500g', category: 'Pantry', salePrice: 1.27, regularPrice: 2.29, unit: '/each' },
  { brand: 'Food Basics', itemName: 'Roma Tomatoes', category: 'Produce', salePrice: 1.47, regularPrice: 2.99, unit: '/lb' },
  { brand: 'Food Basics', itemName: 'Lean Ground Turkey', category: 'Meat', salePrice: 4.97, regularPrice: 7.99, unit: '/lb' },
  { brand: 'Food Basics', itemName: 'Compliments Frozen Vegetables 750g', category: 'Frozen', salePrice: 2.47, regularPrice: 4.49, unit: '/each' },
  { brand: 'Food Basics', itemName: "Chapman's Ice Cream 2L", category: 'Frozen', salePrice: 3.97, regularPrice: 6.99, unit: '/each' },
  { brand: 'Food Basics', itemName: 'Garlic Bulbs 3pk', category: 'Produce', salePrice: 1.47, regularPrice: 2.49, unit: '/each' },
  { brand: 'Food Basics', itemName: 'Lactantia Milk 2L', category: 'Dairy', salePrice: 4.47, regularPrice: 5.99, unit: '/each' },
  { brand: 'Food Basics', itemName: 'Compliments Canned Beans 540ml', category: 'Pantry', salePrice: 0.97, regularPrice: 1.79, unit: '/each' },
  // Fortinos (10)
  { brand: 'Fortinos', itemName: 'PC Free Run Chicken Breast', category: 'Meat', salePrice: 6.97, regularPrice: 10.99, unit: '/lb' },
  { brand: 'Fortinos', itemName: 'Baby Spinach 312g', category: 'Produce', salePrice: 3.47, regularPrice: 5.99, unit: '/each' },
  { brand: 'Fortinos', itemName: 'PC Blue Menu Whole Wheat Pasta', category: 'Pantry', salePrice: 2.47, regularPrice: 4.29, unit: '/each' },
  { brand: 'Fortinos', itemName: 'Sweet Potatoes', category: 'Produce', salePrice: 0.97, regularPrice: 1.99, unit: '/lb' },
  { brand: 'Fortinos', itemName: 'AAA Striploin Steak', category: 'Meat', salePrice: 11.97, regularPrice: 19.99, unit: '/lb' },
  { brand: 'Fortinos', itemName: 'PC Butter Croissants 8pk', category: 'Bakery', salePrice: 4.97, regularPrice: 7.49, unit: '/each' },
  { brand: 'Fortinos', itemName: 'Mushrooms 227g', category: 'Produce', salePrice: 1.97, regularPrice: 3.49, unit: '/each' },
  { brand: 'Fortinos', itemName: 'PC Marinara Sauce 650ml', category: 'Pantry', salePrice: 2.97, regularPrice: 4.99, unit: '/each' },
  { brand: 'Fortinos', itemName: 'Tropicana Juice 1.54L', category: 'Beverages', salePrice: 3.97, regularPrice: 6.49, unit: '/each' },
  { brand: 'Fortinos', itemName: 'PC Greek Yogurt 750g', category: 'Dairy', salePrice: 4.47, regularPrice: 6.99, unit: '/each' },
  // Metro (10)
  { brand: 'Metro', itemName: 'Irresistibles Chicken Sausages', category: 'Meat', salePrice: 4.97, regularPrice: 7.99, unit: '/each' },
  { brand: 'Metro', itemName: 'Asparagus', category: 'Produce', salePrice: 2.47, regularPrice: 4.99, unit: '/bunch' },
  { brand: 'Metro', itemName: 'Selection Canola Oil 946ml', category: 'Pantry', salePrice: 2.97, regularPrice: 4.99, unit: '/each' },
  { brand: 'Metro', itemName: 'Blueberries Pint', category: 'Produce', salePrice: 2.97, regularPrice: 5.99, unit: '/each' },
  { brand: 'Metro', itemName: 'Shrimp Ring 31-40 340g', category: 'Seafood', salePrice: 7.97, regularPrice: 12.99, unit: '/each' },
  { brand: 'Metro', itemName: 'Irresistibles Hummus 227g', category: 'Deli', salePrice: 2.97, regularPrice: 4.49, unit: '/each' },
  { brand: 'Metro', itemName: 'Mini Cucumbers 6pk', category: 'Produce', salePrice: 1.97, regularPrice: 3.49, unit: '/each' },
  { brand: 'Metro', itemName: 'Selection Jasmine Rice 900g', category: 'Pantry', salePrice: 2.47, regularPrice: 3.99, unit: '/each' },
  { brand: 'Metro', itemName: 'Neilson Milk 4L', category: 'Dairy', salePrice: 5.97, regularPrice: 7.49, unit: '/each' },
  { brand: 'Metro', itemName: 'Selection Tomato Sauce 680ml', category: 'Pantry', salePrice: 1.47, regularPrice: 2.49, unit: '/each' },
  // Walmart Supercentre (10)
  { brand: 'Walmart Supercentre', itemName: 'Great Value Chicken Drumsticks', category: 'Meat', salePrice: 1.97, regularPrice: 3.99, unit: '/lb' },
  { brand: 'Walmart Supercentre', itemName: 'Bananas', category: 'Produce', salePrice: 0.27, regularPrice: 0.69, unit: '/lb' },
  { brand: 'Walmart Supercentre', itemName: 'Great Value Spaghetti Sauce 680ml', category: 'Pantry', salePrice: 1.47, regularPrice: 2.97, unit: '/each' },
  { brand: 'Walmart Supercentre', itemName: 'Yellow Onions 3lb bag', category: 'Produce', salePrice: 1.97, regularPrice: 3.49, unit: '/each' },
  { brand: 'Walmart Supercentre', itemName: 'Pork Shoulder Roast', category: 'Meat', salePrice: 2.97, regularPrice: 5.99, unit: '/lb' },
  { brand: 'Walmart Supercentre', itemName: 'Heinz Ketchup 1L', category: 'Pantry', salePrice: 3.47, regularPrice: 5.97, unit: '/each' },
  { brand: 'Walmart Supercentre', itemName: 'Great Value Frozen Corn 750g', category: 'Frozen', salePrice: 1.47, regularPrice: 2.97, unit: '/each' },
  { brand: 'Walmart Supercentre', itemName: 'Celery', category: 'Produce', salePrice: 1.47, regularPrice: 2.99, unit: '/each' },
  { brand: 'Walmart Supercentre', itemName: 'Great Value Eggs 18pk', category: 'Dairy', salePrice: 4.47, regularPrice: 6.97, unit: '/each' },
  { brand: 'Walmart Supercentre', itemName: 'Great Value Whole Wheat Bread', category: 'Bakery', salePrice: 1.97, regularPrice: 3.47, unit: '/each' },
];

// ============================================================
// Meals
// ============================================================

interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
}

interface MealDef {
  name: string;
  tagline: string;
  description: string;
  difficulty: 'easy' | 'medium';
  servings: number;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  ingredients: Ingredient[];
  steps: string[];
  filterTags: string[];
  tasteTags: Record<string, number>;
  tips: string;
  ingredientKeywords: string[];
}

const mealDefs: MealDef[] = [
  {
    name: 'Honey Garlic Chicken Stir-Fry',
    tagline: 'Sticky, savory, 20 minutes flat',
    description: 'A quick weeknight stir-fry with tender chicken, crisp broccoli, and a sticky honey garlic glaze served over fluffy rice.',
    difficulty: 'easy',
    servings: 4,
    prepTimeMinutes: 10,
    cookTimeMinutes: 15,
    ingredients: [
      { name: 'boneless skinless chicken breast', quantity: '1.5', unit: 'lb' },
      { name: 'broccoli crowns', quantity: '2', unit: 'cups' },
      { name: 'garlic cloves', quantity: '4', unit: 'cloves' },
      { name: 'white rice', quantity: '2', unit: 'cups' },
      { name: 'soy sauce', quantity: '3', unit: 'tbsp' },
      { name: 'honey', quantity: '3', unit: 'tbsp' },
      { name: 'sesame oil', quantity: '1', unit: 'tbsp' },
      { name: 'cornstarch', quantity: '1', unit: 'tbsp' },
    ],
    steps: [
      'Cook rice according to package directions.',
      'Cut chicken into bite-sized pieces and toss with cornstarch.',
      'Heat sesame oil in a large skillet or wok over high heat. Sear chicken until golden, about 5 minutes.',
      'Add minced garlic and broccoli florets. Stir-fry 3 minutes until broccoli is bright green.',
      'Pour in soy sauce and honey mixture. Toss until sauce thickens and coats everything, about 2 minutes.',
      'Serve over rice immediately.',
    ],
    filterTags: ['high-protein', 'quick', 'dairy-free'],
    tasteTags: { asian: 0.8, savory: 0.9, sweet: 0.4 },
    tips: 'For extra crunch, add a handful of cashews or peanuts right before serving.',
    ingredientKeywords: ['chicken', 'broccoli', 'garlic', 'rice', 'soy sauce', 'honey'],
  },
  {
    name: 'One-Pan Lemon Herb Salmon',
    tagline: 'Fancy dinner, zero effort',
    description: 'Flaky salmon fillets roasted alongside asparagus with bright lemon and herbs. One pan, minimal cleanup.',
    difficulty: 'easy',
    servings: 4,
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    ingredients: [
      { name: 'salmon fillets', quantity: '4', unit: 'fillets' },
      { name: 'asparagus', quantity: '1', unit: 'bunch' },
      { name: 'lemon', quantity: '2', unit: 'whole' },
      { name: 'olive oil', quantity: '3', unit: 'tbsp' },
      { name: 'garlic cloves', quantity: '3', unit: 'cloves' },
      { name: 'fresh dill', quantity: '2', unit: 'tbsp' },
      { name: 'salt and pepper', quantity: '1', unit: 'tsp each' },
    ],
    steps: [
      'Preheat oven to 425F. Line a sheet pan with parchment paper.',
      'Arrange salmon fillets in the center. Scatter trimmed asparagus around the fish.',
      'Drizzle everything with olive oil. Squeeze one lemon over the pan, slice the other for garnish.',
      'Scatter minced garlic and dill over the salmon. Season with salt and pepper.',
      'Roast 18-20 minutes until salmon flakes easily with a fork.',
      'Garnish with lemon slices and serve.',
    ],
    filterTags: ['high-protein', 'low-carb', 'gluten-free', 'dairy-free'],
    tasteTags: { mediterranean: 0.7, fresh: 0.9, herbaceous: 0.8 },
    tips: 'Pat salmon dry with paper towels before seasoning for crispier skin.',
    ingredientKeywords: ['salmon', 'asparagus', 'lemon', 'olive oil', 'garlic'],
  },
  {
    name: 'Veggie Black Bean Tacos',
    tagline: 'Taco Tuesday, upgraded',
    description: 'Hearty black bean tacos loaded with sauteed peppers, fresh cilantro, and a squeeze of lime. Vegetarian and satisfying.',
    difficulty: 'easy',
    servings: 4,
    prepTimeMinutes: 10,
    cookTimeMinutes: 10,
    ingredients: [
      { name: 'canned black beans', quantity: '2', unit: 'cans' },
      { name: 'small flour tortillas', quantity: '8', unit: 'tortillas' },
      { name: 'red pepper', quantity: '2', unit: 'whole' },
      { name: 'fresh cilantro', quantity: '0.5', unit: 'cup' },
      { name: 'lime', quantity: '2', unit: 'whole' },
      { name: 'cumin', quantity: '1', unit: 'tsp' },
      { name: 'chili powder', quantity: '1', unit: 'tsp' },
      { name: 'red onion', quantity: '0.5', unit: 'whole' },
    ],
    steps: [
      'Drain and rinse black beans. Heat in a saucepan with cumin and chili powder over medium heat.',
      'Dice red peppers and onion. Saute in a skillet with a drizzle of oil until softened, about 5 minutes.',
      'Warm tortillas in a dry skillet or microwave.',
      'Mash half the beans lightly for a creamy base, leave the rest whole.',
      'Assemble tacos: spread beans on tortillas, top with peppers, cilantro, and a squeeze of lime.',
    ],
    filterTags: ['vegetarian', 'vegan', 'quick', 'dairy-free'],
    tasteTags: { mexican: 0.9, fresh: 0.7, spicy: 0.3 },
    tips: 'Top with avocado slices or a dollop of sour cream for extra richness.',
    ingredientKeywords: ['black bean', 'tortilla', 'red pepper', 'cilantro', 'lime'],
  },
  {
    name: 'Classic Beef Bolognese',
    tagline: 'Sunday sauce, weeknight speed',
    description: 'A rich, meaty bolognese sauce simmered with tomatoes, garlic, and onion, served over perfectly cooked pasta.',
    difficulty: 'medium',
    servings: 6,
    prepTimeMinutes: 15,
    cookTimeMinutes: 35,
    ingredients: [
      { name: 'extra lean ground beef', quantity: '1.5', unit: 'lb' },
      { name: 'spaghetti or penne', quantity: '500', unit: 'g' },
      { name: 'crushed tomatoes', quantity: '1', unit: '28oz can' },
      { name: 'garlic cloves', quantity: '4', unit: 'cloves' },
      { name: 'yellow onion', quantity: '1', unit: 'large' },
      { name: 'olive oil', quantity: '2', unit: 'tbsp' },
      { name: 'tomato paste', quantity: '2', unit: 'tbsp' },
      { name: 'dried oregano', quantity: '1', unit: 'tsp' },
      { name: 'salt and pepper', quantity: '1', unit: 'tsp each' },
    ],
    steps: [
      'Heat olive oil in a large pot over medium-high heat. Add diced onion and cook until translucent, about 4 minutes.',
      'Add minced garlic and cook 30 seconds until fragrant.',
      'Add ground beef, breaking it up with a spoon. Brown for 6-8 minutes.',
      'Stir in tomato paste, crushed tomatoes, oregano, salt, and pepper. Bring to a simmer.',
      'Reduce heat to low and simmer 25 minutes, stirring occasionally.',
      'Meanwhile, cook pasta according to package directions. Drain and toss with sauce.',
    ],
    filterTags: ['high-protein', 'comfort-food'],
    tasteTags: { italian: 0.9, savory: 0.9, hearty: 0.8 },
    tips: 'A splash of red wine when browning the meat adds incredible depth of flavor.',
    ingredientKeywords: ['beef', 'pasta', 'tomato', 'garlic', 'onion', 'olive oil'],
  },
  {
    name: 'Sheet Pan Pork Chops',
    tagline: 'Oven does the work',
    description: 'Juicy pork chops roasted on a sheet pan with sweet potatoes and broccoli. Dinner with almost no hands-on time.',
    difficulty: 'easy',
    servings: 4,
    prepTimeMinutes: 10,
    cookTimeMinutes: 25,
    ingredients: [
      { name: 'pork loin chops', quantity: '4', unit: 'chops' },
      { name: 'sweet potatoes', quantity: '2', unit: 'large' },
      { name: 'broccoli crowns', quantity: '2', unit: 'cups' },
      { name: 'olive oil', quantity: '3', unit: 'tbsp' },
      { name: 'garlic powder', quantity: '1', unit: 'tsp' },
      { name: 'smoked paprika', quantity: '1', unit: 'tsp' },
      { name: 'salt and pepper', quantity: '1', unit: 'tsp each' },
    ],
    steps: [
      'Preheat oven to 425F. Line a large sheet pan with parchment.',
      'Cube sweet potatoes into 1-inch pieces. Toss with half the olive oil, salt, and pepper. Spread on pan.',
      'Roast sweet potatoes for 10 minutes to get a head start.',
      'Season pork chops with garlic powder, paprika, salt, and pepper. Add to pan with broccoli florets.',
      'Drizzle remaining olive oil over pork and broccoli. Return to oven for 15 minutes.',
      'Rest pork chops 3 minutes before serving alongside the vegetables.',
    ],
    filterTags: ['high-protein', 'gluten-free', 'dairy-free'],
    tasteTags: { savory: 0.8, smoky: 0.5, hearty: 0.7 },
    tips: 'Use a meat thermometer — pork is done at 145F internal temperature.',
    ingredientKeywords: ['pork', 'sweet potato', 'broccoli', 'olive oil', 'garlic'],
  },
  {
    name: 'Shrimp Fried Rice',
    tagline: 'Takeout flavor, homemade',
    description: 'Restaurant-style fried rice loaded with plump shrimp, scrambled egg, and crispy garlic. Better than takeout.',
    difficulty: 'easy',
    servings: 4,
    prepTimeMinutes: 10,
    cookTimeMinutes: 12,
    ingredients: [
      { name: 'large shrimp, peeled', quantity: '1', unit: 'lb' },
      { name: 'cooked rice (day-old preferred)', quantity: '4', unit: 'cups' },
      { name: 'eggs', quantity: '3', unit: 'large' },
      { name: 'garlic cloves', quantity: '3', unit: 'cloves' },
      { name: 'soy sauce', quantity: '3', unit: 'tbsp' },
      { name: 'green onions', quantity: '4', unit: 'stalks' },
      { name: 'sesame oil', quantity: '1', unit: 'tbsp' },
      { name: 'frozen peas', quantity: '0.5', unit: 'cup' },
    ],
    steps: [
      'Heat sesame oil in a large wok or skillet over high heat.',
      'Sear shrimp 1-2 minutes per side until pink. Remove and set aside.',
      'Scramble eggs in the same wok, breaking into small pieces. Push to the side.',
      'Add minced garlic and frozen peas. Stir-fry 1 minute.',
      'Add day-old rice, breaking up clumps. Stir-fry 3-4 minutes until rice is lightly crispy.',
      'Return shrimp to wok, add soy sauce and sliced green onions. Toss to combine and serve.',
    ],
    filterTags: ['high-protein', 'quick', 'dairy-free'],
    tasteTags: { asian: 0.9, savory: 0.8, umami: 0.7 },
    tips: 'Day-old rice works best — freshly cooked rice has too much moisture and will turn mushy.',
    ingredientKeywords: ['shrimp', 'rice', 'egg', 'garlic', 'soy sauce', 'onion'],
  },
  {
    name: 'Chicken Caesar Salad',
    tagline: 'Crispy croutons, creamy dressing',
    description: 'Classic Caesar salad with pan-seared chicken, homemade garlic croutons, and a creamy lemon dressing.',
    difficulty: 'easy',
    servings: 4,
    prepTimeMinutes: 15,
    cookTimeMinutes: 15,
    ingredients: [
      { name: 'boneless skinless chicken breast', quantity: '1.5', unit: 'lb' },
      { name: 'romaine lettuce', quantity: '2', unit: 'hearts' },
      { name: 'bread (for croutons)', quantity: '3', unit: 'slices' },
      { name: 'garlic cloves', quantity: '2', unit: 'cloves' },
      { name: 'lemon', quantity: '1', unit: 'whole' },
      { name: 'mayonnaise', quantity: '3', unit: 'tbsp' },
      { name: 'parmesan cheese', quantity: '0.25', unit: 'cup' },
      { name: 'olive oil', quantity: '2', unit: 'tbsp' },
    ],
    steps: [
      'Season chicken breasts with salt and pepper. Pan-sear in olive oil over medium-high heat, 6 minutes per side until cooked through. Rest 5 minutes, then slice.',
      'Cube bread, toss with olive oil and minced garlic. Toast in a skillet until golden and crunchy, about 4 minutes.',
      'Whisk together mayonnaise, lemon juice, minced garlic, and grated parmesan for the dressing.',
      'Chop romaine lettuce and place in a large bowl.',
      'Top with sliced chicken, croutons, and dressing. Toss gently and serve with extra parmesan.',
    ],
    filterTags: ['high-protein', 'quick'],
    tasteTags: { fresh: 0.7, savory: 0.8, creamy: 0.6 },
    tips: 'Flatten chicken breasts to even thickness before cooking for perfectly even results.',
    ingredientKeywords: ['chicken', 'lettuce', 'bread', 'garlic', 'lemon'],
  },
  {
    name: 'Turkey Stuffed Peppers',
    tagline: 'Colorful, protein-packed',
    description: 'Bell peppers stuffed with seasoned ground turkey, rice, and tomato sauce, topped with melted cheese.',
    difficulty: 'medium',
    servings: 4,
    prepTimeMinutes: 15,
    cookTimeMinutes: 35,
    ingredients: [
      { name: 'red bell peppers', quantity: '4', unit: 'large' },
      { name: 'lean ground turkey', quantity: '1', unit: 'lb' },
      { name: 'cooked rice', quantity: '1.5', unit: 'cups' },
      { name: 'diced tomatoes', quantity: '1', unit: '14oz can' },
      { name: 'yellow onion', quantity: '1', unit: 'medium' },
      { name: 'shredded cheese', quantity: '1', unit: 'cup' },
      { name: 'garlic cloves', quantity: '2', unit: 'cloves' },
      { name: 'cumin', quantity: '1', unit: 'tsp' },
      { name: 'salt and pepper', quantity: '1', unit: 'tsp each' },
    ],
    steps: [
      'Preheat oven to 375F. Cut tops off bell peppers and remove seeds.',
      'Brown ground turkey in a skillet with diced onion and minced garlic over medium-high heat.',
      'Stir in cooked rice, half the diced tomatoes, cumin, salt, and pepper.',
      'Stuff each pepper with the turkey-rice mixture. Place upright in a baking dish.',
      'Pour remaining diced tomatoes around the peppers. Top each with shredded cheese.',
      'Cover with foil and bake 30 minutes. Remove foil and bake 5 more minutes until cheese is bubbly.',
    ],
    filterTags: ['high-protein', 'gluten-free'],
    tasteTags: { savory: 0.8, hearty: 0.7, comfort: 0.6 },
    tips: 'Par-boil the peppers for 3 minutes before stuffing for a more tender result.',
    ingredientKeywords: ['turkey', 'red pepper', 'rice', 'tomato', 'onion', 'cheese'],
  },
  {
    name: 'Creamy Mushroom Pasta',
    tagline: 'Comfort food in 25 minutes',
    description: 'Silky pasta tossed in a rich garlic and mushroom cream sauce. Simple ingredients, extraordinary flavor.',
    difficulty: 'easy',
    servings: 4,
    prepTimeMinutes: 10,
    cookTimeMinutes: 15,
    ingredients: [
      { name: 'pasta (penne or fettuccine)', quantity: '400', unit: 'g' },
      { name: 'mushrooms', quantity: '300', unit: 'g' },
      { name: 'garlic cloves', quantity: '3', unit: 'cloves' },
      { name: 'butter', quantity: '3', unit: 'tbsp' },
      { name: 'yellow onion', quantity: '1', unit: 'small' },
      { name: 'heavy cream', quantity: '1', unit: 'cup' },
      { name: 'parmesan cheese', quantity: '0.5', unit: 'cup' },
      { name: 'fresh thyme', quantity: '1', unit: 'tsp' },
    ],
    steps: [
      'Cook pasta according to package directions. Reserve 1 cup of pasta water before draining.',
      'Melt butter in a large skillet over medium-high heat. Add sliced mushrooms and cook 5-6 minutes until golden.',
      'Add diced onion and minced garlic. Cook 2 minutes until softened.',
      'Pour in heavy cream and bring to a gentle simmer. Cook 3 minutes until slightly thickened.',
      'Toss in drained pasta and parmesan. Add pasta water a splash at a time until the desired consistency.',
      'Season with thyme, salt, and pepper. Serve immediately.',
    ],
    filterTags: ['vegetarian', 'comfort-food'],
    tasteTags: { creamy: 0.9, savory: 0.8, umami: 0.7 },
    tips: 'Do not wash mushrooms — wipe with a damp cloth to keep them from getting soggy.',
    ingredientKeywords: ['pasta', 'mushroom', 'garlic', 'butter', 'onion'],
  },
  {
    name: 'Teriyaki Chicken Bowl',
    tagline: 'Sweet, salty, crunchy',
    description: 'Glazed teriyaki chicken over steamed rice with crisp broccoli and cool cucumber. A balanced bowl of goodness.',
    difficulty: 'easy',
    servings: 4,
    prepTimeMinutes: 10,
    cookTimeMinutes: 15,
    ingredients: [
      { name: 'boneless skinless chicken thighs', quantity: '1.5', unit: 'lb' },
      { name: 'white rice', quantity: '2', unit: 'cups' },
      { name: 'broccoli florets', quantity: '2', unit: 'cups' },
      { name: 'cucumber', quantity: '1', unit: 'whole' },
      { name: 'soy sauce', quantity: '0.25', unit: 'cup' },
      { name: 'brown sugar', quantity: '2', unit: 'tbsp' },
      { name: 'rice vinegar', quantity: '1', unit: 'tbsp' },
      { name: 'sesame seeds', quantity: '1', unit: 'tbsp' },
    ],
    steps: [
      'Cook rice according to package directions. Steam broccoli until tender-crisp, about 4 minutes.',
      'Mix soy sauce, brown sugar, and rice vinegar for the teriyaki glaze.',
      'Season chicken thighs with salt and pepper. Sear in a hot skillet 5 minutes per side.',
      'Pour teriyaki glaze over chicken in the pan. Simmer 2 minutes until sauce thickens and chicken is coated.',
      'Slice cucumber into thin rounds.',
      'Assemble bowls: rice on the bottom, sliced chicken on top, broccoli and cucumber on the sides. Drizzle with extra sauce and sprinkle sesame seeds.',
    ],
    filterTags: ['high-protein', 'dairy-free'],
    tasteTags: { asian: 0.9, sweet: 0.6, savory: 0.8 },
    tips: 'Slice chicken against the grain after cooking for the most tender bites.',
    ingredientKeywords: ['chicken', 'rice', 'broccoli', 'cucumber', 'soy sauce'],
  },
  {
    name: 'Baked Salmon with Dill',
    tagline: 'Simple, elegant, foolproof',
    description: 'Perfectly baked salmon topped with fresh dill, lemon zest, and roasted asparagus on the side.',
    difficulty: 'easy',
    servings: 4,
    prepTimeMinutes: 8,
    cookTimeMinutes: 18,
    ingredients: [
      { name: 'salmon fillets', quantity: '4', unit: 'fillets' },
      { name: 'lemon', quantity: '1', unit: 'whole' },
      { name: 'garlic cloves', quantity: '2', unit: 'cloves' },
      { name: 'olive oil', quantity: '2', unit: 'tbsp' },
      { name: 'asparagus', quantity: '1', unit: 'bunch' },
      { name: 'fresh dill', quantity: '3', unit: 'tbsp' },
      { name: 'salt and pepper', quantity: '1', unit: 'tsp each' },
    ],
    steps: [
      'Preheat oven to 400F. Line a baking sheet with parchment paper.',
      'Place salmon fillets skin-side down on one half of the sheet. Arrange asparagus on the other half.',
      'Drizzle olive oil over everything. Season with salt, pepper, and minced garlic.',
      'Top salmon with chopped dill and lemon zest. Squeeze lemon juice over asparagus.',
      'Bake 16-18 minutes until salmon is opaque and flakes easily.',
      'Serve with lemon wedges on the side.',
    ],
    filterTags: ['high-protein', 'low-carb', 'gluten-free', 'dairy-free'],
    tasteTags: { fresh: 0.9, herbaceous: 0.8, light: 0.7 },
    tips: 'For crispy skin, start the salmon skin-side down in a hot oven-safe skillet for 2 minutes before transferring to the oven.',
    ingredientKeywords: ['salmon', 'lemon', 'garlic', 'olive oil', 'asparagus'],
  },
  {
    name: 'Beef Taco Bowl',
    tagline: 'Everything you love, no shell',
    description: 'Seasoned ground beef over rice with fresh tomatoes, crisp lettuce, creamy avocado, and all your favorite toppings.',
    difficulty: 'easy',
    servings: 4,
    prepTimeMinutes: 10,
    cookTimeMinutes: 15,
    ingredients: [
      { name: 'extra lean ground beef', quantity: '1', unit: 'lb' },
      { name: 'white rice', quantity: '2', unit: 'cups' },
      { name: 'roma tomatoes', quantity: '2', unit: 'whole' },
      { name: 'romaine lettuce', quantity: '2', unit: 'cups shredded' },
      { name: 'avocado', quantity: '1', unit: 'large' },
      { name: 'yellow onion', quantity: '0.5', unit: 'whole' },
      { name: 'taco seasoning', quantity: '2', unit: 'tbsp' },
      { name: 'shredded cheese', quantity: '0.5', unit: 'cup' },
      { name: 'sour cream', quantity: '0.25', unit: 'cup' },
    ],
    steps: [
      'Cook rice according to package directions.',
      'Brown ground beef with diced onion in a skillet over medium-high heat, breaking up as it cooks.',
      'Stir in taco seasoning and a splash of water. Simmer 3 minutes.',
      'Dice tomatoes and avocado. Shred lettuce.',
      'Assemble bowls: rice, taco beef, lettuce, tomatoes, avocado, cheese, and a dollop of sour cream.',
    ],
    filterTags: ['high-protein', 'quick'],
    tasteTags: { mexican: 0.8, savory: 0.8, fresh: 0.5 },
    tips: 'Squeeze lime juice over the avocado to keep it from browning and add brightness.',
    ingredientKeywords: ['beef', 'rice', 'tomato', 'lettuce', 'avocado', 'onion'],
  },
  {
    name: 'Pork Stir-Fry with Noodles',
    tagline: 'Wok-tossed goodness',
    description: 'Tender strips of pork stir-fried with egg noodles, garlic, and a savory soy glaze. Ready in under 20 minutes.',
    difficulty: 'easy',
    servings: 4,
    prepTimeMinutes: 10,
    cookTimeMinutes: 12,
    ingredients: [
      { name: 'pork loin', quantity: '1', unit: 'lb' },
      { name: 'egg noodles', quantity: '300', unit: 'g' },
      { name: 'garlic cloves', quantity: '3', unit: 'cloves' },
      { name: 'soy sauce', quantity: '3', unit: 'tbsp' },
      { name: 'yellow onion', quantity: '1', unit: 'medium' },
      { name: 'eggs', quantity: '2', unit: 'large' },
      { name: 'sesame oil', quantity: '1', unit: 'tbsp' },
      { name: 'bean sprouts', quantity: '1', unit: 'cup' },
    ],
    steps: [
      'Cook egg noodles according to package directions. Drain and set aside.',
      'Slice pork into thin strips. Season with salt and pepper.',
      'Heat sesame oil in a wok over high heat. Stir-fry pork strips 3-4 minutes until browned. Remove.',
      'Scramble eggs in the same wok. Add sliced onion and minced garlic, stir-fry 2 minutes.',
      'Return pork and add noodles. Pour soy sauce over everything and toss vigorously.',
      'Add bean sprouts, toss once more, and serve immediately.',
    ],
    filterTags: ['high-protein', 'quick', 'dairy-free'],
    tasteTags: { asian: 0.8, savory: 0.9, umami: 0.6 },
    tips: 'Slice pork against the grain and keep the wok screaming hot for the best sear.',
    ingredientKeywords: ['pork', 'egg', 'garlic', 'soy sauce', 'onion', 'noodle'],
  },
  {
    name: 'Mediterranean Chickpea Bowl',
    tagline: 'Fresh, bright, filling',
    description: 'A colorful grain bowl with spiced chickpeas, diced cucumber, juicy tomatoes, and a bright lemon-olive oil dressing.',
    difficulty: 'easy',
    servings: 4,
    prepTimeMinutes: 15,
    cookTimeMinutes: 10,
    ingredients: [
      { name: 'canned chickpeas', quantity: '2', unit: 'cans' },
      { name: 'cucumber', quantity: '1', unit: 'large' },
      { name: 'roma tomatoes', quantity: '3', unit: 'whole' },
      { name: 'olive oil', quantity: '3', unit: 'tbsp' },
      { name: 'lemon', quantity: '1', unit: 'whole' },
      { name: 'red onion', quantity: '0.5', unit: 'whole' },
      { name: 'feta cheese', quantity: '0.5', unit: 'cup' },
      { name: 'cumin', quantity: '1', unit: 'tsp' },
      { name: 'paprika', quantity: '0.5', unit: 'tsp' },
    ],
    steps: [
      'Drain and rinse chickpeas. Toss with 1 tbsp olive oil, cumin, paprika, salt, and pepper.',
      'Roast chickpeas in a skillet over medium-high heat for 8-10 minutes until golden and slightly crispy.',
      'Dice cucumber, tomatoes, and red onion.',
      'Whisk remaining olive oil with lemon juice, salt, and pepper for the dressing.',
      'Assemble bowls: spiced chickpeas, diced vegetables, crumbled feta, and a generous drizzle of lemon dressing.',
    ],
    filterTags: ['vegetarian', 'high-fiber', 'gluten-free'],
    tasteTags: { mediterranean: 0.9, fresh: 0.9, light: 0.7 },
    tips: 'Add a scoop of cooked quinoa or couscous to make it even more filling.',
    ingredientKeywords: ['chickpea', 'cucumber', 'tomato', 'olive oil', 'lemon'],
  },
  {
    name: 'Chicken Parmesan',
    tagline: 'Crispy outside, cheesy inside',
    description: 'Golden-crusted chicken cutlets topped with marinara sauce and melted mozzarella, served over spaghetti.',
    difficulty: 'medium',
    servings: 4,
    prepTimeMinutes: 15,
    cookTimeMinutes: 25,
    ingredients: [
      { name: 'boneless skinless chicken breast', quantity: '4', unit: 'breasts' },
      { name: 'spaghetti', quantity: '400', unit: 'g' },
      { name: 'marinara sauce', quantity: '2', unit: 'cups' },
      { name: 'mozzarella cheese', quantity: '1.5', unit: 'cups shredded' },
      { name: 'breadcrumbs', quantity: '1', unit: 'cup' },
      { name: 'garlic powder', quantity: '1', unit: 'tsp' },
      { name: 'eggs', quantity: '2', unit: 'large' },
      { name: 'parmesan cheese', quantity: '0.5', unit: 'cup grated' },
      { name: 'olive oil', quantity: '3', unit: 'tbsp' },
    ],
    steps: [
      'Preheat oven to 425F. Cook spaghetti according to package directions.',
      'Pound chicken breasts to even 1/2-inch thickness between plastic wrap.',
      'Set up breading station: beaten eggs in one dish, breadcrumbs mixed with garlic powder and parmesan in another.',
      'Dip chicken in egg, then press into breadcrumb mixture on both sides.',
      'Pan-fry breaded chicken in olive oil over medium-high heat, 3 minutes per side until golden.',
      'Transfer chicken to a baking sheet, top with marinara and mozzarella. Bake 10 minutes until cheese is melted and bubbly. Serve over spaghetti.',
    ],
    filterTags: ['high-protein', 'comfort-food'],
    tasteTags: { italian: 0.9, savory: 0.8, cheesy: 0.9 },
    tips: 'Let the breaded chicken rest 5 minutes before frying so the coating adheres better.',
    ingredientKeywords: ['chicken', 'pasta', 'tomato', 'cheese', 'bread', 'garlic'],
  },
];

// ============================================================
// Users
// ============================================================

interface UserDef {
  displayName: string;
  email: string;
  postalCode: string;
  budget: number;
  dietaryRestrictions: string[];
  maxStores: number;
  householdSize: number;
}

const users: UserDef[] = [
  { displayName: 'Jessica M', email: 'jessica@test.groceryhack.com', postalCode: 'L8P 1A1', budget: 100, dietaryRestrictions: [], maxStores: 2, householdSize: 4 },
  { displayName: 'Marcus T', email: 'marcus@test.groceryhack.com', postalCode: 'L8H 3Z5', budget: 75, dietaryRestrictions: [], maxStores: 1, householdSize: 2 },
  { displayName: 'Priya K', email: 'priya@test.groceryhack.com', postalCode: 'L8S 3L3', budget: 120, dietaryRestrictions: ['vegetarian'], maxStores: 2, householdSize: 4 },
  { displayName: 'David L', email: 'david@test.groceryhack.com', postalCode: 'L9C 5N2', budget: 60, dietaryRestrictions: ['gluten-free'], maxStores: 1, householdSize: 1 },
  { displayName: 'Sarah C', email: 'sarah@test.groceryhack.com', postalCode: 'L7R 1R2', budget: 90, dietaryRestrictions: [], maxStores: 2, householdSize: 3 },
];

// ============================================================
// Family members (inserted after regular users due to FK dependency)
// ============================================================

interface FamilyMemberDef {
  displayName: string;
  email: string;
  postalCode: string;
  budget: number;
  maxStores: number;
  householdSize: number;
  accountHolderEmail: string;
}

const familyMembers: FamilyMemberDef[] = [
  {
    displayName: 'Sam M',
    email: 'sam@test.groceryhack.com',
    postalCode: 'L8P 1A1',
    budget: 100,
    maxStores: 1,
    householdSize: 4,
    accountHolderEmail: 'jessica@test.groceryhack.com',
  },
];

// ============================================================
// Swipe preferences: { userEmail, mealName, liked }
// ============================================================

interface SwipeDef {
  userEmail: string;
  mealName: string;
  liked: boolean;
}

const swipes: SwipeDef[] = [
  // Jessica (10 swipes, 6 liked)
  { userEmail: 'jessica@test.groceryhack.com', mealName: 'Honey Garlic Chicken Stir-Fry', liked: true },
  { userEmail: 'jessica@test.groceryhack.com', mealName: 'Sheet Pan Pork Chops', liked: true },
  { userEmail: 'jessica@test.groceryhack.com', mealName: 'Beef Taco Bowl', liked: true },
  { userEmail: 'jessica@test.groceryhack.com', mealName: 'Chicken Caesar Salad', liked: true },
  { userEmail: 'jessica@test.groceryhack.com', mealName: 'Classic Beef Bolognese', liked: true },
  { userEmail: 'jessica@test.groceryhack.com', mealName: 'Teriyaki Chicken Bowl', liked: true },
  { userEmail: 'jessica@test.groceryhack.com', mealName: 'Creamy Mushroom Pasta', liked: false },
  { userEmail: 'jessica@test.groceryhack.com', mealName: 'One-Pan Lemon Herb Salmon', liked: false },
  { userEmail: 'jessica@test.groceryhack.com', mealName: 'Mediterranean Chickpea Bowl', liked: false },
  { userEmail: 'jessica@test.groceryhack.com', mealName: 'Veggie Black Bean Tacos', liked: false },

  // Marcus (10 swipes, 6 liked)
  { userEmail: 'marcus@test.groceryhack.com', mealName: 'Classic Beef Bolognese', liked: true },
  { userEmail: 'marcus@test.groceryhack.com', mealName: 'Shrimp Fried Rice', liked: true },
  { userEmail: 'marcus@test.groceryhack.com', mealName: 'Chicken Parmesan', liked: true },
  { userEmail: 'marcus@test.groceryhack.com', mealName: 'Teriyaki Chicken Bowl', liked: true },
  { userEmail: 'marcus@test.groceryhack.com', mealName: 'Beef Taco Bowl', liked: true },
  { userEmail: 'marcus@test.groceryhack.com', mealName: 'Pork Stir-Fry with Noodles', liked: true },
  { userEmail: 'marcus@test.groceryhack.com', mealName: 'Veggie Black Bean Tacos', liked: false },
  { userEmail: 'marcus@test.groceryhack.com', mealName: 'Mediterranean Chickpea Bowl', liked: false },
  { userEmail: 'marcus@test.groceryhack.com', mealName: 'One-Pan Lemon Herb Salmon', liked: false },
  { userEmail: 'marcus@test.groceryhack.com', mealName: 'Baked Salmon with Dill', liked: false },

  // Priya (10 swipes, 6 liked — all vegetarian meals + Mediterranean Chickpea Bowl)
  { userEmail: 'priya@test.groceryhack.com', mealName: 'Veggie Black Bean Tacos', liked: true },
  { userEmail: 'priya@test.groceryhack.com', mealName: 'Creamy Mushroom Pasta', liked: true },
  { userEmail: 'priya@test.groceryhack.com', mealName: 'Mediterranean Chickpea Bowl', liked: true },
  { userEmail: 'priya@test.groceryhack.com', mealName: 'Honey Garlic Chicken Stir-Fry', liked: false },
  { userEmail: 'priya@test.groceryhack.com', mealName: 'Classic Beef Bolognese', liked: false },
  { userEmail: 'priya@test.groceryhack.com', mealName: 'Chicken Caesar Salad', liked: false },
  { userEmail: 'priya@test.groceryhack.com', mealName: 'Sheet Pan Pork Chops', liked: false },
  { userEmail: 'priya@test.groceryhack.com', mealName: 'Shrimp Fried Rice', liked: true },
  { userEmail: 'priya@test.groceryhack.com', mealName: 'Turkey Stuffed Peppers', liked: false },
  { userEmail: 'priya@test.groceryhack.com', mealName: 'Baked Salmon with Dill', liked: true },

  // David (8 swipes, 5 liked)
  { userEmail: 'david@test.groceryhack.com', mealName: 'Classic Beef Bolognese', liked: true },
  { userEmail: 'david@test.groceryhack.com', mealName: 'Shrimp Fried Rice', liked: true },
  { userEmail: 'david@test.groceryhack.com', mealName: 'One-Pan Lemon Herb Salmon', liked: true },
  { userEmail: 'david@test.groceryhack.com', mealName: 'Sheet Pan Pork Chops', liked: true },
  { userEmail: 'david@test.groceryhack.com', mealName: 'Teriyaki Chicken Bowl', liked: true },
  { userEmail: 'david@test.groceryhack.com', mealName: 'Creamy Mushroom Pasta', liked: false },
  { userEmail: 'david@test.groceryhack.com', mealName: 'Chicken Parmesan', liked: false },
  { userEmail: 'david@test.groceryhack.com', mealName: 'Veggie Black Bean Tacos', liked: false },

  // Sarah (10 swipes, 6 liked)
  { userEmail: 'sarah@test.groceryhack.com', mealName: 'Honey Garlic Chicken Stir-Fry', liked: true },
  { userEmail: 'sarah@test.groceryhack.com', mealName: 'Sheet Pan Pork Chops', liked: true },
  { userEmail: 'sarah@test.groceryhack.com', mealName: 'Beef Taco Bowl', liked: true },
  { userEmail: 'sarah@test.groceryhack.com', mealName: 'One-Pan Lemon Herb Salmon', liked: true },
  { userEmail: 'sarah@test.groceryhack.com', mealName: 'Chicken Parmesan', liked: true },
  { userEmail: 'sarah@test.groceryhack.com', mealName: 'Baked Salmon with Dill', liked: true },
  { userEmail: 'sarah@test.groceryhack.com', mealName: 'Pork Stir-Fry with Noodles', liked: false },
  { userEmail: 'sarah@test.groceryhack.com', mealName: 'Turkey Stuffed Peppers', liked: false },
  { userEmail: 'sarah@test.groceryhack.com', mealName: 'Mediterranean Chickpea Bowl', liked: false },
  { userEmail: 'sarah@test.groceryhack.com', mealName: 'Creamy Mushroom Pasta', liked: false },
];

// ============================================================
// Important items
// ============================================================

interface ImportantItemDef {
  userEmail: string;
  name: string;
  quantity: string;
}

const importantItems: ImportantItemDef[] = [
  // Jessica M
  { userEmail: 'jessica@test.groceryhack.com', name: 'Milk', quantity: '2L' },
  { userEmail: 'jessica@test.groceryhack.com', name: 'Eggs', quantity: '1 dozen' },
  { userEmail: 'jessica@test.groceryhack.com', name: 'Bread', quantity: '1 loaf' },
  { userEmail: 'jessica@test.groceryhack.com', name: 'Bananas', quantity: '1 bunch' },
  { userEmail: 'jessica@test.groceryhack.com', name: 'Yogurt', quantity: '750g' },
  // Marcus T
  { userEmail: 'marcus@test.groceryhack.com', name: 'Milk', quantity: '2L' },
  { userEmail: 'marcus@test.groceryhack.com', name: 'Coffee beans', quantity: '1 bag' },
  { userEmail: 'marcus@test.groceryhack.com', name: 'Rice', quantity: '1 bag' },
  // Priya K
  { userEmail: 'priya@test.groceryhack.com', name: 'Milk', quantity: '2L' },
  { userEmail: 'priya@test.groceryhack.com', name: 'Bread', quantity: '1 loaf' },
  { userEmail: 'priya@test.groceryhack.com', name: 'Spinach', quantity: '1 bag' },
  { userEmail: 'priya@test.groceryhack.com', name: 'Tofu', quantity: '1 block' },
  // David L
  { userEmail: 'david@test.groceryhack.com', name: 'Eggs', quantity: '1 dozen' },
  { userEmail: 'david@test.groceryhack.com', name: 'Chicken breast', quantity: '1 lb' },
  { userEmail: 'david@test.groceryhack.com', name: 'Broccoli', quantity: '1 head' },
  // Sarah C
  { userEmail: 'sarah@test.groceryhack.com', name: 'Milk', quantity: '4L' },
  { userEmail: 'sarah@test.groceryhack.com', name: 'Eggs', quantity: '18pk' },
  { userEmail: 'sarah@test.groceryhack.com', name: 'Butter', quantity: '454g' },
  { userEmail: 'sarah@test.groceryhack.com', name: 'Bananas', quantity: '1 bunch' },
  { userEmail: 'sarah@test.groceryhack.com', name: 'Bread', quantity: '1 loaf' },
  { userEmail: 'sarah@test.groceryhack.com', name: 'Orange juice', quantity: '2.63L' },
];

// ============================================================
// Seed execution
// ============================================================

async function seed(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ----------------------------------------------------------
    // 0. Truncate all tables (reverse dependency order)
    // ----------------------------------------------------------
    console.log('Truncating all tables...');
    await client.query(`
      TRUNCATE
        events,
        usage_tracking,
        flyer_requests,
        weekly_plans,
        meal_shares,
        important_items,
        deal_watchlist,
        user_meal_preferences,
        user_recipes,
        deals,
        store_locations,
        store_brands,
        password_reset_tokens,
        users,
        meals
      CASCADE
    `);

    // ----------------------------------------------------------
    // 1. Store brands
    // ----------------------------------------------------------
    console.log('Inserting store brands...');
    for (const brand of storeBrands) {
      await client.query(
        `INSERT INTO store_brands (id, name, flyer_url, scrape_status, last_scraped_at)
         VALUES ($1, $2, $3, $4, now())`,
        [makeUuid(`brand:${brand.name}`), brand.name, brand.flyerUrl, brand.scrapeStatus],
      );
    }
    console.log(`  ${storeBrands.length} store brands inserted.`);

    // ----------------------------------------------------------
    // 2. Store locations
    // ----------------------------------------------------------
    console.log('Inserting store locations...');
    for (const loc of storeLocations) {
      await client.query(
        `INSERT INTO store_locations (id, store_brand_id, address, city, region, postal_zip, lat, lng)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          makeUuid(`location:${loc.brand}:${loc.address}`),
          makeUuid(`brand:${loc.brand}`),
          loc.address,
          loc.city,
          loc.region,
          loc.postalZip,
          loc.lat,
          loc.lng,
        ],
      );
    }
    console.log(`  ${storeLocations.length} store locations inserted.`);

    // ----------------------------------------------------------
    // 3. Deals
    // ----------------------------------------------------------
    console.log('Inserting deals...');
    const { validFrom, validTo } = getCurrentWeekRange();
    console.log(`  Deal validity: ${validFrom} to ${validTo}`);

    for (const deal of deals) {
      await client.query(
        `INSERT INTO deals (id, store_brand_id, item_name, category, sale_price, regular_price, unit, valid_from, valid_to, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'flyer')`,
        [
          makeUuid(`deal:${deal.brand}:${deal.itemName}`),
          makeUuid(`brand:${deal.brand}`),
          deal.itemName,
          deal.category,
          deal.salePrice,
          deal.regularPrice,
          deal.unit,
          validFrom,
          validTo,
        ],
      );
    }
    console.log(`  ${deals.length} deals inserted.`);

    // ----------------------------------------------------------
    // 4. Meals
    // ----------------------------------------------------------
    console.log('Inserting meals...');
    for (const meal of mealDefs) {
      await client.query(
        `INSERT INTO meals (
           id, name, tagline, description, ingredients, steps,
           prep_time_minutes, cook_time_minutes, servings, difficulty,
           filter_tags, taste_tags, tips, ingredient_keywords
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          makeUuid(`meal:${meal.name}`),
          meal.name,
          meal.tagline,
          meal.description,
          JSON.stringify(meal.ingredients),
          meal.steps,
          meal.prepTimeMinutes,
          meal.cookTimeMinutes,
          meal.servings,
          meal.difficulty,
          meal.filterTags,
          JSON.stringify(meal.tasteTags),
          meal.tips,
          meal.ingredientKeywords,
        ],
      );
    }
    console.log(`  ${mealDefs.length} meals inserted.`);

    // ----------------------------------------------------------
    // 5. Users
    // ----------------------------------------------------------
    console.log('Inserting users...');
    const passwordHash = await bcrypt.hash('testpassword123', 10);
    for (const user of users) {
      await client.query(
        `INSERT INTO users (
           id, email, password_hash, display_name, postal_code, budget,
           dietary_restrictions, max_stores, household_size
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          makeUuid(`user:${user.email}`),
          user.email,
          passwordHash,
          user.displayName,
          user.postalCode,
          user.budget,
          user.dietaryRestrictions,
          user.maxStores,
          user.householdSize,
        ],
      );
    }
    console.log(`  ${users.length} users inserted.`);

    // ----------------------------------------------------------
    // 5b. Family members
    // ----------------------------------------------------------
    console.log('Inserting family members...');
    for (const member of familyMembers) {
      await client.query(
        `INSERT INTO users (
           id, email, password_hash, display_name, postal_code, budget,
           dietary_restrictions, max_stores, household_size, account_holder_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          makeUuid(`user:${member.email}`),
          member.email,
          passwordHash,
          member.displayName,
          member.postalCode,
          member.budget,
          [],
          member.maxStores,
          member.householdSize,
          makeUuid(`user:${member.accountHolderEmail}`),
        ],
      );
    }
    console.log(`  ${familyMembers.length} family members inserted.`);

    // ----------------------------------------------------------
    // 6. User meal preferences (swipe data)
    // ----------------------------------------------------------
    console.log('Inserting user meal preferences...');
    for (const swipe of swipes) {
      const userShort = swipe.userEmail.split('@')[0]!;
      await client.query(
        `INSERT INTO user_meal_preferences (id, user_id, meal_id, liked)
         VALUES ($1, $2, $3, $4)`,
        [
          makeUuid(`pref:${userShort}:${swipe.mealName}`),
          makeUuid(`user:${swipe.userEmail}`),
          makeUuid(`meal:${swipe.mealName}`),
          swipe.liked,
        ],
      );
    }
    console.log(`  ${swipes.length} swipe preferences inserted.`);

    // ----------------------------------------------------------
    // 7. Important items
    // ----------------------------------------------------------
    console.log('Inserting important items...');
    for (const item of importantItems) {
      const userShort = item.userEmail.split('@')[0]!;
      await client.query(
        `INSERT INTO important_items (id, user_id, name, quantity, is_active)
         VALUES ($1, $2, $3, $4, true)`,
        [
          makeUuid(`item:${userShort}:${item.name}`),
          makeUuid(`user:${item.userEmail}`),
          item.name,
          item.quantity,
        ],
      );
    }
    console.log(`  ${importantItems.length} important items inserted.`);

    await client.query('COMMIT');

    // ----------------------------------------------------------
    // Summary
    // ----------------------------------------------------------
    console.log('\n========================================');
    console.log('Seed completed successfully!');
    console.log('========================================');
    console.log(`  Store brands:      ${storeBrands.length}`);
    console.log(`  Store locations:   ${storeLocations.length}`);
    console.log(`  Deals:             ${deals.length}`);
    console.log(`  Meals:             ${mealDefs.length}`);
    console.log(`  Users:             ${users.length}`);
    console.log(`  Family members:    ${familyMembers.length}`);
    console.log(`  Swipe preferences: ${swipes.length}`);
    console.log(`  Important items:   ${importantItems.length}`);
    console.log(`  Deal validity:     ${validFrom} to ${validTo}`);
    console.log('========================================');
    console.log('Test accounts (password: testpassword123):');
    for (const user of users) {
      console.log(`  ${user.email} — ${user.displayName}`);
    }
    for (const member of familyMembers) {
      console.log(`  ${member.email} — ${member.displayName} [family member of ${member.accountHolderEmail}]`);
    }
    console.log('========================================\n');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seed failed, rolled back:', error);
    throw error;
  } finally {
    client.release();
  }

  await pool.end();
}

seed().catch((error: unknown) => {
  console.error('Fatal seed error:', error);
  process.exit(1);
});
