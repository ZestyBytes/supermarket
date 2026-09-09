import { useMemo, useState } from "react";
import { consolidate } from "./domain/consolidate";
import { surpriseWeek } from "./domain/weekPlan";
import { INGREDIENTS } from "./data/ingredients";
import { RECIPES } from "./data/recipes";
import type { PlannedMeal } from "./domain/types";
import { usePersistentState } from "./ui/usePersistentState";
import { WeekBar } from "./ui/WeekBar";
import { MealDeck } from "./ui/MealDeck";
import { useStock } from "./ui/useStock";
import { useBasket } from "./ui/useBasket";
import { HaveList } from "./ui/HaveList";
import { Connection } from "./ui/Connection";
import { AddToBasket } from "./ui/AddToBasket";
import { Icon } from "./ui/Icon";

const CATALOGUE = { ingredients: INGREDIENTS, recipes: RECIPES };
const DEFAULT_PANTRY = INGREDIENTS.filter((i) => i.staple).map((i) => i.id);

type Tab = "meals" | "list";

export function App() {
  const [plan, setPlan] = usePersistentState<PlannedMeal[]>("supermarket.plan", []);
  const [pantryIds, setPantryIds] = usePersistentState<string[]>("supermarket.pantry", DEFAULT_PANTRY);
  const [servings, setServings] = usePersistentState<number>("supermarket.servings", 4);
  const [wanted, setWanted] = usePersistentState<number>("supermarket.wanted", 5);
  const [tab, setTab] = useState<Tab>("meals");

  const pantry = useMemo(() => new Set(pantryIds), [pantryIds]);
  const requirements = useMemo(() => consolidate(plan, CATALOGUE), [plan]);
  const toBuy = useMemo(() => requirements.filter((r) => !pantry.has(r.ingredient.id)), [requirements, pantry]);

  // Two background jobs, both started for you: what Tesco stocks at all, and
  // what it would sell you for this week in particular.
  const { stock } = useStock(RECIPES, INGREDIENTS);
  const basket = useBasket(toBuy);

  function addMeal(recipeId: string) {
    if (!RECIPES.some((r) => r.id === recipeId)) return;
    setPlan((current) => [...current, { key: `${recipeId}-${Date.now()}`, recipeId, servings }]);
  }

  function removeRecipe(recipeId: string) {
    setPlan((current) => current.filter((meal) => meal.recipeId !== recipeId));
  }

  function setServingsEverywhere(next: number) {
    setServings(next);
    setPlan((current) => current.map((meal) => ({ ...meal, servings: next })));
  }

  function surprise() {
    const already = new Set(plan.map((m) => m.recipeId));
    const short = wanted - plan.length;
    if (short <= 0) {
      setPlan(surpriseWeek(RECIPES, wanted, servings));
      return;
    }
    setPlan((current) => [
      ...current,
      ...surpriseWeek(RECIPES.filter((r) => !already.has(r.id)), short, servings),
    ]);
  }

  return (
    <div>
      <Connection state={basket} />

      {tab === "meals" && (
        <main className="sheet">
          <WeekBar
            plan={plan}
            recipes={RECIPES}
            servings={servings}
            wanted={wanted}
            onWanted={setWanted}
            onServings={setServingsEverywhere}
            onSurprise={surprise}
            onRemove={(key) => setPlan((current) => current.filter((meal) => meal.key !== key))}
          />

          <MealDeck
            recipes={RECIPES}
            plan={plan}
            ingredients={INGREDIENTS}
            onAdd={addMeal}
            onRemove={removeRecipe}
            stock={stock}
          />
        </main>
      )}

      {tab === "list" && (
        <main className="sheet">
          <HaveList
            requirements={requirements}
            pantry={pantry}
            statuses={basket.items}
            theirs={basket.theirs}
            onToggle={(id) =>
              setPantryIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]))
            }
          />
        </main>
      )}

      <div className="pad" />

      <AddToBasket state={basket} meals={plan.length} />

      <nav className="tabs" aria-label="Sections">
        <TabButton id="meals" now={tab} go={setTab} icon="meals" label="Meals" />
        <TabButton id="list" now={tab} go={setTab} icon="list" label="Shopping list" note={toBuy.length || undefined} />
      </nav>
    </div>
  );
}

function TabButton({
  id,
  now,
  go,
  icon,
  label,
  note,
}: {
  id: Tab;
  now: Tab;
  go: (tab: Tab) => void;
  icon: "meals" | "list";
  label: string;
  note?: number;
}) {
  return (
    <button className="tab" type="button" aria-current={now === id ? "page" : undefined} onClick={() => go(id)}>
      <span className="tab__icon" aria-hidden="true">
        <Icon name={icon} />
      </span>
      <span className="tab__label">{label}</span>
      {note != null && <span className="tab__note">{note}</span>}
    </button>
  );
}
