# Supermarket, as a Chrome extension

The same app, with nothing to run alongside it. No local server, no session
file, no supervisor, no port.

## Why it can exist at all

A web page may not call `xapi.tesco.com`: Tesco does not invite other origins
to, and the browser enforces that. The local server exists to get around it. An
extension is allowed to, so it does not need one.

## Why it is better than the server version, beyond one less thing running

There is no credential to look after. The browser sends its own Tesco cookies,
exactly as when you click around the site, and the app never sees them. The
session file and its locked-down permissions, the nonce handshake, the hourly
re-minting: none of it has anything left to do.

Two headers still have to be borrowed, being ones a Tesco page adds that
cookies do not carry. They are read from a request Tesco's own page made and
kept in memory for as long as the browser is open. Nothing is written to disk.

## What it costs

Chrome on a computer. There is no iPhone version of a Chrome extension, so the
phone needs the server version, which is still there and still works.

## Installing it

```
npm run build:extension
```

Then in Chrome: **Extensions → Manage extensions → Developer mode → Load
unpacked**, and choose the `browser-extension` folder. Click the toolbar icon
and the app opens in its own tab, which you can pin or bookmark like any page.

Sign in to Tesco in another tab first. The app borrows the headers from a
request that page makes, so it needs to have seen one: if it says you are not
signed in, load your Tesco basket once and check again.

## Rebuilding after a change

`npm run build:extension` again, then hit reload on the extension card. The
app is rebuilt in place; the extension itself only changes when the files
beside this one do.
