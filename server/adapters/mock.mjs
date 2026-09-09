import { retailerError } from "./http.mjs";

/**
 * A stand-in retailer, used by the tests and by `npm run server -- --mock`.
 *
 * It behaves like the real thing in the ways that matter: search returns
 * several pack sizes with the size written into the title, the basket is
 * read back rather than assumed, and its reported total includes a delivery
 * charge the product prices do not, the same discrepancy a real retailer
 * shows.
 */
const SHELF = [
  { id: "mock-chicken-320", title: "Chicken Breast Fillets 320G", price: 2.44 },
  { id: "mock-chicken-650", title: "Chicken Breast Fillets 650G", price: 4.9 },
  { id: "mock-chicken-1kg", title: "Chicken Breast Fillets 1Kg", price: 6.69 },
  { id: "mock-mince-500", title: "Beef Mince 5% Fat 500G", price: 4.4 },
  { id: "mock-mince-750", title: "Beef Mince 5% Fat 750G", price: 6.15 },
  { id: "mock-onion-3", title: "Brown Onions 3 Pack", price: 0.85 },
  { id: "mock-onion-1kg", title: "Brown Onions 1Kg", price: 1.45 },
  { id: "mock-tomatoes-tin", title: "Chopped Tomatoes 400G", price: 0.55 },
  { id: "mock-spaghetti", title: "Spaghetti 500G", price: 0.95 },
  { id: "mock-potato", title: "Maris Piper Potatoes 2.5Kg", price: 2.4 },
  { id: "mock-mystery", title: "Seasonal Vegetable Selection", price: 2.0 },
];

const DELIVERY = 5.0;

/**
 * Products for anything not on the fixed shelf, made up from the search term.
 *
 * Deterministic, so the same ingredient costs the same on every run and a test
 * can rely on it; priced from the name only, which is obviously not real and
 * is not meant to be.
 */
function stand(query) {
  const name = query.replace(/\b\w/g, (c) => c.toUpperCase());
  const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const pence = 80 + (hash(slug) % 420);
  return [
    { id: `mock-${slug}-small`, title: `Tesco ${name} 300G`, price: round(pence / 100) },
    { id: `mock-${slug}-large`, title: `Tesco ${name} 700G`, price: round((pence * 1.9) / 100) },
  ];
}

function hash(value) {
  let total = 0;
  for (const character of value) total = (total * 31 + character.charCodeAt(0)) % 100000;
  return total;
}

export function createMockAdapter({ failEvery = 0 } = {}) {
  const basket = new Map();
  let calls = 0;

  function maybeFail() {
    calls += 1;
    if (failEvery && calls % failEvery === 0) {
      throw retailerError("RATE_LIMITED", "Mock retailer is throttling.", { status: 429 });
    }
  }

  /** A shelf item, or one of the made-up ones, recovered from its id. */
  function find(productId) {
    const shelved = SHELF.find((item) => item.id === productId);
    if (shelved) return shelved;
    const match = /^mock-(.+)-(small|large)$/.exec(productId);
    if (!match) return undefined;
    return stand(match[1].replace(/-/g, " ")).find((item) => item.id === productId);
  }

  return {
    id: "mock",
    live: false,

    async search(query, limit = 10) {
      maybeFail();
      const words = query.toLowerCase().split(/\s+/).filter(Boolean);
      const known = SHELF.filter((item) => words.some((word) => item.title.toLowerCase().includes(word)));
      if (known.length > 0) return known.slice(0, limit);

      // A real shop stocks almost everything you can name, and the fixed shelf
      // above only covers a dozen ingredients. Answering "nothing found" for
      // the rest made every meal look unavailable, which is a wrong impression
      // of both the shop and the app. Two sizes, so the pack maths still has
      // something to choose between.
      return stand(query).slice(0, limit);
    },

    async readBasket() {
      maybeFail();
      const items = [...basket.values()];
      const goods = items.reduce((sum, item) => sum + item.price * item.qty, 0);
      return {
        items,
        total: items.length === 0 ? 0 : round(goods + DELIVERY),
      };
    },

    async addToBasket(productId, qty) {
      maybeFail();
      const product = find(productId);
      if (!product) throw retailerError("RETAILER_ERROR", `Unknown product ${productId}`, { status: 404 });
      const existing = basket.get(productId);
      basket.set(productId, { ...product, qty: (existing?.qty ?? 0) + qty });
      return { ok: true };
    },
    async removeItem(productId) {
      maybeFail();
      basket.delete(productId);
    },
    async setQuantity(productId, qty) {
      maybeFail();
      const product = find(productId);
      if (!product) throw retailerError('BAD_REQUEST', 'Unknown mock product.');
      basket.set(productId, { ...product, qty });
    },
  };
}

function round(n) {
  return Math.round(n * 100) / 100;
}
