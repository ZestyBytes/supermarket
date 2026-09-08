import type { MatchResult } from "../domain/match";
import { formatQty, money, unitPrice } from "../domain/units";
import { PRODUCTS } from "../data/products";
import type { Aisle } from "../domain/types";

interface Props {
  match: MatchResult;
  /** Packs still missing from the basket, by product id. */
  gaps: Map<string, number>;
  outstandingCost: number;
  onTogglePantry: (ingredientId: string) => void;
  onPrefer: (ingredientId: string, productId: string) => void;
  onAddAll: () => void;
  onAddOne: (productId: string) => void;
}

const AISLE_NAMES: Record<Aisle, string> = {
  produce: "Fruit & veg",
  bakery: "Bakery",
  "meat-fish": "Meat & fish",
  dairy: "Dairy & eggs",
  cupboard: "Cupboard",
  frozen: "Frozen",
};

export function ShoppingList({
  match,
  gaps,
  outstandingCost,
  onTogglePantry,
  onPrefer,
  onAddAll,
  onAddOne,
}: Props) {
  const weekCost = match.lines.reduce((sum, line) => sum + line.cost, 0);
  let lastAisle: Aisle | null = null;

  return (
    <section className="panel" aria-labelledby="list-head">
      <div className="panel__head">
        <h2 id="list-head">Shopping list</h2>
        <span className="label">
          {match.lines.length} products · {money(weekCost)} for the week
        </span>
      </div>

      {match.lines.length === 0 ? (
        <p className="empty">
          Plan a meal and its ingredients appear here — consolidated, matched to a pack and costed.
        </p>
      ) : (
        <ul className="list">
          {match.lines.map((line) => {
            const { ingredient } = line.requirement;
            const gap = gaps.get(line.product.id) ?? 0;
            const header = ingredient.aisle !== lastAisle ? (lastAisle = ingredient.aisle) : null;
            const options = [line.product, ...line.alternatives].sort((a, b) => a.packQty - b.packQty);

            return (
              <li key={ingredient.id}>
                {header && <p className="list__aisle label">{AISLE_NAMES[header]}</p>}
                <div className="row">
                  <div className="row__what">
                    <h3 className="row__name">{ingredient.name}</h3>
                    <p className="row__need">
                      Need {formatQty(line.requirement.qty, ingredient)}
                      {line.requirement.sources.length > 1 && (
                        <span className="row__from">
                          {" "}
                          — {line.requirement.sources.map((s) => `${s.recipeName} ${formatQty(s.qty, ingredient)}`).join(", ")}
                        </span>
                      )}
                    </p>
                    <p className="row__buy">
                      Buy <strong>{line.packs} × {line.product.size}</strong> {line.product.name}
                      <span className="row__unit"> · {unitPrice(line.product.price, line.product.packQty, ingredient.unit)}</span>
                      {line.surplus > 0 && (
                        <span className="row__spare"> · {formatQty(line.surplus, ingredient)} spare</span>
                      )}
                    </p>
                    {options.length > 1 && (
                      <label className="row__swap">
                        <span className="sr">Choose a different pack for {ingredient.name}</span>
                        <select
                          value={line.product.id}
                          onChange={(e) => onPrefer(ingredient.id, e.target.value)}
                        >
                          {options.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.size} — {option.name} at {money(option.price)}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>

                  <div className="row__money">
                    <span className="row__cost">{money(line.cost)}</span>
                    {gap > 0 ? (
                      <button className="mini mini--go" type="button" onClick={() => onAddOne(line.product.id)}>
                        Add {gap}
                      </button>
                    ) : (
                      <span className="pill pill--done">In basket</span>
                    )}
                    <button className="mini" type="button" onClick={() => onTogglePantry(ingredient.id)}>
                      I have it
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {match.skipped.length > 0 && (
        <div className="pantry">
          <p className="label">In the cupboard, so not on the list</p>
          <div className="chips">
            {match.skipped.map((requirement) => (
              <button
                className="chip chip--have"
                type="button"
                key={requirement.ingredient.id}
                onClick={() => onTogglePantry(requirement.ingredient.id)}
              >
                {requirement.ingredient.name} · put it back
              </button>
            ))}
          </div>
        </div>
      )}

      {match.unmatched.length > 0 && (
        <p className="warn">
          Not stocked: {match.unmatched.map((r) => r.ingredient.name).join(", ")}. You will need
          these from somewhere else.
        </p>
      )}

      <div className="panel__foot">
        <p className="panel__sum">
          <strong>{money(outstandingCost)}</strong> still to add · {money(weekCost)} for the whole
          week · {PRODUCTS.length} lines stocked
        </p>
        <button className="btn btn--go" type="button" disabled={outstandingCost === 0} onClick={onAddAll}>
          {outstandingCost === 0 ? "Basket covers the plan" : `Add the week to my basket · ${money(outstandingCost)}`}
        </button>
      </div>
    </section>
  );
}
