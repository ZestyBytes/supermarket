import type { PlannedMeal, Recipe } from "../domain/types";

interface Props {
  plan: PlannedMeal[];
  recipes: Recipe[];
  servings: number;
  wanted: number;
  onServings: (servings: number) => void;
  onWanted: (meals: number) => void;
  onSurprise: () => void;
  onClear: () => void;
  onRemove: (key: string) => void;
}

/** How many, for how many, and what is in the week so far. */
export function WeekBar({ plan, recipes, servings, wanted, onServings, onWanted, onSurprise, onClear, onRemove }: Props) {
  const nameOf = (id: string) => recipes.find((r) => r.id === id);

  return (
    <section className="week" aria-label="This week">
      <div className="week__dials">
        <Dial label="Meals this week" value={wanted} min={1} max={14} onChange={onWanted} />
        <Dial label="Cooking for" value={servings} min={1} max={12} onChange={onServings} suffix="people" />
      </div>

      <div className="week__acts">
        <button className="btn btn--go" type="button" onClick={onSurprise}>
          {plan.length > 0 ? "Surprise me again" : `Pick ${wanted} for me`}
        </button>
        {plan.length > 0 && (
          <button className="mini" type="button" onClick={onClear}>
            Clear the week
          </button>
        )}
      </div>

      {plan.length > 0 && (
        <ul className="week__chosen">
          {plan.map((meal) => {
            const recipe = nameOf(meal.recipeId);
            return (
              <li key={meal.key}>
                <span aria-hidden="true">{recipe?.emoji}</span>
                <span className="week__name">{recipe?.name ?? meal.recipeId}</span>
                <button
                  className="week__drop"
                  type="button"
                  aria-label={`Remove ${recipe?.name ?? "meal"}`}
                  onClick={() => onRemove(meal.key)}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="week__count">
        {plan.length} of {wanted} chosen{plan.length > 0 && ` · feeding ${servings}`}
      </p>
    </section>
  );
}

function Dial({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="dial">
      <span className="label">{label}</span>
      <div className="stepper">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label={`Fewer: ${label}`}>
          −
        </button>
        <output>{value}</output>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))} aria-label={`More: ${label}`}>
          +
        </button>
      </div>
      {suffix && <span className="dial__suffix">{suffix}</span>}
    </div>
  );
}
