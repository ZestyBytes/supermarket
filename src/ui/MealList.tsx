import { useState } from "react";
import type { Ingredient, PlannedMeal, Recipe } from "../domain/types";
import { Icon } from "./Icon";

interface Props {
  recipes: Recipe[];
  plan: PlannedMeal[];
  ingredients: Ingredient[];
  onAdd: (recipeId: string) => void;
  onRemove: (recipeId: string) => void;
}

/** How many ingredients to show before "+n more" — enough to judge a meal by. */
const SHOWN = 6;

/**
 * The dinners, one tappable row each.
 *
 * Adding and removing is what happens most, so the whole row does it, and the
 * mark on the left says which way it will go. What is in a meal is asked for
 * occasionally, so it opens underneath rather than taking room on every row.
 */
export function MealList({ recipes, plan, ingredients, onAdd, onRemove }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const chosen = new Set(plan.map((meal) => meal.recipeId));
  const nameOf = (id: string) => ingredients.find((i) => i.id === id)?.name ?? id;

  return (
    <ul className="meals" aria-label="Dinners">
      {recipes.map((recipe) => {
        const inWeek = chosen.has(recipe.id);
        const expanded = open === recipe.id;
        const rest = recipe.ingredients.length - SHOWN;

        return (
          <li className={`meal${inWeek ? " meal--in" : ""}`} key={recipe.id}>
            <div className="meal__row">
              <button
                className="meal__pick"
                type="button"
                aria-pressed={inWeek}
                onClick={() => (inWeek ? onRemove(recipe.id) : onAdd(recipe.id))}
              >
                <span className="meal__mark">{inWeek ? <Icon.check size={20} /> : <Icon.plus size={20} />}</span>
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
                {expanded ? <Icon.up size={20} /> : <Icon.down size={20} />}
              </button>
            </div>

            {expanded && (
              <div className="meal__detail">
                <p className="meal__blurb">{recipe.blurb}</p>
                <ul className="chips">
                  {recipe.ingredients.slice(0, SHOWN).map((line) => (
                    <li className="chip" key={line.ingredientId}>
                      {nameOf(line.ingredientId)}
                    </li>
                  ))}
                  {rest > 0 && <li className="chip">+{rest} more</li>}
                </ul>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
