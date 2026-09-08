import { useMemo, useState } from "react";
import { consolidate } from "./domain/consolidate";
import { surpriseWeek } from "./domain/weekPlan";
import { INGREDIENTS } from "./data/ingredients";
import { RECIPES } from "./data/recipes";
import type { PlannedMeal } from "./domain/types";
import { usePersistentState } from "./ui/usePersistentState";
import { MealList } from "./ui/MealList";
import { WeekCard } from "./ui/WeekCard";
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

  // Changing who you are cooking for re-scales the week you already picked,
  // rather than being a number that only applies to the next thing you add.
  function setServingsEverywhere(next: number) {
    setServings(next);
    setPlan((current) => current.map((meal) => ({ ...meal, servings: next })));
  }

  // Filling the week tops up what you have rather than replacing your choices.
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
    <div className="app">
      {tab === "meals" && (
        <>
          <header className="top">
            <h1 className="top__title">This week</h1>
          </header>

          <main className="sheet">
            <WeekCard
              chosen={plan.length}
              wanted={wanted}
              servings={servings}
              onWanted={setWanted}
              onServings={setServingsEverywhere}
              onSurprise={surprise}
              onClear={() => setPlan([])}
            />

            <MealList
              recipes={RECIPES}
              plan={plan}
              ingredients={INGREDIENTS}
              onAdd={addMeal}
              onRemove={removeRecipe}
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
          <header className="top">
            <div>
              <h1 className="top__title">Shopping list</h1>
              <p className="top__sub">
                {plan.length > 0 ? `From ${plan.length} dinners, added up` : "Nothing planned yet"}
              </p>
            </div>
            <div className="top__count">
              <div className="top__countnum">{toBuy.length}</div>
              <div className="label">to buy</div>
            </div>
          </header>

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

      <nav className="tabs" aria-label="Sections">
        <TabButton id="meals" now={tab} go={setTab} label="Meals" note={plan.length || undefined}>
          <Icon.meals size={23} />
        </TabButton>
        <TabButton id="list" now={tab} go={setTab} label="List" note={toBuy.length || undefined}>
          <Icon.list size={23} />
        </TabButton>
        <TabButton id="shop" now={tab} go={setTab} label="Tesco">
          <Icon.basket size={23} />
        </TabButton>
      </nav>
    </div>
  );
}

function TabButton({
  id,
  now,
  go,
  label,
  note,
  children,
}: {
  id: Tab;
  now: Tab;
  go: (tab: Tab) => void;
  label: string;
  note?: number;
  children: React.ReactNode;
}) {
  return (
    <button className="tab" type="button" aria-current={now === id ? "page" : undefined} onClick={() => go(id)}>
      {children}
      <span>{label}</span>
      {note != null && <span className="tab__note">{note}</span>}
    </button>
  );
}
