import type { MatchResult } from "../domain/match";
import { formatQty } from "../domain/units";
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

export function ShoppingList({ match, onTogglePantry }: Props) {
  let lastAisle: Aisle | null = null;

  return (
    <section className="panel" aria-labelledby="list-head">
      <div className="panel__head">
        <h2 id="list-head">Shopping list</h2>
        <span className="label">
          {match.lines.length} ingredients to shop for
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
            const header = ingredient.aisle !== lastAisle ? (lastAisle = ingredient.aisle) : null;

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
                  </div>

                  <div className="row__money">
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

      <p>Next: find Tesco products below, review the packs, then add them to Tesco.</p>
    </section>
  );
}
