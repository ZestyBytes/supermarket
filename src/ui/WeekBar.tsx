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

export function WeekBar({ plan, recipes, wanted, onSurprise, onRemove }: Props) {
  return (
    <section className="fresh-week" aria-label="This week">
      <div className="fresh-controls">
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

        <p aria-live="polite">
          <strong>
            {plan.length} of {wanted}
          </strong>
          <span>dinners picked</span>
        </p>
      </div>
    </section>
  );
}
