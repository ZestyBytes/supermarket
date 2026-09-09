import { byAisle } from "../domain/aisles";
import type { Requirement } from "../domain/types";
import { formatQty } from "../domain/units";
import { Icon } from "./Icon";

interface Props {
  requirements: Requirement[];
  pantry: Set<string>;
  onToggle: (ingredientId: string) => void;
}

/**
 * The consolidated list, grouped the way a supermarket is laid out.
 *
 * One alphabetical column means walking the shop twice. Every ingredient
 * already carries an aisle, so grouping costs nothing and turns the list into
 * something you can follow from the door to the till. Ticking is the only
 * thing to do here: everything else about the list is already settled.
 */
export function HaveList({ requirements, pantry, onToggle }: Props) {
  if (requirements.length === 0) {
    return <p className="empty">Choose some dinners and the list builds itself.</p>;
  }

  const groups = byAisle(requirements);
  const ticked = requirements.filter((r) => pantry.has(r.ingredient.id)).length;

  return (
    <>
      <p className="hint">
        <Icon.info size={17} />
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
              const meals = requirement.sources.map((s) => s.recipeName);
              return (
                <li className={`tick${have ? " tick--have" : ""}`} key={requirement.ingredient.id}>
                  <label>
                    <input type="checkbox" checked={have} onChange={() => onToggle(requirement.ingredient.id)} />
                    <span className="box">
                      <Icon.check size={16} />
                    </span>
                    <span className="tick__text">
                      <span className="tick__name">{requirement.ingredient.name}</span>
                      <span className="tick__for">
                        {have
                          ? "already have"
                          : meals.length > 2
                            ? `for ${meals.slice(0, 2).join(", ")} +${meals.length - 2}`
                            : `for ${meals.join(", ")}`}
                      </span>
                    </span>
                    {!have && (
                      <span className="tick__qty">{formatQty(requirement.qty, requirement.ingredient)}</span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
