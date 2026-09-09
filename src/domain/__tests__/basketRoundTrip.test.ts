import { afterEach, describe, expect, it } from "vitest";
import { addToBasket, removeFromBasket, useDirectTesco } from "../retailerClient";
import { createTescoTransport } from "../tescoDirect";

/**
 * The whole Add to Basket journey, against a Tesco that behaves like Tesco.
 *
 * Every part of this was tested on its own and the journey never was, which is
 * the one that matters: the button writes each line, reads the basket back, and
 * believes the read rather than the write. A stub that simply says "yes" to
 * everything would prove none of that, so this one keeps a basket, applies the
 * absolute quantities it is sent, and reports what it is actually holding.
 */
function fakeTesco() {
  const held = new Map<string, number>();
  const titles: Record<string, string> = { "p1": "Tesco Onions 1Kg", "p2": "Tesco Butter 250G" };
  let refuse: string | undefined;

  const fetch = async (_url: string, init: RequestInit) => {
    const ops = JSON.parse(String(init.body)) as Array<{ operationName: string; variables: { items?: Array<{ id: string; newValue: number }> } }>;
    const answers = ops.map((op) => {
      if (op.operationName === "UpdateBasket") {
        const [line] = op.variables.items ?? [];
        if (line.id === refuse) return { errors: [{ message: "That product is out of stock." }] };
        // Tesco's quantity is absolute, which is what makes a retry safe.
        if (line.newValue === 0) held.delete(line.id);
        else held.set(line.id, line.newValue);
      }
      return {
        data: {
          basket: {
            id: "trn:tesco:order:1",
            splitView: [{
              totalPrice: "9.99",
              items: [...held].map(([id, quantity]) => ({
                id: `line-${id}`, quantity, product: { id, title: titles[id], price: { actual: 1 } },
              })),
            }],
          },
        },
      };
    });
    return new Response(JSON.stringify(answers), { status: 200, headers: { "content-type": "application/json" } });
  };

  return { fetch, held, refuseOne: (id: string) => { refuse = id; } };
}

function connect(tesco: ReturnType<typeof fakeTesco>) {
  useDirectTesco(createTescoTransport({ headers: async () => ({ authorization: "Bearer x" }), fetch: tesco.fetch as never }));
}

afterEach(() => useDirectTesco(undefined));

describe("adding a shopping list to a real basket", () => {
  it("writes every line and reports what Tesco is holding afterwards", async () => {
    const tesco = fakeTesco();
    connect(tesco);

    const result = await addToBasket([{ productId: "p1", qty: 2 }, { productId: "p2", qty: 1 }], "attempt-1", true);

    expect(tesco.held.get("p1")).toBe(2);
    expect(result.added).toHaveLength(2);
    expect(result.failed).toEqual([]);
    expect(result.basket.items.map((i) => i.id).sort()).toEqual(["p1", "p2"]);
  });

  it("keeps going when one line is refused, and says which", async () => {
    const tesco = fakeTesco();
    tesco.refuseOne("p1");
    connect(tesco);

    const result = await addToBasket([{ productId: "p1", qty: 2 }, { productId: "p2", qty: 1 }], "attempt-2", true);

    // The refused line must not take the rest of the shop down with it.
    expect(tesco.held.get("p2")).toBe(1);
    expect(result.added.map((a) => (a as { productId: string }).productId)).toEqual(["p2"]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toMatchObject({ productId: "p1", inBasket: 0 });
  });

  it("is safe to press twice, because the quantity is absolute", async () => {
    const tesco = fakeTesco();
    connect(tesco);

    await addToBasket([{ productId: "p1", qty: 2 }], "attempt-3", true);
    await addToBasket([{ productId: "p1", qty: 2 }], "attempt-3", true);

    expect(tesco.held.get("p1")).toBe(2);
  });

  it("takes a line back out, and only the line asked for", async () => {
    const tesco = fakeTesco();
    connect(tesco);
    await addToBasket([{ productId: "p1", qty: 2 }, { productId: "p2", qty: 1 }], "attempt-4", true);

    const result = await removeFromBasket("attempt-5", ["p1"]);

    expect(tesco.held.has("p1")).toBe(false);
    expect(tesco.held.get("p2")).toBe(1);
    expect(result.basket.items.map((i) => i.id)).toEqual(["p2"]);
  });

  it("ignores a request to remove something that is not there", async () => {
    const tesco = fakeTesco();
    connect(tesco);
    await addToBasket([{ productId: "p2", qty: 1 }], "attempt-6", true);

    const result = await removeFromBasket("attempt-7", ["p1"]);

    expect(result.failed).toEqual([]);
    expect(tesco.held.get("p2")).toBe(1);
  });
});
