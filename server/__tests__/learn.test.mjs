import { describe, expect, it } from "vitest";
import {
  classifyClipboard,
  inferFields,
  inferList,
  inferTotal,
  looksLikeSearch,
  operationsIn,
  parseCurl,
  pickRequest,
  splitCurls,
  templatize,
  tokenLife,
} from "../learn.mjs";

const BASH_CURL = `curl 'https://www.shop.example/api/search?query=chicken&count=20' \\
  -H 'accept: application/json' \\
  -H 'cookie: sessionId=secret-value; _csrf=abc' \\
  -H 'user-agent: Mozilla/5.0' \\
  --compressed`;

const CMD_CURL = `curl "https://www.shop.example/api/basket/items" ^
  -H "content-type: application/json" ^
  -H "Cookie: sessionId=secret-value" ^
  --data-raw "{\\"productId\\":\\"12345\\",\\"quantity\\":2}"`;

/** Exactly the shape Chrome on Windows produces: carets before every special character. */
const WINDOWS_CURL = `curl --url ^"https://xapi.tesco.com/^" ^
  -H ^"content-type: application/json^" ^
  -H ^"x-apikey: PUBLICWEBKEY^" ^
  -H ^"Cookie: sessionId=secret-value^" ^
  --data-raw ^"^[^{^\\^"operationName^\\^":^\\^"Search^\\^",^\\^"variables^\\^":^{^\\^"query^\\^":^\\^"chicken^\\^"^}^}^]^"`;

describe("parseCurl", () => {
  it("reads the caret-escaped flavour Chrome produces on Windows", () => {
    const request = parseCurl(WINDOWS_CURL);
    expect(request.url).toBe("https://xapi.tesco.com/");
    expect(request.method).toBe("POST");
    expect(request.headers["x-apikey"]).toBe("PUBLICWEBKEY");
    expect(JSON.parse(request.body)).toEqual([
      { operationName: "Search", variables: { query: "chicken" } },
    ]);
  });

  it("keeps the cookie out of a Windows capture too", () => {
    const request = parseCurl(WINDOWS_CURL);
    expect(JSON.stringify(request)).not.toContain("secret-value");
    expect(request.droppedHeaders).toContain("cookie");
  });

  it("templates the search term inside a GraphQL body", () => {
    const spec = templatize(parseCurl(WINDOWS_CURL), { query: "chicken" });
    expect(spec.origin).toBe("https://xapi.tesco.com");
    expect(spec.path).toBe("/");
    // The tokenizer hands back the unescaped body, so the placeholder sits in
    // plain JSON ready to be filled per request.
    expect(spec.body).toBe('[{"operationName":"Search","variables":{"query":"{query}"}}]');
  });


  it("reads the bash flavour DevTools produces", () => {
    const request = parseCurl(BASH_CURL);
    expect(request.method).toBe("GET");
    expect(request.url).toBe("https://www.shop.example/api/search?query=chicken&count=20");
    expect(request.headers.accept).toBe("application/json");
  });

  it("reads the Windows cmd flavour, quotes and carets included", () => {
    const request = parseCurl(CMD_CURL);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("https://www.shop.example/api/basket/items");
    expect(JSON.parse(request.body)).toEqual({ productId: "12345", quantity: 2 });
  });

  it("never keeps the cookie, and says that it dropped it", () => {
    const request = parseCurl(BASH_CURL);
    expect(request.headers.cookie).toBeUndefined();
    expect(JSON.stringify(request)).not.toContain("secret-value");
    expect(request.droppedHeaders).toContain("cookie");
  });

  it("drops an Authorization header too", () => {
    const request = parseCurl(`curl 'https://x.example/' -H 'Authorization: Bearer abc123'`);
    expect(JSON.stringify(request)).not.toContain("abc123");
    expect(request.droppedHeaders).toContain("authorization");
  });

  it("refuses anything that is not a cURL command", () => {
    expect(() => parseCurl("GET /api/search")).toThrow(/copy the request as cURL/);
  });
});

describe("templatize", () => {
  it("replaces the search term with a placeholder", () => {
    const spec = templatize(parseCurl(BASH_CURL), { query: "chicken", limit: "20" });
    expect(spec.path).toBe("/api/search?query={query}&count={limit}");
    expect(spec.origin).toBe("https://www.shop.example");
  });

  it("replaces product and quantity in a body", () => {
    const spec = templatize(parseCurl(CMD_CURL), { productId: "12345", qty: "2" });
    expect(spec.body).toBe('{"productId":"{productId}","quantity":{qty}}');
  });

  it("leaves the request alone when nothing matches", () => {
    const spec = templatize(parseCurl(BASH_CURL), { query: "beef" });
    expect(spec.path).toContain("query=chicken");
  });
});

const SEARCH_RESPONSE = {
  data: {
    facets: [{ name: "Brand" }, { name: "Dietary" }],
    search: {
      results: {
        productItems: [
          { product: { id: "254656732", title: "Chicken Breast Fillets 320G", price: { actual: 2.44 } } },
          { product: { id: "254656733", title: "Chicken Breast Fillets 650G", price: { actual: 4.9 } } },
        ],
      },
    },
  },
};

describe("inferList", () => {
  it("finds the product list rather than the facets", () => {
    expect(inferList(SEARCH_RESPONSE)).toBe("data.search.results.productItems[]");
  });

  it("returns null when there is nothing record-shaped", () => {
    expect(inferList({ ok: true, tags: ["a", "b"] })).toBeNull();
  });
});

describe("inferFields", () => {
  it("takes the pack price, not the price per kilo", () => {
    // A real Tesco product carries both. Picking unitPrice would cost every
    // basket wrong, and the shallower key is the wrong one here.
    const product = {
      id: "254656732",
      title: "Tesco British Chicken Breast Fillets 650G",
      unitPrice: 7.54,
      unitOfMeasure: "kg",
      price: { actual: 4.9 },
    };
    expect(inferFields(product).price).toBe("price.actual");
  });

  it("does not mistake the unit of measure for a pack size", () => {
    const product = { id: "1", title: "Chicken 650G", unitOfMeasure: "kg", price: { actual: 4.9 } };
    expect(inferFields(product).size).toBeUndefined();
  });

  it("reads a GraphQL-shaped product node", () => {
    const node = {
      __typename: "ProductDetailsType",
      tpnb: "254656732",
      title: "Tesco British Chicken Breast Fillets 650G",
      price: { __typename: "ProductPriceType", actual: 4.9, unitPrice: 7.54 },
    };
    expect(inferFields(node)).toMatchObject({ id: "tpnb", title: "title", price: "price.actual" });
  });

  it("maps id, title and price through nesting", () => {
    const sample = SEARCH_RESPONSE.data.search.results.productItems[0];
    expect(inferFields(sample)).toMatchObject({
      id: "product.id",
      title: "product.title",
      price: "product.price.actual",
    });
  });

  it("maps quantity for a basket rather than a size", () => {
    const item = { id: "1", title: "Milk", quantity: 2, price: { actual: 1.35 } };
    expect(inferFields(item, "basket")).toMatchObject({ id: "id", title: "title", qty: "quantity" });
  });
});

describe("inferTotal", () => {
  it("finds the basket total", () => {
    const basket = { data: { items: [{ id: "1" }], total: { value: 36.95 }, itemCount: 7 } };
    expect(inferTotal(basket)).toBe("data.total.value");
  });
});

describe("classifyClipboard", () => {
  it("accepts a copied request and says where it goes", () => {
    expect(classifyClipboard(BASH_CURL)).toMatchObject({ kind: "curl", method: "GET", host: "www.shop.example" });
  });

  it("spots a POST without an explicit -X", () => {
    expect(classifyClipboard(CMD_CURL)).toMatchObject({ kind: "curl", method: "POST" });
  });

  it("catches the command being copied instead of the request", () => {
    // The exact mistake this tool exists to prevent: copying the instruction
    // replaces whatever was copied from DevTools.
    const verdict = classifyClipboard("Get-Clipboard | Out-File -Encoding utf8 search.txt");
    expect(verdict.kind).toBe("command");
    expect(verdict.why).toMatch(/replaced what you copied/);
  });

  it("recognises a cookie header and does not save it as a request", () => {
    expect(classifyClipboard("sessionId=abc123; _csrf=xyz; consent=1").kind).toBe("cookie");
  });

  it("reports an empty clipboard", () => {
    expect(classifyClipboard("   ").kind).toBe("empty");
  });

  it("quotes back anything else it cannot place", () => {
    expect(classifyClipboard("hello there").why).toContain("hello there");
  });
});

describe("tokenLife", () => {
  function jwt(claims) {
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
    return `Bearer ${encode({ alg: "RS256" })}.${encode(claims)}.signature`;
  }

  it("reads how long a token has left without sending it anywhere", () => {
    const now = 1_788_867_702_000;
    const life = tokenLife(jwt({ iat: 1_788_867_702, exp: 1_788_871_302 }), now);
    expect(life.secondsLeft).toBe(3600);
    expect(life.lifetimeSeconds).toBe(3600);
    expect(life.expired).toBe(false);
  });

  it("spots one that is already dead", () => {
    // The failure that kept arriving as "Unauthorized" an hour after the fact.
    const life = tokenLife(jwt({ iat: 1_788_867_702, exp: 1_788_871_302 }), 1_788_875_000_000);
    expect(life.expired).toBe(true);
    expect(life.secondsLeft).toBeLessThan(0);
  });

  it("returns nothing for something that is not a JWT", () => {
    expect(tokenLife("Bearer opaque-token")).toBeNull();
    expect(tokenLife(undefined)).toBeNull();
  });
});

describe("operationsIn / looksLikeSearch", () => {
  it("names the operation a captured request carries", () => {
    expect(operationsIn('[{"operationName":"GetRecommendations","variables":{}}]')).toEqual(["GetRecommendations"]);
  });

  it("tells the product search apart from the rest of the page's traffic", () => {
    expect(looksLikeSearch(["Search"])).toBe(true);
    expect(looksLikeSearch(["GetRecommendations"])).toBe(false);
    expect(looksLikeSearch(["Suggestions"])).toBe(false);
  });

  it("finds every operation in a batched request", () => {
    const body = '[{"operationName":"Search"},{"operationName":"GetTaxonomy"}]';
    expect(operationsIn(body)).toEqual(["Search", "GetTaxonomy"]);
  });
});

describe("splitCurls / pickRequest", () => {
  const analytics = 'curl --url "https://xapi.tesco.com/" --data-raw "[{\\"operationName\\":\\"AnalyticsSellerIds\\"}]"';
  const recommendations = 'curl --url "https://xapi.tesco.com/" --data-raw "[{\\"operationName\\":\\"GetRecommendations\\"}]"';
  const search = 'curl --url "https://xapi.tesco.com/" --data-raw "[{\\"operationName\\":\\"Search\\",\\"variables\\":{\\"query\\":\\"chicken\\"}}]"';

  it("splits a copy-all paste into commands", () => {
    expect(splitCurls([analytics, recommendations, search].join("\n"))).toHaveLength(3);
  });

  it("finds the product search among the page's other traffic", () => {
    // The whole point: nobody should have to identify this row by eye.
    const picked = pickRequest([analytics, recommendations, search], "search");
    expect(picked.ok).toBe(true);
    expect(picked.operation).toBe("Search");
    expect(picked.command).toBe(search);
  });

  it("lists what it saw when the search is not among them", () => {
    const picked = pickRequest([analytics, recommendations], "search");
    expect(picked.ok).toBe(false);
    expect(picked.seen).toEqual(["AnalyticsSellerIds", "GetRecommendations"]);
  });

  it("honours an operation named explicitly", () => {
    const picked = pickRequest([analytics, search], "search", "AnalyticsSellerIds");
    expect(picked.command).toBe(analytics);
  });

  it("uses a lone request that carries no operation name at all", () => {
    const rest = 'curl --url "https://shop.example/api/basket"';
    expect(pickRequest([rest], "basket-read")).toMatchObject({ ok: true, operation: null });
  });
});

describe("pickRequest by the term you typed", () => {
  const analytics = 'curl --url "https://xapi.tesco.com/" --data-raw "[{\\"operationName\\":\\"AnalyticsSellerIds\\"}]"';
  const oddlyNamed = 'curl --url "https://xapi.tesco.com/" --data-raw "[{\\"operationName\\":\\"GHSSearchV2\\",\\"variables\\":{\\"query\\":\\"chicken\\"}}]"';

  it("finds the search by the word typed, whatever the operation is called", () => {
    // Operation names differ between retailers and change over time; the term
    // the shopper typed is in the request no matter what.
    const picked = pickRequest([analytics, oddlyNamed], "search", undefined, { term: "chicken" });
    expect(picked.ok).toBe(true);
    expect(picked.command).toBe(oddlyNamed);
    expect(picked.operation).toBe("GHSSearchV2");
  });

  it("says the search is absent rather than picking something else", () => {
    const picked = pickRequest([analytics], "search", undefined, { term: "chicken" });
    expect(picked.ok).toBe(false);
  });

  it("prefers a search-named operation when several carry the term", () => {
    const suggestions = 'curl --url "https://x/" --data-raw "[{\\"operationName\\":\\"Suggestions\\",\\"variables\\":{\\"query\\":\\"chicken\\"}}]"';
    const search = 'curl --url "https://x/" --data-raw "[{\\"operationName\\":\\"Search\\",\\"variables\\":{\\"query\\":\\"chicken\\"}}]"';
    expect(pickRequest([suggestions, search], "search", undefined, { term: "chicken" }).command).toBe(search);
  });
});
