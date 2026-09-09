# Supermarket — repair context

- This checkout is the user's active app: C:/Users/Jamie Bassett/supermarket. The older Next.js attempt lives under Dev/supermarket; do not confuse them.
- Current branch: codex/tesco-integration-repair. Preserve the existing meal-planning UI while repairing retailer access.
- Live retailer boundary is server/adapters/open-supermarkets.mjs using pinned Open Supermarkets 3.0.0. Do not replay captured cURLs or retailer.config.json. That old configuration contained an UpdateBasket mutation under basket-read.
- patches/open-supermarkets+3.0.0.patch adds browser-session header injection only. Retailer queries/mutations stay upstream. npm install applies it using patch-package.
- npm start runs UI + API. npm run connect opens a dedicated persistent Chrome profile for user login. No DevTools or endpoint learning is required. Authentication and browser profiles stay under ~/.supermarket, never in the repo or frontend.
- Read operations may refresh expired auth once through the saved browser. Never retry a basket write. server/basket.mjs journals attempts and verifies exact read-back quantities, preserving unrelated items.
- No checkout, payments, other retailers or UI rewrite. Original Next.js/Tailwind preference remains a future migration decision; repairing the currently used app is the present task.
- Run npm test and npm run build. Tests use fixtures. A successful build is not proof of live Tesco access.
- Current live status: old captured session rejected by Tesco despite future JWT expiry. Silent browser refresh failed. New interactive connection is required before real search/add/read-back can be re-proven. Never ask for credentials in chat.
- Latest blocker: Tesco Access Denied before login in both managed launches, including a normal sandboxed Chrome process. Do not keep telling the user to sign in on that page. Check whether their ordinary Chrome Tesco session works before choosing a normal-browser connection approach. 146 tests pass; live repair remains unverified.

- Current method supersedes dedicated-browser instructions above: npm run connect starts a temporary loopback receiver on port 8788. browser-extension is installed once in the user's usual Chrome (Tesco works there). User clicks Connect then refreshes Tesco. Sessions save only after live upstream basket validation. No automated browser refresh remains. See docs/live-basket.md. New helper has 149 passing tests with the existing suite; live proof still pending installation. Do not claim integration repaired until real search/add/readback succeeds.

- LIVE PROOF PASSED 2026-09-08: ordinary-Chrome extension connection, real chicken breast search, one 320g pack (320661079, £2.44) added via journalled submitBasket and read back qty1. Existing beef joint preserved. Running app /api/basket verified same contents. No checkout. This supersedes pending-live-proof notes above. Avoid repeating this basket mutation on resume.

- Matching/UX repair: ingredient-only shopping list on meal plan; sample basket/slots confined to Sample catalogue. LivePanel alternatives dropdowns, failed-search reporting, incomplete-plan submission block, match reset on plan changes. Batch read retries and two-minute cache; patch also adds 15s request timeouts. Tests:154. Avoid claiming availability from tests; validate live browser result.

- Latest browser result: all26 default-plan ingredients matched, zero unresolved, ~£63.92 live estimate. Product override tested total£67.13 then restored£63.92. No whole-plan basket write during matching repair.155 tests pass. App running via npm start; browser result kept for review.

## Fresh Market design — 9 September 2026
The user approved concept A. Implemented on codex/fresh-market-mobile: photo grid, compact people/dinner selectors, selected meal strip, search, accessible add/remove buttons, persistent ingredient CTA, SVG navigation, and green/white palette. PRODUCT.md and DESIGN.md record the approved brief. MealPhoto uses public/images/meals.png, generated illustrative photography. Tests180 pass, build pass, detector no findings. Browser verified mobile390 and desktop1280, serving scaling and cupboard exclusion. No Tesco basket writes during design work. This does not solve remote API hosting; do not claim it does.

## Desktop review — 9 September 2026
Active checkout has a supervisor which updates main automatically. Make edits in an isolated worktree, then push main; do not race its checkout/update process. Current UI auto-syncs selected meals into Tesco, so use the mock API for destructive browser testing. Mock attempts now live in ~/.supermarket/mock-attempts, separate from live write locks. This review adds ingredient-variety filtering/notes, honest disconnected shopping text, corrected singular quantities, and pauses automatic refill after explicit empty until the plan changes (page lifetime). Tests: 281, production build passes. Live app opened from desktop shortcut but Tesco session expired; reconnect through normal Chrome extension before live validation. No intentional live basket mutation during this review.
