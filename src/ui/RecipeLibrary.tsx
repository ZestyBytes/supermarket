import { useMemo, useState } from "react";
import type { PlannedMeal, Recipe } from "../domain/types";

interface Props {
  recipes: Recipe[];
  plan: PlannedMeal[];
  onAdd: (recipeId: string) => void;
}

export function RecipeLibrary({ recipes, plan, onAdd }: Props) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);

  const tags = useMemo(
    () => [...new Set(recipes.flatMap((r) => r.tags))].sort(),
    [recipes],
  );

  const shown = recipes.filter((recipe) => {
    if (tag && !recipe.tags.includes(tag)) return false;
    if (!query) return true;
    const haystack = `${recipe.name} ${recipe.blurb} ${recipe.tags.join(" ")}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  const planned = new Set(plan.map((m) => m.recipeId));

  return (
    <section className="panel" aria-labelledby="recipes-head">
      <div className="panel__head">
        <h2 id="recipes-head">Recipes</h2>
        <div className="filters">
          <label className="sr" htmlFor="recipe-search">
            Search recipes
          </label>
          <input
            id="recipe-search"
            className="input"
            type="search"
            value={query}
            placeholder="chicken, quick, pasta…"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="chips">
        <button className="chip" type="button" aria-pressed={tag === null} onClick={() => setTag(null)}>
          Everything
        </button>
        {tags.map((t) => (
          <button
            className="chip"
            type="button"
            key={t}
            aria-pressed={tag === t}
            onClick={() => setTag(tag === t ? null : t)}
          >
            {t}
          </button>
        ))}
      </div>

      <ul className="recipes">
        {shown.map((recipe) => (
          <li className="recipe" key={recipe.id}>
            <div className="recipe__head">
              <h3 className="recipe__name">{recipe.name}</h3>
              {planned.has(recipe.id) && <span className="tag tag--in">In the week</span>}
            </div>
            <p className="recipe__blurb">{recipe.blurb}</p>
            <p className="recipe__meta">
              {recipe.minutes} min · serves {recipe.serves}
            </p>
            <button className="btn" type="button" onClick={() => onAdd(recipe.id)}>
              Add to the week
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="empty">No recipes match that.</li>}
      </ul>
    </section>
  );
}
