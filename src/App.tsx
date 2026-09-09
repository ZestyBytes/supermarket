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

      <main className="sheet">
        {tab === 'list' && <div className="fresh-heading"><h1>Here’s what you’ll need.</h1><p>A single list for all your dinners.</p></div>}
        {tab === 'shop' && <div className="fresh-heading"><h1>Your Tesco shop.</h1><p>Review your products before adding them.</p></div>}
        {tab === "meals" && (
          <>
            <WeekBar
              plan={plan}
              recipes={RECIPES}
              servings={servings}

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

      {tab !== 'shop' && <div className="fresh-next"><button disabled={plan.length===0} onClick={()=>setTab(tab==='meals'?'list':'shop')}><span><strong>{tab==='meals'?'Review ingredients':'Review Tesco products'}</strong><small>{tab==='meals'?`${plan.length} dinners selected`:`${toBuy.length} ingredients to buy`}</small></span><Icon name="arrow"/></button></div>}
      <nav className="tabs" aria-label="Sections">
        <Tab id="meals" now={tab} go={setTab} icon="meals" label="Meals" />
        <Tab id="list" now={tab} go={setTab} icon="list" label="Ingredients" />
        <Tab id="shop" now={tab} go={setTab} icon="shop" label="Tesco" />
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
      {children ?? <span className="tab__icon" aria-hidden="true"><Icon name={icon} /></span>}
      <span className="tab__label">{label}</span>
      {note != null && <span className="tab__note">{note}</span>}
      {note != null && <span className="tab__note">{note}</span>}
    </button>
  );
}
