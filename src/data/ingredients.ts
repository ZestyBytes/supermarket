import type { Ingredient } from "../domain/types";
import { FAVOURITE_INGREDIENTS } from './favouriteIngredients';

/** Every ingredient the recipes can call for, in the unit it is counted in. */
export const INGREDIENTS: Ingredient[] = [
  ...FAVOURITE_INGREDIENTS,
  // Produce
  { id: "onion",        name: "Onions",              unit: "each", aisle: "produce" },
  { id: "garlic",       name: "Garlic",              unit: "each", aisle: "produce", countNoun: "clove", staple: true },
  { id: "carrot",       name: "Carrots",             unit: "g",    aisle: "produce" },
  { id: "potato",       name: "Potatoes",            unit: "g",    aisle: "produce" },
  { id: "tomato",       name: "Tomatoes",            unit: "g",    aisle: "produce" },
  { id: "pepper",       name: "Peppers",             unit: "each", aisle: "produce" },
  { id: "chilli",       name: "Red chillies",        unit: "each", aisle: "produce" },
  { id: "mushroom",     name: "Chestnut mushrooms",  unit: "g",    aisle: "produce" },
  { id: "spinach",      name: "Baby spinach",        unit: "g",    aisle: "produce" },
  { id: "broccoli",     name: "Tenderstem broccoli", unit: "g",    aisle: "produce" },
  { id: "lemon",        name: "Lemons",              unit: "each", aisle: "produce" },
  { id: "lime",         name: "Limes",               unit: "each", aisle: "produce" },
  { id: "coriander",    name: "Fresh coriander",     unit: "g",    aisle: "produce" },
  { id: "ginger",       name: "Root ginger",         unit: "g",    aisle: "produce" },

  // Meat & fish
  { id: "beef-mince",   name: "Beef mince, 5% fat",  unit: "g",    aisle: "meat-fish" },
  { id: "lamb-mince",   name: "Lamb mince",          unit: "g",    aisle: "meat-fish" },
  { id: "chicken-breast", name: "Chicken breast",    unit: "g",    aisle: "meat-fish" },
  { id: "chicken-thigh",  name: "Chicken thighs",    unit: "g",    aisle: "meat-fish" },
  { id: "salmon",       name: "Salmon fillets",      unit: "g",    aisle: "meat-fish" },
  { id: "sausage",      name: "Pork sausages",       unit: "each", aisle: "meat-fish" },
  { id: "bacon",        name: "Smoked bacon",        unit: "g",    aisle: "meat-fish" },

  // Dairy
  { id: "milk",         name: "Semi-skimmed milk",   unit: "ml",   aisle: "dairy" },
  { id: "butter",       name: "Salted butter",       unit: "g",    aisle: "dairy" },
  { id: "cheddar",      name: "Mature cheddar",      unit: "g",    aisle: "dairy" },
  { id: "creme-fraiche",name: "Crème fraîche",       unit: "g",    aisle: "dairy" },
  { id: "egg",          name: "Free range eggs",     unit: "each", aisle: "dairy" },
  { id: "yoghurt",      name: "Natural yoghurt",     unit: "g",    aisle: "dairy" },

  // Cupboard
  { id: "chopped-tomatoes", name: "Chopped tomatoes", unit: "g",   aisle: "cupboard" },
  { id: "tomato-puree", name: "Tomato purée",        unit: "g",    aisle: "cupboard", staple: true },
  { id: "spaghetti",    name: "Spaghetti",           unit: "g",    aisle: "cupboard" },
  { id: "macaroni",     name: "Macaroni",            unit: "g",    aisle: "cupboard" },
  { id: "rice",         name: "Basmati rice",        unit: "g",    aisle: "cupboard" },
  { id: "tortilla",     name: "Tortilla wraps",      unit: "each", aisle: "cupboard" },
  { id: "kidney-beans", name: "Red kidney beans",    unit: "g",    aisle: "cupboard" },
  { id: "chickpeas",    name: "Chickpeas",           unit: "g",    aisle: "cupboard" },
  { id: "coconut-milk", name: "Coconut milk",        unit: "ml",   aisle: "cupboard" },
  { id: "curry-paste",  name: "Tikka curry paste",   unit: "g",    aisle: "cupboard" },
  { id: "fajita-mix",   name: "Fajita seasoning",    unit: "g",    aisle: "cupboard" },
  { id: "stock-cube",   name: "Stock cubes",         unit: "each", aisle: "cupboard", staple: true },
  { id: "olive-oil",    name: "Olive oil",           unit: "ml",   aisle: "cupboard", staple: true },
  { id: "flour",        name: "Plain flour",         unit: "g",    aisle: "cupboard", staple: true },
  { id: "worcestershire", name: "Worcestershire sauce", unit: "ml", aisle: "cupboard", staple: true },

  // Frozen
  { id: "peas",         name: "Garden peas",         unit: "g",    aisle: "frozen" },
];
