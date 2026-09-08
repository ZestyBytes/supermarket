# Supermarket

UK meal planning that ends in one grocery basket.

**Choose meals → work out the ingredients → consolidate the quantities → match them to real
products → add the lot to the basket.**

Plan Spaghetti Bolognese, Chicken Fajitas, Cottage Pie, Chicken Curry and Salmon & Potatoes and
the app works out that four of those want onions — 6 in total — and buys one 1kg bag, not four
separate lines.

## Run it

Needs Node 20 or newer (`node --version` to check). Run each line on its own:

```
npm install
npm run dev
```

Then open **http://localhost:5173**.

> **Windows PowerShell:** don't chain these with `&&`. Windows PowerShell 5.1 — the blue one that
> ships with Windows — treats `&&` as a syntax error and runs nothing, so the dev server never
> starts and the browser shows `ERR_CONNECTION_REFUSED`. One command per line works everywhere;
> `;` chains them in any PowerShell, and `&&` works in PowerShell 7+ and in cmd, bash and zsh.

Other scripts: `npm test` (145 unit tests), `npm run typecheck`, `npm run build`, `npm run preview`.

### On a phone

Every push to `main` or `claude/first-version-built-xzviqu` publishes the built app to GitHub Pages,
so the planner can be opened on a phone without checking anything out. Turn it on once in the repo's
**Settings → Pages → Source → GitHub Actions**; the URL then appears on the *Deploy to Pages* run.

The hosted copy is the meal planner only. Adding to a real basket needs the local server that holds
your session, and a session that never leaves your machine cannot follow the app onto the web — so
the app detects a static build and says so, rather than offering a button that cannot work.

### If the page will not load

| What you see | Cause | Fix |
| --- | --- | --- |
| `ERR_CONNECTION_REFUSED` | The dev server is not running | Check the terminal still shows `VITE ready` — it stays running until you press Ctrl+C |
| `The token '&&' is not a valid statement separator` | Windows PowerShell 5.1 | Run the commands on separate lines |
| `Port 5173 is in use` | Something else has the port | Vite prints the port it picked instead — use that one |
| `Unsupported engine` on install | Node is older than 20 | Install a current Node from nodejs.org |

## How it works

The pipeline is four pure functions, each testable on its own:

| Step | Module | What it does |
| --- | --- | --- |
| 1. Normalise | `src/domain/units.ts` | Converts kg/g, l/ml, tbsp/tsp and counts into one unit per ingredient, and refuses nonsense (500g of onions) |
| 2. Consolidate | `src/domain/consolidate.ts` | Scales each meal to the servings you are cooking, then sums per ingredient across the week, remembering which recipes asked |
| 3. Match | `src/domain/match.ts` | Picks the product that covers each requirement most cheaply in whole packs, keeps the runners-up as alternatives, skips cupboard staples |
| 4. Basket | `src/domain/basket.ts` | Tops the basket up to the plan (never doubles it), totals goods, offers and delivery |
| 5. Live (optional) | `src/domain/liveMatch.ts`, `server/` | Searches a real retailer, reads pack sizes out of product titles, and flags anything it cannot read rather than guessing |

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

## Connecting a real supermarket basket

The plan can be pushed into a real online basket, using a session cookie you copy from your own
signed-in browser tab. Two processes, because the browser cannot hold that cookie safely:

```
npm run server        # terminal 1 — holds the session, talks to the retailer
npm run dev           # terminal 2 — the app
```

`npm run server:mock` runs the same flow against a built-in mock shop, with no real account
involved — worth doing first.

Setup, the security rules that come with handling a session cookie, and what to do when it
expires: **[docs/live-basket.md](docs/live-basket.md)**. The short version:

- The cookie is a credential worth as much as your password. It stays in your home directory, is
  read only by the local server, and never reaches the page, a log, or this repo.
- No retailer's endpoints are hard-coded here. `npm run refresh -- search chicken` learns them from
  a request you copy out of DevTools ("Copy as cURL"), replaying it once to read the response shape.
  Retailer tokens expire in minutes, so capture and learn happen in one step.
- Automating a retailer account is very likely against their terms of use. Requests go one at a
  time with a gap; nothing is ever checked out or paid for.
- The app always **reads the basket back** after adding, and shows the retailer's own total
  separately from our estimate — theirs includes delivery and offers, and is the one that counts.

## What is not built

- **Checkout.** Nothing pays for anything, by design.
- Retailer endpoints for any specific shop — that is config you supply (see above).
- Accounts, saved plans across devices, or live prices in the planning catalogue — the 51 product
  lines used for planning are static sample data.
- Nutrition, leftovers, or carrying an ingredient over to next week.

## Layout

```
src/
  domain/         the pipeline above, plus __tests__/ alongside it
  data/           ingredients, products, recipes, delivery slots
  ui/             React components and the stylesheet
  App.tsx         wires state to the pipeline
```
