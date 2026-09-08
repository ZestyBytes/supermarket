# Open Supermarkets repair

The application now uses open-supermarkets@3.0.0 through one server-side adapter. CLI, HTTP and library options were inspected. The current Node server consumes the provider and batch helper directly so one instance handles a batch with bounded concurrency. These are internal package paths and are deliberately isolated and version-pinned.

A minimal patch-package patch adds optional session-header injection to the Tesco provider. Upstream's default session loader accepts cookies only; this browser flow also carries bearer authorization and request context. The patch adds no queries, endpoints, parsers, checkout or retailer reverse engineering. Review it on upgrades. npm install applies it automatically. Do not import provider internals elsewhere in the app.

The previous endpoint-learning setup is no longer used. Inspection found recommendations configured as search and a batch containing UpdateBasket configured as basket-read. None of those captured request bodies were replayed during repair. retailer.config.json and local captures are left untouched but ignored by the runtime.

Authentication is now npm run connect. It opens a dedicated Chrome profile at ~/.supermarket/tesco-browser. The user signs in directly at Tesco. The helper observes authentication headers on Tesco's own requests, obtains browser cookies and verifies the session with an Open Supermarkets basket read before saving. It never captures/replays request bodies or makes basket changes. No password is read by the helper. Existing imports are used to seed a new profile when possible. The saved profile allows reconnecting without another login when Tesco accepts it.

Reads that receive an authentication rejection attempt one silent refresh through that browser profile. If Tesco requires interaction or blocks the browser, the app asks for npm run connect. A JWT expiry in the future does not prove a session is usable. Writes are never retried after errors. A stale connection lock after a killed process requires inspecting/closing the connection process before removing ~/.supermarket/tesco-connect.lock.

Basket additions read current quantities, add the selected counts, invoke upstream absolute-quantity operations sequentially, and read back exact quantities. Durable attempt journals under ~/.supermarket/attempts prevent the same request from being repeated after uncertain outcomes. A filesystem lock serialises writes across processes; inspect Tesco before clearing a stale write.lock. No checkout or payment operation is exposed.

Batch searches use the upstream batch helper at bounded concurrency rather than one browser request per ingredient. Failed searches remain distinguishable from empty results. Session information and raw upstream error messages never reach the frontend or logs. Same-origin checks, request size limits and schema validation protect the local API. The UI and API bind to loopback only.

## Verification status

The historical 320g chicken proof passed in the earlier checkout. During this repair, the saved Claude session was rejected by Tesco and silent refresh did not establish a usable session. No real basket mutation has been made during this repair. Unit/contract tests and the build are separate from live proof; interactive connection is the next required step.

## Browser access block observed

Tesco returned Access Denied before sign-in in the managed connection browser. A second attempt using installed Chrome with its normal sandbox (no --no-sandbox flag) was also blocked. The helper now identifies Access Denied and exits rather than waiting for a login that cannot happen. This is not evidence of bad credentials. No basket write was made. The next diagnostic is whether Tesco works in the user's ordinary Chrome profile; do not keep launching more blocked login windows.

The dedicated profile used by the revised launcher is ~/.supermarket/tesco-browser-native. Chrome debugging is limited to loopback and that dedicated profile; the user's normal profile is never attached to or modified.

## Current connection method (supersedes managed browser instructions above)
The user confirmed Tesco works in ordinary Chrome. Managed Chrome remains blocked, so npm run connect now starts a temporary loopback receiver on 127.0.0.1:8788. Load browser-extension once in normal Chrome (see live-basket.md). Explicitly clicking Connect arms header observation for five minutes. Only Tesco API authentication/context headers and API-applicable cookies are transferred; no request bodies, passwords or unrelated browsing data are collected. Secrets are not persisted in extension storage. The receiver accepts only the fixed extension origin, issues a random nonce, limits body size, validates data, and saves only after an Open Supermarkets basket read succeeds. The manifest key is a public key for a stable extension ID, not a secret. Local processes remain inside the trust boundary.

Browser helper uses Chrome's documented webRequest API: https://developer.chrome.com/docs/extensions/reference/api/webRequest. Retailer operations still remain entirely in Open Supermarkets. This is a local personal MVP, not a published extension. Disable/remove the extension whenever desired. Old browser profiles remain untouched, but are no longer launched automatically. Token refresh requires another explicit connection. 149 tests and the build pass; live access with this new method is still awaiting user installation and verification.

## Live proof completed — 8 September 2026
Normal-Chrome extension connection succeeded. Open Supermarkets returned five actual chicken breast products/prices. A journalled submission added exactly one Tesco Chicken Breast Fillets 320g (320661079), price £2.44, from quantity 0 to 1. Basket read-back verified quantity 1 and preserved the pre-existing beef joint. The running UI's /api/basket also returned that same live basket. No checkout/payment occurred. This supersedes the pending verification notes above. Sessions can still expire; reconnect with the installed helper when needed.

## Matching repair — 8 September 2026
Failed batch searches now remain distinct from empty results and receive up to two read-only retries. Successful search results are cached for two minutes; upstream network requests have a 15-second timeout. No basket writes are retried. The provider compatibility patch now also sets these timeouts.

The meal plan shows ingredient requirements without the sample basket or sample delivery slots. Real products are selected only in the Tesco panel, with replacement dropdowns. Missing matches block submission, and changing meals/servings/cupboard exclusions invalidates old matches. Search terms and deterministic relevance rules distinguish dry rice, frozen peas, raw meat and fresh ginger. Explicit Each products support count-based recipes without invented weight conversions. 154 tests and production build pass. Live whole-plan browser verification is performed separately.

### Whole-plan browser verification passed
The actual localhost UI matched all 26 default-plan ingredients with zero unresolved lines, approximately £63.92 at observed Tesco prices. Verified fresh 100g ginger, peppers sold Each, dry 1kg basmati, frozen peas and raw chicken. Changing rice to a £5 alternative changed the estimate to £67.13; restoring the £1.79 pack restored £63.92. The complete-plan Add button was enabled. No whole-plan basket submission was made during this test. Pricing/stock are time-dependent, and matching remains deterministic rather than exhaustive.
