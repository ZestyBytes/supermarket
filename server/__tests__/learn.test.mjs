import { describe, expect, it } from "vitest";
import { classifyClipboard, inferFields, inferList, inferTotal, parseCurl, templatize } from "../learn.mjs";

const BASH_CURL = `curl 'https://www.shop.example/api/search?query=chicken&count=20' \\
  -H 'accept: application/json' \\
  -H 'cookie: sessionId=secret-value; _csrf=abc' \\
  -H 'user-agent: Mozilla/5.0' \\
  --compressed`;

const CMD_CURL = `curl "https://www.shop.example/api/basket/items" ^
  -H "content-type: application/json" ^
  -H "Cookie: sessionId=secret-value" ^
  --data-raw "{\\"productId\\":\\"12345\\",\\"quantity\\":2}"`;

describe("parseCurl", () => {
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
