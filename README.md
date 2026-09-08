# supermarket

**Ridgeway Market** — a first version of an online grocery storefront. Browse
eight aisles, fill a basket priced the way a shelf edge is (price, was-price,
unit price), pick a delivery slot, place the order.

No build step, no dependencies: open `index.html` in a browser, or serve the
folder with `python3 -m http.server`.

## What's here

| Path | Purpose |
| --- | --- |
| `index.html` | Page shell: masthead, aisle rail, shelves, basket pane |
| `assets/styles.css` | Design tokens and layout; light and dark themes |
| `assets/products.js` | Catalogue — 32 lines across 8 aisles, plus delivery slots |
| `assets/app.js` | Search, aisle filter, basket, totals, checkout |
| `scripts/build-artifact.sh` | Inlines the site into `dist/artifact.html` for publishing |

## Behaviour

- **Search** filters by product name, pack size or aisle; **aisle rail** filters by aisle.
- **Basket** persists in `localStorage`; a sample basket is seeded on a first visit
  so the totals are visible straight away.
- **Totals** show goods, offer savings, delivery fee and the amount to pay.
  Delivery is free over £40 — a progress bar tracks the gap.
- **Slots** carry their own fee and remaining capacity; placing an order prints a receipt.

## Not built yet

Accounts and sign-in, real stock levels, payment, a server of any kind, and
multibuy offers (only simple was/now pricing is modelled).
