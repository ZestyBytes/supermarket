/**
 * Watch Tesco's own page make its own requests, from inside the page.
 *
 * The extension already listens with webRequest, and on paper that is the
 * right tool. In practice a Manifest V3 background worker is stopped when idle
 * and webRequest events fire into nothing while it is asleep, which is how an
 * app came to tell someone with their Tesco basket open that they were not
 * signed in: not one request had ever been seen.
 *
 * This runs in the page's own world, where fetch and XMLHttpRequest belong to
 * the page, and notes the headers Tesco puts on its own calls. It reads; it
 * never changes a request, and it never touches anything that is not Tesco's
 * own API.
 */
(() => {
  // Any Tesco host, not just xapi. Watching one host assumed I knew which one
  // carries the token, and "none seen yet" on a page plainly talking to Tesco
  // is what that assumption looks like from outside.
  const MINE = /^https:\/\/[a-z0-9.-]*tesco\.com/i;
  const WANTED = ['authorization', 'x-apikey', 'customer-uuid'];

  function offer(url, headers) {
    const found = {};
    for (const [name, value] of Object.entries(headers)) {
      const key = String(name).toLowerCase();
      if (WANTED.includes(key) && typeof value === 'string') found[key] = value;
    }
    // Report the host either way. Knowing Tesco's page called somewhere and
    // put nothing we recognise on it is the answer to a different question
    // than never having seen it call anything.
    let host = '';
    try { host = new URL(String(url), location.href).host; } catch { host = 'unreadable'; }
    window.postMessage({ source: 'supermarket-tesco', host, headers: found }, '*');
  }

  // Say we are here, before anything else. "None seen yet" could not tell
  // "the watcher never ran" from "it ran and saw nothing", and those want
  // opposite fixes: one is the extension's problem, the other is Tesco's page.
  // Not immediately: this runs at document_start alongside the relay that
  // carries its messages, and whichever attaches second loses everything sent
  // before it. Announcing once into that gap is the same as not announcing.
  const announce = () => window.postMessage({ source: 'supermarket-tesco', alive: location.host }, '*');
  setTimeout(announce, 0);
  setTimeout(announce, 1500);

  /**
   * Look for the token where Tesco's own app keeps it.
   *
   * Intercepting a request only works if the page makes one while we are
   * watching, and a site whose calls come from its own service worker never
   * makes one where we can see it. What it does do is keep the token
   * somewhere its scripts can reach, and so can we, standing in the same
   * world they do.
   */
  function fromStorage() {
    const looksLikeToken = /^(Bearer\s+)?ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./;
    for (const store of [window.localStorage, window.sessionStorage]) {
      let keys = [];
      try { keys = Object.keys(store); } catch { continue; }
      for (const key of keys) {
        let raw = '';
        try { raw = store.getItem(key) || ''; } catch { continue; }
        const candidates = [raw];
        // Tokens are as often inside a JSON blob as stored on their own.
        if (raw.startsWith('{')) {
          try {
            const parsed = JSON.parse(raw);
            for (const value of Object.values(parsed)) if (typeof value === 'string') candidates.push(value);
          } catch { /* not JSON after all */ }
        }
        for (const candidate of candidates) {
          if (looksLikeToken.test(candidate.trim())) {
            const token = candidate.trim();
            return token.startsWith('Bearer') ? token : `Bearer ${token}`;
          }
        }
      }
    }
    return undefined;
  }

  function offerStored() {
    const authorization = fromStorage();
    if (authorization) window.postMessage({ source: 'supermarket-tesco', host: location.host, headers: { authorization }, from: 'the page store' }, '*');
    else window.postMessage({ source: 'supermarket-tesco', searched: 'no token in the page store' }, '*');
  }

  // Repeatedly, because the token is written by the page's own scripts and
  // this runs before any of them. One look at document_start finds an empty
  // store every time and reports it as though it were the answer.
  for (const after of [0, 1500, 4000, 9000, 20000]) setTimeout(offerStored, after);

  const realFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      const url = typeof input === 'string' ? input : input?.url;
      if (MINE.test(String(url))) {
        const headers = {};
        // Headers can arrive as a Headers object, an array or a plain object.
        const given = init?.headers ?? (input instanceof Request ? input.headers : undefined);
        if (given instanceof Headers) given.forEach((v, k) => { headers[k] = v; });
        else if (Array.isArray(given)) for (const [k, v] of given) headers[k] = v;
        else if (given) Object.assign(headers, given);
        offer(url, headers);
      }
    } catch {
      // Watching must never be able to break the page it is watching.
    }
    return realFetch.apply(this, arguments);
  };

  const open = XMLHttpRequest.prototype.open;
  const setHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__supermarketTesco = MINE.test(String(url));
    this.__supermarketUrl = url;
    this.__supermarketHeaders = {};
    return open.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    try {
      if (this.__supermarketTesco) {
        this.__supermarketHeaders[String(name).toLowerCase()] = value;
        offer(this.__supermarketUrl, this.__supermarketHeaders);
      }
    } catch {
      // As above.
    }
    return setHeader.apply(this, arguments);
  };
})();
