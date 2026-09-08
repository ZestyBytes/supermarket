import type { PlannedMeal, Recipe } from "../domain/types";

interface Props {
  plan: PlannedMeal[];
  recipes: Recipe[];
  onServings: (key: string, servings: number) => void;
  onRemove: (key: string) => void;
  onClear: () => void;
}

export function Planner({ plan, recipes, onServings, onRemove, onClear }: Props) {
  const byId = new Map(recipes.map((r) => [r.id, r]));

  return (
    <section className="panel" aria-labelledby="plan-head">
      <div className="panel__head">
        <h2 id="plan-head">This week's meals</h2>
        {plan.length > 0 && (
          <button className="mini" type="button" onClick={onClear}>
            Clear the week
          </button>
        )}
      </div>

      {plan.length === 0 ? (
        <p className="empty">
          No meals chosen yet. Pick some from the recipes below and the shopping list builds itself.
        </p>
      ) : (
        <ol className="meals">
          {plan.map((meal) => {
            const recipe = byId.get(meal.recipeId);
            if (!recipe) return null;
            return (
              <li className="meal" key={meal.key}>
                <div className="meal__body">
                  <h3 className="meal__name">{recipe.name}</h3>
                  <p className="meal__meta">
                    {recipe.minutes} min · written for {recipe.serves} ·{" "}
                    {recipe.ingredients.length} ingredients
                  </p>
                </div>
                <div className="meal__serves">
                  <label className="label" htmlFor={`serves-${meal.key}`}>
                    Cooking for
                  </label>
                  <div className="stepper">
                    <button
                      type="button"
                      onClick={() => onServings(meal.key, Math.max(1, meal.servings - 1))}
                      aria-label={`Fewer servings of ${recipe.name}`}
                    >
                      −
                    </button>
                    <output id={`serves-${meal.key}`}>{meal.servings}</output>
                    <button
                      type="button"
                      onClick={() => onServings(meal.key, Math.min(12, meal.servings + 1))}
                      aria-label={`More servings of ${recipe.name}`}
                    >
                      +
                    </button>
                  </div>
                </div>
                <button
                  className="meal__drop"
                  type="button"
                  onClick={() => onRemove(meal.key)}
                  aria-label={`Remove ${recipe.name} from the week`}
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
