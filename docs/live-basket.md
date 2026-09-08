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

### 1. Describe the retailer's endpoints

No retailer's internal API is hard-coded in this repo. Guessing endpoints produces a client that
fails in ways that look like bugs somewhere else, so the endpoints live in config you fill in from
what you can see in DevTools on the retailer's own site:

```
cp retailer.config.example.json retailer.config.json
```

Open the retailer in your browser, sign in, then in DevTools → Network watch a search and a basket
read. Copy the request paths and the shape of the responses into `retailer.config.json`. The
`results` and `fields` values are dotted paths into the JSON: `data.results[]` reaches a list,
`price.actual` a value inside each entry.

### 2. Import the session

```
npm run tesco:import
```

Paste the `Cookie` header from any request to the retailer (DevTools → Network → a request →
Request Headers → Cookie). Nothing is echoed as you paste. You should see **"Session imported
locally."** and a cookie count.

If another tool already stored a session, import from that file instead:

```
npm run tesco:import -- --from-file "C:\Users\you\.tesco\session.json"
```

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
