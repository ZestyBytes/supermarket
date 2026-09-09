# Mobile UI refinement

Meals, shopping list and settings share Heroicons, a compact header and floating frosted navigation. Settings links to Tesco for removals and checkout; no bulk basket deletion was introduced.

Only selected ingredients trigger searches. Previously a whole-catalogue scan competed with the meal plan. Matching now waits 180ms for rapid edits, shares in-flight requests and caches successful product results in memory for two minutes. Rechecking the connection clears that cache. Matching effects depend on the plan and successful connection version, so changing their own loading phase cannot restart them. Results and real ingredient progress appear after each group of four.

Basket writes remain server-side. The UI locks plan edits during submission and ignores double taps; completion uses the server's verified added/failed result rather than assuming existing quantities represent a successful addition. No new write concurrency is introduced. Loading is indeterminate while Tesco processes and verifies the basket. This work does not claim a measured improvement in Tesco's response time.

Validation uses unit/hook tests and an isolated mock server for mobile/desktop UI, selection, shopping-list and basket-flow checks. No real Tesco basket was changed. Demo mode is labelled in the header and settings.
