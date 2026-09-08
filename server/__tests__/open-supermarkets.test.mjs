import { describe, it, expect } from 'vitest';
import { createOpenSupermarketsAdapter } from '../adapters/open-supermarkets.mjs';
import { saveSession } from '../session.mjs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
describe('Open Supermarkets boundary', () => {
  it('recovers transient batch reads and preserves persistent failures as errors', async () => {
    let attempts = 0;
    const product = { product_uid: '123', name: 'Chicken 500g', retail_price: { price: 4.25 }, in_stock: true };
    const adapter = createOpenSupermarketsAdapter({getSession:()=>({cookie:'test=fixture'}),createProvider:()=>({ search:async query=>{
      if (query === 'broken' || attempts++ === 0) throw new Error('Temporary failure');
      return [product];
    }})});
    const result = await adapter.searchBatch(['chicken'],1);
    expect(result[0].results[0].id).toBe('123');
    expect(attempts).toBe(2);
    const failed = await adapter.searchBatch(['broken'],1);
    expect(failed[0].error.code).toBe('RETAILER_ERROR');
  });
  it('maps upstream products and preserves real prices', async () => {
    const adapter = createOpenSupermarketsAdapter({ getSession: () => ({ cookie: 'test=fixture' }), createProvider: () => ({ search: async () => [{ product_uid: '123', name: 'Chicken 500g', retail_price: { price: 4.25 }, in_stock: true }] }) });
    expect(await adapter.search('chicken')).toEqual([{ id: '123', title: 'Chicken 500g', price: 4.25, size: undefined, url: 'https://www.tesco.com/groceries/en-GB/products/123' }]);
  });
  it('rejects malformed baskets instead of claiming an empty basket', async () => {
    const adapter = createOpenSupermarketsAdapter({ getSession: () => ({ cookie: 'test=fixture' }), createProvider: () => ({ getBasket: async () => ({ items: null, total_cost: 0 }) }) });
    await expect(adapter.readBasket()).rejects.toMatchObject({ code: 'RETAILER_ERROR' });
  });
  it('turns GraphQL authentication failure into a safe actionable error', async () => {
    const adapter = createOpenSupermarketsAdapter({ getSession: () => ({ cookie: 'secret=fixture' }), createProvider: () => ({ getBasket: async () => { throw new Error('GraphQL error (GetBasket): Unauthorized secret=fixture'); } }) });
    await expect(adapter.readBasket()).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
    await expect(adapter.readBasket()).rejects.not.toThrow('secret=fixture');
  });
  it('session save returns no bearer, cookies or captured headers', () => {
    const saved = saveSession('a=fixture', { file: join(mkdtempSync(join(tmpdir(), 'supermarket-')), 'session.json'), authorization: 'Bearer SECRET', apiHeaders: { 'customer-uuid': 'PRIVATE' }, cookies: [{ value: 'HIDDEN' }] });
    expect(JSON.stringify(saved)).not.toMatch(/SECRET|PRIVATE|HIDDEN|fixture/);
  });
});
