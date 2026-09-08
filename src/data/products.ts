import type { Product } from "../domain/types";

/**
 * Shelf lines, priced roughly as a UK supermarket prices them in 2026.
 * Several ingredients carry more than one pack size so the matcher has a
 * real choice to make between a small pack and a cheaper big one.
 */
export const PRODUCTS: Product[] = [
  // Produce
  { id: "sku-onion-3",     ingredientId: "onion",        name: "Brown onions",             size: "3 pack",   packQty: 3,    price: 0.85 },
  { id: "sku-onion-1kg",   ingredientId: "onion",        name: "Brown onions",             size: "1kg bag",  packQty: 8,    price: 1.45, ownBrand: true },
  { id: "sku-garlic",      ingredientId: "garlic",       name: "Garlic bulbs",             size: "2 pack",   packQty: 20,   price: 0.80 },
  { id: "sku-carrot-1kg",  ingredientId: "carrot",       name: "Carrots",                  size: "1kg",      packQty: 1000, price: 0.75, ownBrand: true },
  { id: "sku-potato-25",   ingredientId: "potato",       name: "Maris Piper potatoes",     size: "2.5kg",    packQty: 2500, price: 2.40, ownBrand: true },
  { id: "sku-potato-1",    ingredientId: "potato",       name: "Baby new potatoes",        size: "1kg",      packQty: 1000, price: 1.60 },
  { id: "sku-tomato-400",  ingredientId: "tomato",       name: "Vine tomatoes",            size: "400g",     packQty: 400,  price: 1.45, was: 1.85 },
  { id: "sku-pepper-3",    ingredientId: "pepper",       name: "Mixed peppers",            size: "3 pack",   packQty: 3,    price: 1.75 },
  { id: "sku-chilli",      ingredientId: "chilli",       name: "Red chillies",             size: "50g pack", packQty: 6,    price: 0.75 },
  { id: "sku-mushroom",    ingredientId: "mushroom",     name: "Chestnut mushrooms",       size: "250g",     packQty: 250,  price: 1.15 },
  { id: "sku-spinach",     ingredientId: "spinach",      name: "Baby spinach",             size: "200g",     packQty: 200,  price: 1.20 },
  { id: "sku-broccoli",    ingredientId: "broccoli",     name: "Tenderstem broccoli",      size: "200g",     packQty: 200,  price: 1.90 },
  { id: "sku-lemon-4",     ingredientId: "lemon",        name: "Unwaxed lemons",           size: "4 pack",   packQty: 4,    price: 1.10 },
  { id: "sku-lime-5",      ingredientId: "lime",         name: "Limes",                    size: "5 pack",   packQty: 5,    price: 1.00 },
  { id: "sku-coriander",   ingredientId: "coriander",    name: "Fresh coriander",          size: "30g",      packQty: 30,   price: 0.85 },
  { id: "sku-ginger",      ingredientId: "ginger",       name: "Root ginger",              size: "70g",      packQty: 70,   price: 0.60 },

  // Meat & fish
  { id: "sku-beef-500",    ingredientId: "beef-mince",   name: "British beef mince, 5%",   size: "500g",     packQty: 500,  price: 4.40 },
  { id: "sku-beef-750",    ingredientId: "beef-mince",   name: "British beef mince, 5%",   size: "750g",     packQty: 750,  price: 6.15 },
  { id: "sku-lamb-500",    ingredientId: "lamb-mince",   name: "British lamb mince",       size: "500g",     packQty: 500,  price: 5.75 },
  { id: "sku-chick-650",   ingredientId: "chicken-breast", name: "British chicken breasts", size: "650g",    packQty: 650,  price: 5.25 },
  { id: "sku-chick-300",   ingredientId: "chicken-breast", name: "British chicken breasts", size: "300g",    packQty: 300,  price: 2.95 },
  { id: "sku-thigh-1kg",   ingredientId: "chicken-thigh", name: "Chicken thigh fillets",   size: "1kg",      packQty: 1000, price: 6.50, ownBrand: true },
  { id: "sku-salmon-2",    ingredientId: "salmon",       name: "Scottish salmon fillets",  size: "2 × 120g", packQty: 240,  price: 4.95, was: 5.75 },
  { id: "sku-sausage-6",   ingredientId: "sausage",      name: "Cumberland sausages",      size: "6 pack",   packQty: 6,    price: 3.20, ownBrand: true },
  { id: "sku-bacon",       ingredientId: "bacon",        name: "Smoked back bacon",        size: "300g",     packQty: 300,  price: 2.85 },

  // Dairy
  { id: "sku-milk-2pt",    ingredientId: "milk",         name: "Semi-skimmed milk",        size: "2 pints",  packQty: 1136, price: 1.35 },
  { id: "sku-milk-4pt",    ingredientId: "milk",         name: "Semi-skimmed milk",        size: "4 pints",  packQty: 2272, price: 1.75 },
  { id: "sku-butter",      ingredientId: "butter",       name: "Salted butter block",      size: "250g",     packQty: 250,  price: 2.10, was: 2.60 },
  { id: "sku-cheddar-350", ingredientId: "cheddar",      name: "Mature cheddar",           size: "350g",     packQty: 350,  price: 3.50, ownBrand: true },
  { id: "sku-cheddar-550", ingredientId: "cheddar",      name: "Mature cheddar",           size: "550g",     packQty: 550,  price: 4.75 },
  { id: "sku-creme",       ingredientId: "creme-fraiche", name: "Half-fat crème fraîche",  size: "300g",     packQty: 300,  price: 1.30 },
  { id: "sku-egg-6",       ingredientId: "egg",          name: "Free range eggs, large",   size: "6 pack",   packQty: 6,    price: 2.20 },
  { id: "sku-egg-12",      ingredientId: "egg",          name: "Free range eggs, large",   size: "12 pack",  packQty: 12,   price: 3.60 },
  { id: "sku-yoghurt",     ingredientId: "yoghurt",      name: "Natural yoghurt",          size: "500g",     packQty: 500,  price: 1.25, ownBrand: true },

  // Cupboard
  { id: "sku-chopped-1",   ingredientId: "chopped-tomatoes", name: "Chopped tomatoes",     size: "400g tin", packQty: 400,  price: 0.55, ownBrand: true },
  { id: "sku-chopped-4",   ingredientId: "chopped-tomatoes", name: "Chopped tomatoes",     size: "4 × 400g", packQty: 1600, price: 1.90 },
  { id: "sku-puree",       ingredientId: "tomato-puree", name: "Tomato purée",             size: "200g",     packQty: 200,  price: 0.90 },
  { id: "sku-spag",        ingredientId: "spaghetti",    name: "Spaghetti",                size: "500g",     packQty: 500,  price: 0.95, ownBrand: true },
  { id: "sku-mac",         ingredientId: "macaroni",     name: "Macaroni",                 size: "500g",     packQty: 500,  price: 0.95, ownBrand: true },
  { id: "sku-rice-1kg",    ingredientId: "rice",         name: "Basmati rice",             size: "1kg",      packQty: 1000, price: 2.60 },
  { id: "sku-tortilla-8",  ingredientId: "tortilla",     name: "Plain tortilla wraps",     size: "8 pack",   packQty: 8,    price: 1.20 },
  { id: "sku-kidney",      ingredientId: "kidney-beans", name: "Red kidney beans",         size: "400g tin", packQty: 400,  price: 0.60, ownBrand: true },
  { id: "sku-chickpea",    ingredientId: "chickpeas",    name: "Chickpeas",                size: "400g tin", packQty: 400,  price: 0.65, ownBrand: true },
  { id: "sku-coconut",     ingredientId: "coconut-milk", name: "Coconut milk",             size: "400ml",    packQty: 400,  price: 1.20 },
  { id: "sku-tikka",       ingredientId: "curry-paste",  name: "Tikka masala paste",       size: "180g",     packQty: 180,  price: 1.85 },
  { id: "sku-fajita",      ingredientId: "fajita-mix",   name: "Fajita seasoning",         size: "35g",      packQty: 35,   price: 0.80 },
  { id: "sku-stock",       ingredientId: "stock-cube",   name: "Chicken stock cubes",      size: "12 pack",  packQty: 12,   price: 1.40 },
  { id: "sku-oil",         ingredientId: "olive-oil",    name: "Olive oil",                size: "500ml",    packQty: 500,  price: 3.40 },
  { id: "sku-flour",       ingredientId: "flour",        name: "Plain flour",              size: "1.5kg",    packQty: 1500, price: 1.10, ownBrand: true },
  { id: "sku-worcs",       ingredientId: "worcestershire", name: "Worcestershire sauce",   size: "150ml",    packQty: 150,  price: 1.75 },

  // Frozen
  { id: "sku-peas",        ingredientId: "peas",         name: "Garden peas",              size: "900g",     packQty: 900,  price: 1.75, ownBrand: true },
];
