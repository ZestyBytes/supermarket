import { byAisle } from "../domain/aisles";
import type { Requirement } from "../domain/types";
import { formatQty, money } from "../domain/units";
import type { RetailerBasket } from "../domain/retailerClient";
import type { ItemStatus } from "./useBasket";
import { Icon } from "./Icon";

interface Props {
  requirements: Requirement[];
  pantry: Set<string>;
  /** Where each ingredient has got to with Tesco. */
  statuses: ItemStatus[];
  /** What was already in the Tesco basket before this week's plan. */
  theirs: RetailerBasket["items"];
  onToggle: (ingredientId: string) => void;
}

/**
 * The list, grouped by aisle, with each line saying where it has got to.
 *
 * Two things people need from this and could not get: whether an ingredient
 * actually made it into the basket, and whether something in the basket came
 * from somewhere else. Both are now on the page — the second in its own
 * section, because someone else's shopping is not a fault to fix, just
 * something to know about before you check out.
 */
export function HaveList({ requirements, pantry, statuses, theirs, onToggle }: Props) {
  if (requirements.length === 0) {
    return <p className="empty">Choose some dinners and the list builds itself.</p>;
  }

  const groups = byAisle(requirements);
  const ticked = requirements.filter((r) => pantry.has(r.ingredient.id)).length;
  const stateOf = (id: string) => statuses.find((s) => s.ingredientId === id);

  return (
    <>
      <p className="hint">
        <Icon name="info" size={17} />
        <span>
          Tick anything already in the cupboard — <b>{ticked} ticked</b>
        </span>
      </p>

      {groups.map((group) => (
        <section className="aisle" key={group.aisle}>
          <h2 className="aisle__head">
            <span className="label">{group.name}</span>
            <span className="aisle__rule" />
            <span className="aisle__n">{group.items.filter((i) => !pantry.has(i.ingredient.id)).length}</span>
          </h2>

          <ul className="ticks">
            {group.items.map((requirement) => {
              const have = pantry.has(requirement.ingredient.id);
              const status = have ? undefined : stateOf(requirement.ingredient.id);
              const meals = requirement.sources.map((s) => s.recipeName);

              return (
                <li className={`tick${have ? " tick--have" : ""}`} key={requirement.ingredient.id}>
                  <label>
                    <input type="checkbox" checked={have} onChange={() => onToggle(requirement.ingredient.id)} />
                    <span className="box">
                      <Icon name="check" size={16} />
                    </span>
                    <span className="tick__text">
                      <span className="tick__name">{requirement.ingredient.name}</span>
                      <span className="tick__for">
                        {have
                          ? "already have"
                          : status?.product
                            ? status.product.title
                            : meals.length > 2
                              ? `for ${meals.slice(0, 2).join(", ")} +${meals.length - 2}`
                              : `for ${meals.join(", ")}`}
                      </span>
                      {status && <Status status={status} />}
                    </span>
                    {!have && (
                      <span className="tick__qty">
                        {status?.cost != null ? money(status.cost) : formatQty(requirement.qty, requirement.ingredient)}
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {theirs.length > 0 && (
        <section className="aisle" aria-label="Already in your Tesco basket">
          <h2 className="aisle__head">
            <span className="label">Already in your basket</span>
            <span className="aisle__rule" />
            <span className="aisle__n">{theirs.length}</span>
          </h2>
          <p className="hint hint--quiet">
            <Icon name="info" size={17} />
            <span>Not from this week's dinners — someone put these in before. They stay as they are.</span>
          </p>
          <ul className="ticks">
            {theirs.map((item) => (
              <li className="tick tick--theirs" key={item.id}>
                <span className="tick__text">
                  <span className="tick__name">{item.title}</span>
                  <span className="tick__for">{item.qty} in the basket</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** A short word on where one ingredient has got to, and nothing when it is dull. */
function Status({ status }: { status: ItemStatus }) {
  switch (status.state) {
    case "checking":
      return <span className="mark mark--wait">Checking Tesco…</span>;
    case "ready":
      return (
        <span className="mark mark--ready">
          {status.packs} × ready to add
        </span>
      );
    case "added":
      return (
        <span className="mark mark--in">
          <Icon name="check" size={13} /> In your basket
        </span>
      );
    case "failed":
      return <span className="mark mark--bad">Not added — {status.why}</span>;
    case "missing":
      return <span className="mark mark--bad">Tesco has nothing for this</span>;
  }
}
