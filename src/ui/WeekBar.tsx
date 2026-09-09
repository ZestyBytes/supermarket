import type { PlannedMeal, Recipe } from "../domain/types";
import { MealPhoto } from "./MealPhoto";
import { Icon } from "./Icon";

interface Props {
  plan: PlannedMeal[];
  recipes: Recipe[];
  servings: number;
  wanted: number;
  onServings: (n: number) => void;
  onWanted: (n: number) => void;
  onSurprise: () => void;
  onRemove: (key: string) => void;
}

export function WeekBar({ plan, recipes, servings, wanted, onServings, onWanted, onSurprise, onRemove }: Props) {
  return (
    <section className="fresh-week" aria-label="This week">
      <div className="fresh-controls">
        <label>
          <span className="sr">People</span>
          <select aria-label="People" value={servings} onChange={(event) => onServings(Number(event.target.value))}>
            {Array.from({ length: 12 }, (_, index) => (
              <option key={index} value={index + 1}>
                {index + 1} {index === 0 ? "person" : "people"}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="sr">Dinners this week</span>
          <select aria-label="Dinners this week" value={wanted} onChange={(event) => onWanted(Number(event.target.value))}>
            {Array.from({ length: 14 }, (_, index) => (
              <option key={index} value={index + 1}>
                {index + 1} dinners
              </option>
            ))}
          </select>
        </label>

        <button type="button" className="fresh-pick" onClick={onSurprise}>
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
