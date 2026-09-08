import type { PlannedMeal, Recipe } from "./types";

/**
 * Fill a week with meals, without repeating and without sameness.
 *
 * Picking at random gives you beef three nights running often enough to feel
 * broken. Spreading across each recipe's first tag keeps a week varied, which
 * is the whole reason for asking a machine to choose rather than choosing
 * yourself.
 */
export function surpriseWeek(recipes: Recipe[], count: number, servings: number, random = Math.random): PlannedMeal[] {
  const byKind = new Map<string, Recipe[]>();
  for (const recipe of shuffle(recipes, random)) {
    const kind = recipe.tags[0] ?? "other";
    byKind.set(kind, [...(byKind.get(kind) ?? []), recipe]);
  }

  const kinds = shuffle([...byKind.keys()], random);
  const picked: Recipe[] = [];

  // One from each kind before a second from any, so five dinners are five
  // different sorts of dinner while there are enough kinds to manage it.
  while (picked.length < count) {
    let took = false;
    for (const kind of kinds) {
      if (picked.length >= count) break;
      const next = byKind.get(kind)?.shift();
      if (next) {
        picked.push(next);
        took = true;
      }
    }
    if (!took) break;
  }

  return picked.map((recipe, index) => ({
    key: `${recipe.id}-${index}-${Date.now()}`,
    recipeId: recipe.id,
    servings,
  }));
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
