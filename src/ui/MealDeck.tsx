import { useState } from 'react';
import type { Ingredient, PlannedMeal, Recipe } from '../domain/types';
import { MealPhoto } from './MealPhoto';
import { Icon } from './Icon';
import { matchesMeal } from '../domain/mealSearch';
import { mealStock, type Stock } from '../domain/stock';
import { mealCost, type UnitPrices } from '../domain/mealCost';
import type { MealState } from '../domain/mealProgress';
import { money } from '../domain/units';

interface Props {
  recipes: Recipe[];
  plan: PlannedMeal[];
  ingredients: Ingredient[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  /** What Tesco has said so far, filled in while you browse. */
  stock: Stock;
  /** Tesco's rate per gram, ml or item, for pricing a dinner before you pick it. */
  prices: UnitPrices;
  /** How many people each dinner is cooked for. */
  servings: number;
  /** How far each chosen meal has got into the basket. */
  progress: (recipeId: string) => MealState;
}

/**
 * The dinners, as photographs.
 *
 * The order never changes as you pick. Sorting the chosen ones to the top
 * moved every other card under your thumb mid-tap, which is worse than having
 * to scroll: you lose your place in a grid you were reading.
 */
export function MealDeck({ recipes, plan, ingredients, onAdd, onRemove, stock, prices, servings, progress }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const chosen = new Set(plan.map((m) => m.recipeId));
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const filtered = recipes.filter((r) => matchesMeal(r, query, ingredients));

  return (
    <section id="choose-meals" className="fresh-library" aria-label="Choose dinners">
      <label className="fresh-search">
        <Icon name="search" />
        <input
          type="search"
          aria-label="Search meals"
          placeholder="Find a favourite"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      <ul className="fresh-grid" aria-label="Meals to choose from">
        {filtered.map((recipe) => {
          const selected = chosen.has(recipe.id);
          const have = mealStock(recipe, stock, ingredients);
          const short = have.state === 'short';
          const cost = mealCost(recipe, servings, prices, byId);
          const bought = selected ? progress(recipe.id) : 'none';

          return (
            <li className={`fresh-card${selected ? ' is-selected' : ''}${short ? ' is-short' : ''}`} key={recipe.id}>
              {/* The photograph is the card and the button. The name sits on
                  it behind frosted glass, so a picture of dinner is not cut
                  in half by a white strip. */}
              <button
                className="fresh-photo-button"
                aria-pressed={selected}
                aria-label={`${selected ? 'Remove' : 'Add'} ${recipe.name}`}
                onClick={() => (selected ? onRemove(recipe.id) : onAdd(recipe.id))}
              >
                <MealPhoto id={recipe.id} />
                {cost ? (
                  <span className="photo-time photo-time--cost">{money(cost.each)}pp</span>
                ) : (
                  <span className="photo-time">
                    <Icon name="clock" />
                    {recipe.minutes}
                  </span>
                )}
                {/* A tick the moment you tap only says the app heard you, which
                    was never in doubt. It waits until the shopping is actually
                    in the basket, and turns while it is not. */}
                <span
                  className={`photo-check${selected ? ' is-on' : ''}${bought === 'working' ? ' is-working' : ''}`}
                  title={
                    bought === 'working'
                      ? `Adding ${recipe.name} to your basket`
                      : bought === 'short'
                        ? `${recipe.name} is in, apart from what Tesco had none of`
                        : undefined
                  }
                >
                  {bought === 'working' ? (
                    <span className="spinner" aria-label="Going into your basket" />
                  ) : (
                    <Icon name={selected ? (bought === 'short' ? 'warning' : 'check') : 'plus'} />
                  )}
                </span>
                {short && (
                  <span className="photo-short" title={`Tesco has no ${have.missing.join(', ')}`}>
                    {have.missing.length} missing
                  </span>
                )}
                <span className="photo-name">{recipe.name}</span>
              </button>

              <button
                className="card-info"
                aria-expanded={open === recipe.id}
                aria-label={`What's in ${recipe.name}`}
                onClick={() => setOpen(open === recipe.id ? null : recipe.id)}
              >
                <Icon name={open === recipe.id ? 'up' : 'down'} />
              </button>

              {open === recipe.id && (
                <div className="fresh-details">
                  {short && (
                    <p className="fresh-missing">
                      Tesco has nothing for {have.missing.join(', ')}, but the rest can still be bought.
                    </p>
                  )}
                  <p className="fresh-facts">
                    <Icon name="clock" size={14} />
                    {recipe.minutes} minutes
                    {cost && ` · ${money(cost.total)} for ${servings}`}
                  </p>
                  <p>{recipe.blurb}</p>
                  <ul>
                    {recipe.ingredients.map((line) => (
                      <li key={line.ingredientId}>
                        {ingredients.find((i) => i.id === line.ingredientId)?.name}
                        {line.prep && ` · ${line.prep}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {!filtered.length && <p className="fresh-no-results">No meals match “{query}”. Try another name.</p>}
    </section>
  );
}
