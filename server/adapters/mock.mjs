import { retailerError } from "./http.mjs";

/**
 * A stand-in retailer, used by the tests and by `npm run server -- --mock`.
 *
 * It behaves like the real thing in the ways that matter: search returns
 * several pack sizes with the size written into the title, the basket is
 * read back rather than assumed, and its reported total includes a delivery
 * charge the product prices do not — the same discrepancy a real retailer
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

export function createMockAdapter({ failEvery = 0 } = {}) {
  const basket = new Map();
  let calls = 0;

  function maybeFail() {
    calls += 1;
    if (failEvery && calls % failEvery === 0) {
      throw retailerError("RATE_LIMITED", "Mock retailer is throttling.", { status: 429 });
    }
  }

  return {
    id: "mock",
    live: false,

    async search(query, limit = 10) {
      maybeFail();
      const words = query.toLowerCase().split(/\s+/).filter(Boolean);
      return SHELF.filter((item) => words.some((word) => item.title.toLowerCase().includes(word))).slice(0, limit);
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
      const product = SHELF.find((item) => item.id === productId);
      if (!product) throw retailerError("RETAILER_ERROR", `Unknown product ${productId}`, { status: 404 });
      const existing = basket.get(productId);
      basket.set(productId, { ...product, qty: (existing?.qty ?? 0) + qty });
      return { ok: true };
    },
  };
}

function round(n) {
  return Math.round(n * 100) / 100;
}
