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
 * The list, grouped by aisle, one line per thing to buy.
 *
 * Each line used to name the ingredient and then, underneath, the product
 * Tesco would sell you for it. That is the same thing said twice, at twice the
 * height: once the product is known it is the better of the two names, because
 * it is what turns up at the door. So the product becomes the line, a tick
 * beside it means it is in the basket, and a second line appears only when
 * there is something you could not have guessed.
 */
export function HaveList({ requirements, pantry, statuses, theirs, onToggle }: Props) {
  if (requirements.length === 0) {
    return <p className="empty">Choose some dinners and the list builds itself.</p>;
  }

  const groups = byAisle(requirements);
  const stateOf = (id: string) => statuses.find((s) => s.ingredientId === id);

  return (
    <>
      <p className="hint">
        <Icon name="info" size={17} />
        <span>Tick anything already in the cupboard</span>
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
              const note = have ? "already have" : aside(requirement, status);

              return (
                <li className={`tick${have ? " tick--have" : ""}`} key={requirement.ingredient.id}>
                  <label>
                    <input type="checkbox" checked={have} onChange={() => onToggle(requirement.ingredient.id)} />
                    <span className="box">
                      <Icon name="check" size={16} />
                    </span>
                    <span className="tick__text">
                      <span className="tick__name">
                        {status?.product ? status.product.title : requirement.ingredient.name}
                      </span>
                      {note && <span className={`tick__for${status && bad(status) ? " tick__for--bad" : ""}`}>{note}</span>}
                    </span>
                    {status?.state === "added" && (
                      <span className="tick__in" title="In your Tesco basket">
                        <Icon name="check" size={15} />
                      </span>
                    )}
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
            <span>Not from this week's dinners. Someone put these in before, and they stay as they are.</span>
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

function bad(status: ItemStatus) {
  return status.state === "failed" || status.state === "missing";
}

/**
 * The second line, when there is one.
 *
 * Nothing to say once a thing is matched or bought: the product name and the
 * price have already said it. Which dinners wanted it is only useful while
 * there is no product to look at.
 */
function aside(requirement: Requirement, status?: ItemStatus): string | undefined {
  if (!status) return undefined;
  if (status.state === "checking") return "Checking Tesco";
  if (status.state === "missing") return "Tesco has nothing for this";
  if (status.state === "failed") return `Not added. ${status.why ?? ""}`.trim();
  if (status.state === "added") return undefined;
  // Once there is a product on the line, the line is finished. Which dinners
  // wanted it only helps while there is nothing else to look at.
  if (status.product) return undefined;

  const meals = requirement.sources.map((s) => s.recipeName);
  return meals.length > 2 ? `for ${meals.slice(0, 2).join(", ")} +${meals.length - 2}` : `for ${meals.join(", ")}`;
}
