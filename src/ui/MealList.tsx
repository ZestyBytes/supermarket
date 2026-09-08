import { useMemo, useState } from "react";
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
 * The dinners, one tappable row each, with the chosen ones at the top.
 *
 * "What have I picked?" was a question you could only answer by scrolling the
 * whole list looking for ticks. Floating the chosen meals up answers it before
 * you touch anything, and without repeating them in a second list that then
 * has to be kept in step.
 */
export function MealList({ recipes, plan, ingredients, onAdd, onRemove }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const chosen = useMemo(() => new Set(plan.map((meal) => meal.recipeId)), [plan]);
  const nameOf = (id: string) => ingredients.find((i) => i.id === id)?.name ?? id;

  const matching = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return recipes;
    // Search what someone would actually type: the dish, or the thing they
    // fancy tonight — "chicken", "pasta", "quick".
    return recipes.filter((recipe) => {
      const ingredientNames = recipe.ingredients.map((line) => nameOf(line.ingredientId).toLowerCase());
      return (
        recipe.name.toLowerCase().includes(needle) ||
        recipe.tags.some((tag) => tag.includes(needle)) ||
        ingredientNames.some((name) => name.includes(needle))
      );
    });
  }, [recipes, query, ingredients]);

  // Chosen first, in the order they were added; everything else after.
  const ordered = useMemo(() => {
    const order = new Map(plan.map((meal, index) => [meal.recipeId, index]));
    return [...matching].sort((a, b) => {
      const inA = order.has(a.id);
      const inB = order.has(b.id);
      if (inA && inB) return order.get(a.id)! - order.get(b.id)!;
      if (inA !== inB) return inA ? -1 : 1;
      return 0;
    });
  }, [matching, plan]);

  const firstUnchosen = ordered.findIndex((recipe) => !chosen.has(recipe.id));

  return (
    <>
      <div className="search">
        <Icon.search size={18} />
        <input
          type="search"
          value={query}
          placeholder="Search dinners, ingredients, quick…"
          aria-label="Search dinners"
          onChange={(event) => setQuery(event.target.value)}
        />
        {query && (
          <button type="button" aria-label="Clear search" onClick={() => setQuery("")}>
            <Icon.cross size={16} />
          </button>
        )}
      </div>

      {ordered.length === 0 && <p className="empty">Nothing matches “{query}”.</p>}

      <ul className="meals" aria-label="Dinners">
        {ordered.map((recipe, index) => {
          const inWeek = chosen.has(recipe.id);
          const expanded = open === recipe.id;
          const rest = recipe.ingredients.length - SHOWN;

          return (
            <li key={recipe.id}>
              {index === firstUnchosen && firstUnchosen > 0 && (
                <p className="label mealsplit">More dinners</p>
              )}

              <div className={`meal${inWeek ? " meal--in" : ""}`}>
                <div className="meal__row">
                  <button
                    className="meal__pick"
                    type="button"
                    aria-pressed={inWeek}
                    onClick={() => (inWeek ? onRemove(recipe.id) : onAdd(recipe.id))}
                  >
                    <span className="meal__mark">
                      {inWeek ? <Icon.check size={20} /> : <Icon.plus size={20} />}
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
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
