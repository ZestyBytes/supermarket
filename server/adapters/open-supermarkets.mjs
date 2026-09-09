import { createRequire } from 'node:module';
import { z } from 'zod';
import { loadSession } from '../session.mjs';
import { refreshBrowserSession } from '../browser-refresh.mjs';
const require = createRequire(import.meta.url);
const { TescoProvider } = require('open-supermarkets/dist/providers/tesco/index.js');
const { batchSearch } = require('open-supermarkets/dist/batch.js');

export function retailerError(code, message) { return Object.assign(new Error(message), { code }); }
export function classify(error) {
  if (error?.code && ['SESSION_MISSING', 'SESSION_EXPIRED', 'BAD_REQUEST', 'BASKET_UNCERTAIN'].includes(error.code)) return error;
  const status = error?.response?.status;
  if ([401, 403].includes(status) || /unauthori[sz]ed|session rejected|session expired/i.test(error?.message ?? '')) return retailerError('SESSION_EXPIRED', 'Tesco needs to reconnect. Run npm run connect; sign in only if the browser asks.');
  if (status === 429) return retailerError('RATE_LIMITED', 'Tesco is asking us to slow down.');
  return retailerError('RETAILER_ERROR', 'Open Supermarkets could not complete the Tesco request. No raw retailer response has been exposed.');
}
const productSchema = z.object({ product_uid: z.string().min(1), name: z.string().min(1), retail_price: z.object({ price: z.number().nonnegative() }), in_stock: z.boolean(), size: z.string().optional() });
const basketSchema = z.object({ items: z.array(z.object({ product_uid: z.string().min(1), name: z.string(), quantity: z.number().int().positive(), unit_price: z.number().nonnegative() })), total_cost: z.number().nonnegative() });

export function createOpenSupermarketsAdapter({ getSession = loadSession, createProvider = session => new TescoProvider(session) } = {}) {
  const searchCache = new Map();
  function provider() {
    const session = getSession();
    if (!session?.cookie) throw retailerError('SESSION_MISSING', 'Connect Tesco first with npm run connect. No DevTools setup is needed.');
    return createProvider({ cookie: session.cookie, headers: { ...session.apiHeaders, ...(session.authorization ? { authorization: session.authorization } : {}) } });
  }
  async function call(action, refreshAllowed = true) {
    try { return await action(provider()); }
    catch (error) {
      const failure = classify(error);
      // Refresh by letting Tesco's own saved browser session renew itself.
      // Only reads may be repeated; writes never enter this path.
      if (refreshAllowed && getSession === loadSession && failure.code === 'SESSION_EXPIRED' && await refreshBrowserSession()) {
        try { return await action(provider()); } catch (retryError) { throw classify(retryError); }
      }
      throw failure;
    }
  }
  return {
    id: 'tesco', live: true,
    async search(query, limit = 5) {
      return call(async p => z.array(productSchema).parse(await p.search(query, { limit })).filter(x => x.in_stock && x.retail_price.price > 0).map(x => ({ id: x.product_uid, title: x.name, price: x.retail_price.price, size: x.size, url: `https://www.tesco.com/groceries/en-GB/products/${x.product_uid}` })));
    },
    async searchBatch(queries, limit = 5) {
      return call(async p => {
        // Upstream's reusable batch helper lets us bound concurrency without subprocesses.
        const results = [];
        // Four at a time rather than two: a week is twenty-five or more
        // ingredients, and searching them two-by-two is most of the wait.
        for (let i = 0; i < queries.length; i += 4) {
          const resilient = { search: async (query, options) => {
            const key = `${query.toLowerCase()}|${options.limit}`;
            const cached = searchCache.get(key);
            if (cached && cached.until > Date.now()) return cached.products;
            const collected = new Map();
            for (let attempt = 0; ; attempt++) {
              try {
                const products = await p.search(query, options);
                for (const product of products) if (product.in_stock && product.retail_price.price > 0) collected.set(product.product_uid, product);
                // Retry only an empty answer. Retrying "fewer than five" meant
                // waiting an extra 1.5s for every ordinary ingredient that
                // simply has three good matches, which was most of them.
                if (collected.size === 0 && attempt < 1) {
                  await new Promise(resolve => setTimeout(resolve, 400));
                  continue;
                }
                const complete = [...collected.values()];
                if (complete.length > 0) searchCache.set(key, { products: complete, until: Date.now() + 300000 });
                return complete;
              } catch (error) {
                if (attempt >= 2 || classify(error).code === 'SESSION_EXPIRED') throw error;
                await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
              }
            }
          } };
          const batch = await batchSearch(resilient, queries.slice(i, i + 4), { limit, concurrency: 2 });
          const authFailure = batch.find(r => r.error && classify(new Error(r.error)).code === 'SESSION_EXPIRED');
          if (authFailure) throw classify(new Error(authFailure.error));
          results.push(...batch);
        }
        return results.map(r => ({ query: r.query, results: r.products.filter(x => x.inStock && x.price > 0).map(x => ({ id: x.id, title: x.name, price: x.price, size: x.size, url: `https://www.tesco.com/groceries/en-GB/products/${x.id}` })), ...(r.error ? { error: { code: classify(new Error(r.error)).code, message: classify(new Error(r.error)).message } } : {}) }));
      });
    },
    async readBasket() {
      return call(async p => { const b = basketSchema.parse(await p.getBasket()); return { items: b.items.map(i => ({ id: i.product_uid, title: i.name, qty: i.quantity, price: i.unit_price })), total: b.total_cost }; });
    },
    // Upstream Tesco add sets an ABSOLUTE quantity. Callers must read before writing.
    async setQuantity(productId, quantity) { return call(p => p.addToBasket(productId, quantity), false); },
  };
}
