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
 * The week's meals, as a deck you swipe rather than a list you scan.
 *
 * Choosing dinners is browsing, not data entry: the card is mostly the meal,
 * and the ingredients are there when you ask for them. It scrolls horizontally
 * with snap points, so a thumb-flick works on a phone and a trackpad or the
 * arrow keys work everywhere else.
 */
export function MealDeck({ recipes, plan, ingredients, onAdd, onRemove }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const chosen = new Set(plan.map((meal) => meal.recipeId));
  const nameOf = (id: string) => ingredients.find((i) => i.id === id)?.name ?? id;

  return (
    <ul className="deck" aria-label="Meals to choose from">
      {recipes.map((recipe) => {
        const inWeek = chosen.has(recipe.id);
        const expanded = open === recipe.id;
        return (
          <li className={`meal-card${inWeek ? " meal-card--in" : ""}`} key={recipe.id}>
            <div className="meal-card__art" aria-hidden="true">
              <span>{recipe.emoji}</span>
            </div>

            <div className="meal-card__body">
              <h3 className="meal-card__name">{recipe.name}</h3>
              <p className="meal-card__meta">
                {recipe.minutes} min · serves {recipe.serves} · {recipe.ingredients.length} ingredients
              </p>
              <p className="meal-card__blurb">{recipe.blurb}</p>

              <button
                className="mini"
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : recipe.id)}
              >
                {expanded ? "Hide ingredients" : "What's in it?"}
              </button>

              {expanded && (
                <ul className="meal-card__what">
                  {recipe.ingredients.map((line) => (
                    <li key={line.ingredientId}>
                      {nameOf(line.ingredientId)}
                      {line.prep && <span className="meal-card__prep"> · {line.prep}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              className={inWeek ? "btn meal-card__act" : "btn btn--go meal-card__act"}
              type="button"
              onClick={() => (inWeek ? onRemove(recipe.id) : onAdd(recipe.id))}
            >
              {inWeek ? "Remove from week" : "Add to week"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
