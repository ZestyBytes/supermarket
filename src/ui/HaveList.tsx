import { byAisle } from "../domain/aisles";
import type { Requirement } from "../domain/types";
import { formatQty, money } from "../domain/units";
import type { RetailerBasket } from "../domain/retailerClient";
import type { ItemStatus } from "./useBasket";
import { useState, type ReactNode } from "react";
import { Icon } from "./Icon";

interface Props {
  requirements: Requirement[];
  pantry: Set<string>;
  /** Where each ingredient has got to with Tesco. */
  statuses: ItemStatus[];
  /** What was already in the Tesco basket before this week's plan. */
  theirs: RetailerBasket["items"];
  onToggle: (ingredientId: string) => void;
  /** Buy a different Tesco product for this ingredient. */
  onSwap: (ingredientId: string, productId: string) => void;
  /** Take this ingredient back out of the Tesco basket. */
  onUndo: (ingredientId: string) => void;
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
export function HaveList({ requirements, pantry, statuses, theirs, onToggle, onSwap, onUndo }: Props) {
  const [open, setOpen] = useState<string | null>(null);
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

              const swappable = (status?.choices?.length ?? 0) > 1;
              const picking = open === requirement.ingredient.id;

              return (
                <li className={`tick${have ? " tick--have" : ""}`} key={requirement.ingredient.id}>
                  <div className="tick__line">
                    <label className="tick__box">
                      <input type="checkbox" checked={have} onChange={() => onToggle(requirement.ingredient.id)} />
                      <span className="box">
                        <Icon name="check" size={16} />
                      </span>
                      <span className="sr">Already have {requirement.ingredient.name}</span>
                    </label>

                    <Body
                      swappable={swappable}
                      picking={picking}
                      onPick={() => setOpen(picking ? null : requirement.ingredient.id)}
                      label={`Buy something else for ${requirement.ingredient.name}`}
                    >
                      <span className="tick__name">
                        {status?.product ? status.product.title : requirement.ingredient.name}
                        {swappable && <Icon name={picking ? "up" : "down"} size={15} />}
                      </span>
                      {note && (
                        <span
                          className={`tick__for${status && bad(status) ? " tick__for--bad" : ""}${status?.instead ? " tick__for--swap" : ""}`}
                        >
                          {note}
                        </span>
                      )}
                    </Body>

                    {status?.state === "added" && (
                      <button
                        className="tick__in"
                        type="button"
                        title={`Take ${requirement.ingredient.name} back out of your Tesco basket`}
                        aria-label={`Take ${requirement.ingredient.name} back out of your Tesco basket`}
                        onClick={() => onUndo(requirement.ingredient.id)}
                      >
                        <Icon name="check" size={15} />
                        <Icon name="cross" size={15} />
                      </button>
                    )}
                    {!have && (
                      <span className="tick__qty">
                        {status?.cost != null ? (
                          <>
                            {(status.packs ?? 1) > 1 && <b className="tick__packs">{status.packs} ×</b>}
                            {money(status.cost)}
                          </>
                        ) : (
                          formatQty(requirement.qty, requirement.ingredient)
                        )}
                      </span>
                    )}
                  </div>

                  {picking && (
                    <div className="swaps__wrap">
                    <p className="swaps__for">
                      {requirement.ingredient.name} for {requirement.sources.map((source) => source.recipeName).join(", ")}
                    </p>
                    <ul className="swaps" aria-label={`Other products for ${requirement.ingredient.name}`}>
                      {status?.choices?.map((option) => (
                        <li key={option.id}>
                          <button
                            type="button"
                            className={option.id === status.product?.id ? "is-on" : undefined}
                            onClick={() => {
                              onSwap(requirement.ingredient.id, option.id);
                              setOpen(null);
                            }}
                          >
                            <span className="swaps__name">{option.title}</span>
                            <span className="swaps__price">{money(option.price)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    </div>
                  )}
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

/** The middle of a line: a button when there is a choice to make, plain text when not. */
function Body({
  swappable,
  picking,
  onPick,
  label,
  children,
}: {
  swappable: boolean;
  picking: boolean;
  onPick: () => void;
  label: string;
  children: ReactNode;
}) {
  if (!swappable) return <span className="tick__text">{children}</span>;
  return (
    <button className="tick__text tick__text--pick" type="button" aria-expanded={picking} aria-label={label} onClick={onPick}>
      {children}
    </button>
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
  // We know our searches came back empty. We do not know Tesco's whole shelf,
  // and saying so as though we did is a claim the app cannot support.
  if (status.state === "missing") return "We could not find this at Tesco";
  if (status.state === "failed") return `Not added. ${status.why ?? ""}`.trim();
  // This one survives being bought, because it is the thing you would want to
  // know when the shopping turns up and it is not what you asked for.
  if (status.instead) return `Instead of ${status.instead.toLowerCase()}`;
  if (status.state === "added") return undefined;
  // Once there is a product on the line, the line is finished. Which dinners
  // wanted it only helps while there is nothing else to look at.
  if (status.product) return undefined;

  const meals = requirement.sources.map((s) => s.recipeName);
  return meals.length > 2 ? `for ${meals.slice(0, 2).join(", ")} +${meals.length - 2}` : `for ${meals.join(", ")}`;
}
