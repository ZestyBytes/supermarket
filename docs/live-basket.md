# Connect a real Tesco basket

Run commands from C:/Users/Jamie Bassett/supermarket.

```powershell
npm install
npm run connect
npm start
```

One-time setup in your usual Chrome: open chrome://extensions, enable Developer mode, choose Load unpacked, and select C:/Users/Jamie Bassett/supermarket/browser-extension. Open Supermarket Tesco Connect from Chrome's extensions menu, click Connect, then refresh your Tesco basket. Sign in only on Tesco if needed. The command saves the session only after a real basket read succeeds and prints CONNECTED. No passwords or headers need copying. No basket change is made by connecting.

npm start launches both the UI at http://127.0.0.1:5173 and the local API. Use Find live products, review matches and add selected products. Open Tesco to check out yourself. The app never orders or pays.

The old npm run refresh -- basket command now opens the same connection helper. Stop using cURL capture and endpoint learning; retailer.config.json is not loaded anymore. There is no need to git pull between authentication steps.

Session data lives under ~/.supermarket, outside the repository. It is sensitive. Never share it, paste it into chat or commit it. When authentication expires, run npm run connect, click Connect in the installed extension, and refresh Tesco. Silent managed-browser refresh is disabled because Tesco blocked that browser.

After an uncertain basket update, read Tesco before doing anything else. Writes are not automatically repeated. The API records each attempt and verifies actual quantities rather than assuming success from the submitted list. Existing basket contents are preserved. Retailer totals can include charges and pre-existing items and can differ from estimates.

See open-supermarkets.md for integration/patch details and the current live verification status.

## Staying connected

Tesco's token lasts about an hour, so a session connected once is stale by the evening. Tick
**Stay connected** in the extension and it refreshes itself every half hour: it nudges a Tesco page
in the background, catches the token that page asks for, and closes up again. Nothing to click, and
the app is simply always ready.

It is off until you turn it on, and turning it off stops all of it. Every refresh is still verified
against Tesco before it replaces the stored session, and the helper still cannot add products or
check out.
