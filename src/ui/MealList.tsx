import { useState } from "react";
import type { Ingredient, PlannedMeal, Recipe } from "../domain/types";

interface Props {
  recipes: Recipe[];
  plan: PlannedMeal[];
  ingredients: Ingredient[];
  onAdd: (recipeId: string) => void;
  onRemove: (recipeId: string) => void;
}

/**
 * Every meal as one tappable row.
 *
 * Adding and removing is the thing done most, so it is a single tap on a
 * full-width row with no travel and nothing to swipe past. What is in a meal
 * is asked for occasionally, so it opens underneath rather than taking up
 * room on every row.
 */
export function MealList({ recipes, plan, ingredients, onAdd, onRemove }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const chosen = new Set(plan.map((meal) => meal.recipeId));
  const nameOf = (id: string) => ingredients.find((i) => i.id === id)?.name ?? id;

  return (
    <ul className="meals" aria-label="Meals">
      {recipes.map((recipe) => {
        const inWeek = chosen.has(recipe.id);
        const expanded = open === recipe.id;
        return (
          <li className={`meal${inWeek ? " meal--in" : ""}`} key={recipe.id}>
            <div className="meal__row">
              <button
                className="meal__pick"
                type="button"
                aria-pressed={inWeek}
                onClick={() => (inWeek ? onRemove(recipe.id) : onAdd(recipe.id))}
              >
                <span className="meal__tick" aria-hidden="true">
                  {inWeek ? "✓" : "+"}
                </span>
                <span className="meal__text">
                  <span className="meal__name">{recipe.name}</span>
                  <span className="meal__meta">
                    {recipe.minutes} min · {recipe.ingredients.length} ingredients
                  </span>
                </span>
              </button>

              <button
                className="meal__open"
                type="button"
                aria-expanded={expanded}
                aria-label={`What's in ${recipe.name}`}
                onClick={() => setOpen(expanded ? null : recipe.id)}
              >
                {expanded ? "▲" : "▼"}
              </button>
            </div>

            {expanded && (
              <div className="meal__detail">
                <p className="meal__blurb">{recipe.blurb}</p>
                <ul className="meal__what">
                  {recipe.ingredients.map((line) => (
                    <li key={line.ingredientId}>
                      {nameOf(line.ingredientId)}
                      {line.prep && <span className="meal__prep"> · {line.prep}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
