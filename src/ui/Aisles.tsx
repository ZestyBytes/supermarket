import { useMemo, useState } from "react";
import { money, unitPrice } from "../domain/units";
import type { BasketLine } from "../domain/basket";
import type { Aisle, Ingredient, Product } from "../domain/types";

interface Props {
  products: Product[];
  ingredients: Ingredient[];
  basket: BasketLine[];
  onQty: (productId: string, qty: number) => void;
}

const AISLE_ORDER: Aisle[] = ["produce", "bakery", "meat-fish", "dairy", "cupboard", "frozen"];
const AISLE_NAMES: Record<Aisle, string> = {
  produce: "Fruit & veg",
  bakery: "Bakery",
  "meat-fish": "Meat & fish",
  dairy: "Dairy & eggs",
  cupboard: "Cupboard",
  frozen: "Frozen",
};

export function Aisles({ products, ingredients, basket, onQty }: Props) {
  const [query, setQuery] = useState("");
  const [aisle, setAisle] = useState<Aisle | null>(null);

  const byIngredient = useMemo(
    () => new Map(ingredients.map((i) => [i.id, i])),
    [ingredients],
  );
  const held = new Map(basket.map((l) => [l.product.id, l.qty]));

  const shown = products.filter((product) => {
    const ingredient = byIngredient.get(product.ingredientId);
    if (!ingredient) return false;
    if (aisle && ingredient.aisle !== aisle) return false;
    if (!query) return true;
    return `${product.name} ${product.size} ${ingredient.name}`.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <section className="panel" aria-labelledby="aisles-head">
      <div className="panel__head">
        <h2 id="aisles-head">{aisle ? AISLE_NAMES[aisle] : "Whole store"}</h2>
        <div className="filters">
          <label className="sr" htmlFor="aisle-search">
            Search the shelves
          </label>
          <input
            id="aisle-search"
            className="input"
            type="search"
            value={query}
            placeholder="mince, cheddar, rice…"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="chips">
        <button className="chip" type="button" aria-pressed={aisle === null} onClick={() => setAisle(null)}>
          Everything
        </button>
        {AISLE_ORDER.filter((a) => products.some((p) => byIngredient.get(p.ingredientId)?.aisle === a)).map((a) => (
          <button
            className="chip"
            type="button"
            key={a}
            aria-pressed={aisle === a}
            onClick={() => setAisle(aisle === a ? null : a)}
          >
            {AISLE_NAMES[a]}
          </button>
        ))}
      </div>

      <ul className="shelves">
        {shown.map((product) => {
          const ingredient = byIngredient.get(product.ingredientId)!;
          const qty = held.get(product.id) ?? 0;
          return (
            <li className="item" key={product.id}>
              <div className="item__top">
                {product.was && <span className="tag tag--offer">Offer</span>}
                {!product.was && product.ownBrand && <span className="tag">Own brand</span>}
              </div>
              <h3 className="item__name">{product.name}</h3>
              <p className="item__size">{product.size}</p>
              <p className="shelf">
                <span className="shelf__price">{money(product.price)}</span>
                {product.was && <span className="shelf__was">{money(product.was)}</span>}
              </p>
              <p className="shelf__unit">{unitPrice(product.price, product.packQty, ingredient.unit)}</p>
              {qty > 0 ? (
                <div className="stepper">
                  <button type="button" onClick={() => onQty(product.id, qty - 1)} aria-label={`One fewer ${product.name}`}>
                    −
                  </button>
                  <output>{qty}</output>
                  <button type="button" onClick={() => onQty(product.id, qty + 1)} aria-label={`One more ${product.name}`}>
                    +
                  </button>
                </div>
              ) : (
                <button className="btn" type="button" onClick={() => onQty(product.id, 1)}>
                  Add to basket
                </button>
              )}
            </li>
          );
        })}
        {shown.length === 0 && <li className="empty">Nothing on the shelf for that.</li>}
      </ul>
    </section>
  );
}
