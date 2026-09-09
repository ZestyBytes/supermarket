# Supermarket

UK meal planning that ends in one grocery basket.

**Choose meals → work out the ingredients → consolidate the quantities → match them to real
products → add the lot to the basket.**

Plan Spaghetti Bolognese, Chicken Fajitas, Cottage Pie, Chicken Curry and Salmon & Potatoes and
the app works out that four of those want onions, 6 in total, and buys one 1kg bag, not four
separate lines.

## Run it

Needs Node 20 or newer (`node --version` to check). Run each line on its own:

```
npm install
npm run connect
npm start
```

Connect uses the local Chrome helper in your usual Chrome profile. Follow [the one-time setup](docs/live-basket.md); no DevTools or cookie copying is required. Then open **http://127.0.0.1:5173**. `npm start` runs both the API and UI.

> **Windows PowerShell:** don't chain these with `&&`. Windows PowerShell 5.1, the blue one that
> ships with Windows, treats `&&` as a syntax error and runs nothing, so the dev server never
> starts and the browser shows `ERR_CONNECTION_REFUSED`. One command per line works everywhere;
> `;` chains them in any PowerShell, and `&&` works in PowerShell 7+ and in cmd, bash and zsh.

Other scripts: `npm test`, `npm run typecheck`, `npm run build`. `npm run dev` runs only the UI;
`npm start` is the normal local entry point.

### On a phone

At home, one command:

```
npm run start:host
```

It prints two addresses: the computer's network address, and its name (`http://your-pc.local:5173`),
which keeps working when the router hands out a different address. Open either on the phone, then
**Share → Add to Home Screen**: it installs as an app with its own icon, so there is no address or
port to type again.

Everything works there, including the real Tesco basket, because the phone is talking to your own
computer. Only the page is offered to the network. The API stays on loopback and refuses anything
that is not local, with the dev server proxy on the same machine as the only way to it.

There is also a hosted copy on GitHub Pages, published from `main`:
**https://zestybytes.github.io/supermarket/**, useful for looking at the planner away from home, but
it cannot touch your Tesco basket, because your session never leaves your computer. It says so
rather than offering a button that cannot work.

### A shortcut on the desktop

```
powershell -ExecutionPolicy Bypass -File scripts\add-desktop-shortcut.ps1
```

Puts **Supermarket** on the desktop. Double-click it and both halves start and the browser opens; it
also clears a server left running from last time, which is otherwise the usual reason it will not
start.

### Leaving it running

```
powershell -ExecutionPolicy Bypass -File scripts\install-service.ps1
```

Supermarket now starts when you log in and looks after itself. It puts the app back if it stops or
stops answering, and every ten minutes it asks GitHub whether there is a newer version: if there is,
it pulls, installs when the dependencies have changed, and restarts on the same ports, so an icon
saved to a phone's home screen keeps working. If anything in the folder has been edited it says so
and keeps running what you have rather than pulling over the top of it. Repeated failures back off
rather than hammering.

`Start-ScheduledTask -TaskName Supermarket` runs it now, `Stop-ScheduledTask` stops it, and
`-Remove` on the same script takes it off. To watch it work instead, double-click
**keep-supermarket-running.cmd** and leave the window open.

It deliberately leaves the Tesco connection alone, because the extension already handles that: open
the Supermarket extension in Chrome and tick **Stay connected**, and it mints a fresh token every
half hour without opening a window. That part needs Chrome running and your Tesco sign-in still
valid; if Tesco signs you out completely, no amount of automation can sign you back in.

### If the page will not load

| What you see | Cause | Fix |
| --- | --- | --- |
| `ERR_CONNECTION_REFUSED` | The dev server is not running | Check the terminal still shows `VITE ready`. It stays running until you press Ctrl+C |
| `The token '&&' is not a valid statement separator` | Windows PowerShell 5.1 | Run the commands on separate lines |
| `Port 5173 is in use` | Another app instance has the port | Stop the previous instance before running npm start |
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

The plan uses Open Supermarkets to reach Tesco. Connect through a dedicated Chrome profile:

```
npm run connect
npm start
```

`npm run server:mock` runs the same flow against a built-in mock shop, with no real account
involved, so it is worth doing first.

Setup, the security rules that come with handling a session cookie, and what to do when it
expires: **[docs/live-basket.md](docs/live-basket.md)**. The short version:

- The cookie is a credential worth as much as your password. It stays in your home directory, is
  read only by the local server, and never reaches the page, a log, or this repo.
- Open Supermarkets owns retailer operations. Captured cURLs and retailer.config.json are no longer replayed. `npm run refresh -- basket` now opens the connection helper for compatibility.
- Reads can refresh a rejected session through the saved Chrome profile. If interaction is required, run npm run connect. A future token expiry does not prove the session works.
- Basket attempts are journalled and writes are not retried automatically. No checkout or payment is performed.
- The app always **reads the basket back** after adding, and shows the retailer's own total
  separately from our estimate: theirs includes delivery and offers, and is the one that counts.

## What is not built

- **Checkout.** Nothing pays for anything, by design.
- Other live retailers; Tesco is first.
- Accounts, saved plans across devices, or live prices in the planning catalogue. The 51 product
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
