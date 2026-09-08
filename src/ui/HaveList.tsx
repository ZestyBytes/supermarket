import type { Requirement } from "../domain/types";
import { formatQty } from "../domain/units";

interface Props {
  requirements: Requirement[];
  pantry: Set<string>;
  onToggle: (ingredientId: string) => void;
}

/**
 * The consolidated list, shown for one purpose: ticking off what is already in
 * the cupboard. Everything else about it is settled by then, so it is a tab
 * rather than something in the way.
 */
export function HaveList({ requirements, pantry, onToggle }: Props) {
  const needed = requirements.filter((r) => !pantry.has(r.ingredient.id));
  const have = requirements.filter((r) => pantry.has(r.ingredient.id));

  if (requirements.length === 0) {
    return <p className="empty">Choose some meals and the list builds itself.</p>;
  }

  return (
    <>
      <p className="listintro">
        Tick anything you already have. {needed.length} to buy
        {have.length > 0 && `, ${have.length} already in`}.
      </p>

      <ul className="ticks">
        {needed.map((requirement) => (
          <Tick key={requirement.ingredient.id} requirement={requirement} have={false} onToggle={onToggle} />
        ))}
      </ul>

      {have.length > 0 && (
        <>
          <p className="label listlabel">Already have</p>
          <ul className="ticks">
            {have.map((requirement) => (
              <Tick key={requirement.ingredient.id} requirement={requirement} have onToggle={onToggle} />
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function Tick({
  requirement,
  have,
  onToggle,
}: {
  requirement: Requirement;
  have: boolean;
  onToggle: (id: string) => void;
}) {
  const meals = requirement.sources.map((s) => s.recipeName);
  return (
    <li className={`tick${have ? " tick--have" : ""}`}>
      <label>
        <input type="checkbox" checked={have} onChange={() => onToggle(requirement.ingredient.id)} />
        <span className="tick__body">
          <span className="tick__name">{requirement.ingredient.name}</span>
          <span className="tick__qty">{formatQty(requirement.qty, requirement.ingredient)}</span>
          {meals.length > 1 && <span className="tick__for">for {meals.length} meals</span>}
          {meals.length === 1 && <span className="tick__for">for {meals[0]}</span>}
        </span>
      </label>
    </li>
  );
}
