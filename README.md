# Supermarket

UK meal planning that ends in one grocery basket.

**Choose meals → work out the ingredients → consolidate the quantities → match them to real
products → add the lot to the basket.**

Plan Spaghetti Bolognese, Chicken Fajitas, Cottage Pie, Chicken Curry and Salmon & Potatoes and
the app works out that four of those want onions — 6 in total — and buys one 1kg bag, not four
separate lines.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
```

Other scripts: `npm test` (48 unit tests), `npm run typecheck`, `npm run build`, `npm run preview`.

## How it works

The pipeline is four pure functions, each testable on its own:

| Step | Module | What it does |
| --- | --- | --- |
| 1. Normalise | `src/domain/units.ts` | Converts kg/g, l/ml, tbsp/tsp and counts into one unit per ingredient, and refuses nonsense (500g of onions) |
| 2. Consolidate | `src/domain/consolidate.ts` | Scales each meal to the servings you are cooking, then sums per ingredient across the week, remembering which recipes asked |
| 3. Match | `src/domain/match.ts` | Picks the product that covers each requirement most cheaply in whole packs, keeps the runners-up as alternatives, skips cupboard staples |
| 4. Basket | `src/domain/basket.ts` | Tops the basket up to the plan (never doubles it), totals goods, offers and delivery |

Data lives in `src/data/`: 43 ingredients, 51 product lines with real pack sizes, 12 recipes.

### The bits that make it correct rather than approximate

- **Ingredients are first-class.** Recipes reference an ingredient id, products declare which
  ingredient they contain and how much is in a pack. Consolidation happens on the ingredient, so
  it does not matter that one recipe writes `1.2kg potato` and another `500g`.
- **Whole packs.** You cannot buy 630g of mince. Requirements round up to packs, with the surplus
  shown so you know what is left over.
- **Cheapest cover, not cheapest unit price.** For 600g of mince a single 750g pack (£6.15) beats
  two 500g packs (£8.80), even though the small pack has a better price per kilo. Swap the choice
  per line if you disagree.
- **Servings scale.** Salmon & Potatoes is written for 2; cook it for 4 and the fish doubles.
- **Pantry.** Olive oil, flour, stock cubes, garlic, purée and Worcestershire sauce start ticked as
  already-in-the-cupboard, and any line can be toggled.

## What is not built

- **A real retailer basket.** Tesco, Sainsbury's and Ocado all gate their basket APIs behind
  partner credentials, so the app exports the list (copy to clipboard, CSV) instead.
  `src/domain/handoff.ts` defines the `BasketTarget` interface a real adapter would implement.
- Accounts, saved plans across devices, live stock or live prices — prices are static sample data.
- Nutrition, leftovers, or carrying an ingredient over to next week.

## Layout

```
src/
  domain/         the pipeline above, plus __tests__/ alongside it
  data/           ingredients, products, recipes, delivery slots
  ui/             React components and the stylesheet
  App.tsx         wires state to the pipeline
```
