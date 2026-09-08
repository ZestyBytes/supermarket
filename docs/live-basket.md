# Connecting a real supermarket basket

The app can push a week's shopping into a real online basket using a session cookie you copy from
your own signed-in browser tab. This document covers how that works, how to set it up, and what to
know before you do.

## Read this first

The cookie is a credential. Anyone holding it is signed in as you: order history, saved addresses,
saved cards, the lot. So:

- **It never leaves your machine.** It is written to `~/.supermarket/tesco-session.json`
  (`C:\Users\<you>\.supermarket\tesco-session.json` on Windows) and read only by the local server
  this repo starts. The browser page never receives it, and it is stripped out of error messages
  and logs before they are printed.
- **Never commit it, never paste it into a hosted app, never put it in an environment variable in
  CI.** `retailer.config.json` is gitignored and holds endpoints only — never the cookie.
- **It expires.** Signing out in the browser, or the retailer rotating your session, kills it. The
  app reports that as "Signed out" rather than as an empty catalogue, because those look identical
  from the outside and only one of them is a bug.
- **Automated access is very likely against the retailer's terms of use.** This drives your own
  account, on your own machine, at a human pace, and never checks out or pays — but the retailer
  may still rate-limit, challenge or block the session. That is your call to make, and worth
  knowing before you rely on it for the weekly shop.

## Setup

### 1. Import the session

Three ways, whichever suits:

```
npm run tesco:import                                    paste at a hidden prompt
npm run tesco:import -- "C:\Users\you\.tesco\session.json"    read a file another tool wrote
Get-Clipboard | npm run tesco:import                    pipe it straight from the clipboard
```

Note the plain path in the second one rather than a `--flag`. **npm parses unknown `--flags` as its
own config and they never reach the script**, even after `--`; anything in this project that takes
flags is run with `node` directly for that reason.

You should see **"Session imported locally."** and a cookie count. If an older tool's session file
exists, the prompt offers to read it rather than asking you to paste again.

### 2. Teach it the retailer's endpoints

No retailer's internal API is hard-coded in this repo — guessing endpoints produces a client that
fails in ways that look like bugs somewhere else. Instead, hand it the requests the retailer's own
site makes, and it works the rest out.

In your signed-in tab, open DevTools → Network, then:

1. **Search for something** (say `chicken`). Find the request that returns the products — the one
   whose response contains the product titles. Right-click → **Copy** → **Copy as cURL**. Paste it
   into a file, `search.txt`, in the project folder.

   Easiest way, which checks what it caught:

   ```
   npm run capture -- search.txt
   ```

   Start that **first**, then copy the request, then press Enter. Copying anything in between —
   including a command out of these instructions — replaces the clipboard, and that is what would
   get saved. The tool refuses anything that is not a cURL command and tells you what it found
   instead.
2. **Open your basket.** Capture the request that returns its contents the same way:
   `npm run capture -- basket.txt`
3. **Add one cheap item to your basket by hand.** Capture that request into `add.txt`, and note the
   product id and quantity it sent.

Then:

```
node scripts/learn-endpoint.mjs --kind search      --term chicken --file search.txt
node scripts/learn-endpoint.mjs --kind basket-read                --file basket.txt
node scripts/learn-endpoint.mjs --kind basket-add  --product-id 254656732 --qty 1 --file add.txt
```

(`node`, not `npm run` — see the note above about npm eating flags.)

Each command strips the cookie out (it is never written to config), templates out the bits that
vary, and — for search and basket-read — replays the request once with your imported session so it
can see where the products, prices and total actually sit in the response. It prints what it found
and writes `retailer.config.json`.

`--kind basket-add` is never replayed: configuring the app should not put anything in your basket.

Add `--dry-run` to any of them to print the config without writing it.

Delete `search.txt`, `basket.txt` and `add.txt` when you are done: **they contain your cookie.**
Those names are gitignored, so an accidental `git add .` will not commit them, but they are still
plain-text credentials sitting in the project folder.

### 3. Run both halves

Two terminals, because both keep running:

```
npm run server        # terminal 1 — holds the session, talks to the retailer
npm run dev           # terminal 2 — the app, on http://localhost:5173
```

To try the whole flow without touching a real account, run the server against the built-in mock
shop instead: `npm run server:mock`.

## Using it

On **This week**, the *Your real basket* panel does three things, in order:

1. **Find live products** — searches the retailer once per ingredient, one request at a time.
2. **Review** — each result's pack size is read out of its title (`… 650G`, `4 x 400G`, `3 Pack`).
   The cheapest whole-pack cover wins. Anything whose size cannot be read, or that is sold by a
   different measure than the recipe asks for, is listed for you to handle rather than guessed at.
3. **Add to basket** — adds each line, then **reads the basket back** and shows what the retailer
   says it now holds. What was sent is not evidence; what comes back is.

Two totals appear, deliberately kept apart:

- **Our estimate** — the listed prices of what we chose.
- **The retailer's total** — theirs, and authoritative. It will differ: it includes delivery,
  offers, substitutions and anything already in your basket before we started.

Re-sending an unchanged list asks for confirmation first, so a repeated click cannot quietly buy
the week twice.

## Why a local server at all

The page cannot call the retailer itself. The cookie is scoped to the retailer's domain, the
browser's cross-origin rules block the request, and a page holding a session cookie in JavaScript
is a session one bad script away from being stolen. Keeping it in a local process means the only
thing crossing the wire is a request from your own machine to the retailer, exactly as your browser
would make it.

## When it stops working

| What you see | What it means |
| --- | --- |
| **Signed out** | The retailer rejected the session. Sign in again in the browser and re-run `npm run tesco:import`. |
| **No session** | Nothing imported yet on this machine. |
| **Local server not running** | Start `npm run server` in its own terminal. |
| **Retailer not configured** | `retailer.config.json` is missing or incomplete. |
| **Too fast** | Rate limited. The server already serialises and spaces requests, and retries once. |
| Many "nothing came back from search" | Either the search endpoint config is wrong, or the session is dead — check the panel's session line first. |
