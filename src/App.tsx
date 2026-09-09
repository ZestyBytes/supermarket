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
import { HaveList } from "./ui/HaveList";
import { LivePanel } from "./ui/LivePanel";
import { Icon } from "./ui/Icon";

const CATALOGUE = { ingredients: INGREDIENTS, recipes: RECIPES };
const DEFAULT_PANTRY = INGREDIENTS.filter((i) => i.staple).map((i) => i.id);

type Tab = "meals" | "list" | "shop";

export function App() {
  const [plan, setPlan] = usePersistentState<PlannedMeal[]>("supermarket.plan", []);
  const [pantryIds, setPantryIds] = usePersistentState<string[]>("supermarket.pantry", DEFAULT_PANTRY);
  const [servings, setServings] = usePersistentState<number>("supermarket.servings", 4);
  const [wanted, setWanted] = usePersistentState<number>("supermarket.wanted", 5);
  const [tab, setTab] = useState<Tab>("meals");

  // Asked in the background while you browse, so choosing a dinner and knowing
  // whether it can be bought are the same moment.
  const { stock } = useStock(RECIPES, INGREDIENTS);

  const pantry = useMemo(() => new Set(pantryIds), [pantryIds]);
  const requirements = useMemo(() => consolidate(plan, CATALOGUE), [plan]);
  const toBuy = useMemo(() => requirements.filter((r) => !pantry.has(r.ingredient.id)), [requirements, pantry]);

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
    const extra = surpriseWeek(
      RECIPES.filter((r) => !already.has(r.id)),
      short,
      servings,
    );
    setPlan((current) => [...current, ...extra]);
  }

  return (
    <div>
      {tab === "meals" && (
        <>
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

            <div className="act">
              <button className="go" type="button" disabled={plan.length === 0} onClick={() => setTab("list")}>
                See shopping list
                {toBuy.length > 0 && <span className="go__note">{toBuy.length} items</span>}
              </button>
            </div>
          </main>
        </>
      )}

      {tab === "list" && (
        <>
          <main className="sheet">
            <HaveList
              requirements={requirements}
              pantry={pantry}
              onToggle={(id) =>
                setPantryIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]))
              }
            />

            <div className="act">
              <button className="go" type="button" disabled={toBuy.length === 0} onClick={() => setTab("shop")}>
                Find these at Tesco
              </button>
            </div>
          </main>
        </>
      )}

      {tab === "shop" && (
        <LivePanel
          key={JSON.stringify([toBuy.map((r) => r.ingredient.id), toBuy.map((r) => r.qty)])}
          requirements={toBuy}
        />
      )}

      <div className="pad" />

      {tab !== "shop" && (
        <div className="fresh-next">
          <button
            type="button"
            disabled={plan.length === 0}
            onClick={() => setTab(tab === "meals" ? "list" : "shop")}
          >
            <span>
              <strong>{tab === "meals" ? "Review ingredients" : "Review Tesco products"}</strong>
              <small>{tab === "meals" ? `${plan.length} dinners selected` : `${toBuy.length} ingredients to buy`}</small>
            </span>
            <Icon name="arrow" />
          </button>
        </div>
      )}

      <nav className="tabs" aria-label="Sections">
        <TabButton id="meals" now={tab} go={setTab} icon="meals" label="Meals" />
        <TabButton id="list" now={tab} go={setTab} icon="list" label="Ingredients" />
        <TabButton id="shop" now={tab} go={setTab} icon="shop" label="Tesco" />
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
  children,
}: {
  id: Tab;
  now: Tab;
  go: (tab: Tab) => void;
  icon: "meals" | "list" | "shop";
  label: string;
  note?: number;
  children?: React.ReactNode;
}) {
  return (
    <button className="tab" type="button" aria-current={now === id ? "page" : undefined} onClick={() => go(id)}>
      {children ?? (
        <span className="tab__icon" aria-hidden="true">
          <Icon name={icon} />
        </span>
      )}
      <span className="tab__label">{label}</span>
      {note != null && <span className="tab__note">{note}</span>}
    </button>
  );
}

