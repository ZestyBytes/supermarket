import type { PlannedMeal, Recipe } from "../domain/types";
import { MealPhoto } from "./MealPhoto";
import { Icon } from "./Icon";

interface Props {
  plan: PlannedMeal[];
  recipes: Recipe[];
  wanted: number;
  onSurprise: () => void;
  onRemove: (key: string) => void;
}

/**
 * How the week is going.
 *
 * "6 of 5 dinners picked" reads as an error in a form you have not filled in
 * wrong. Past the target the target stops being the point, so it goes away.
 */
function count(picked: number, wanted: number): string {
  if (picked === 0) return `No dinners picked yet. ${wanted} to go`;
  if (picked >= wanted) return picked === 1 ? "1 dinner picked" : `${picked} dinners picked`;
  return `${picked} of ${wanted} dinners picked`;
}

export function WeekBar({ plan, recipes, wanted, onSurprise, onRemove }: Props) {
  return (
    <section className="fresh-week" aria-label="This week">
      <div className="fresh-controls">
        <div><h1>Your week</h1><p>{count(plan.length, wanted)}</p></div>
        <button type="button" className="fresh-pick" onClick={onSurprise}>
          <Icon name="retry" size={16} />
          Pick for me
        </button>
      </div>

      <div className="fresh-selection">
        <div className="fresh-thumbs">
          {plan.map((meal) => (
            <button
              key={meal.key}
              type="button"
              className="selected-meal"
              aria-label={`Remove ${recipes.find((recipe) => recipe.id === meal.recipeId)?.name || "meal"}`}
              onClick={() => onRemove(meal.key)}
            >
              <MealPhoto id={meal.recipeId} />
              <span>
                <Icon name="check" />
              </span>
            </button>
          ))}

          {Array.from({ length: Math.min(5, Math.max(0, wanted - plan.length)) }, (_, index) => (
            <a href="#choose-meals" className="empty-meal" key={index} aria-label="Choose another dinner">
              <Icon name="plus" />
            </a>
          ))}
        </div>

      </div>
    </section>
  );
}
