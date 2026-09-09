import { useMemo, useState } from "react";
import { consolidate } from "./domain/consolidate";
import { surpriseWeek } from "./domain/weekPlan";
import { INGREDIENTS } from "./data/ingredients";
import { RECIPES } from "./data/recipes";
import type { PlannedMeal } from "./domain/types";
import { usePersistentState } from "./ui/usePersistentState";
import { MealDeck } from "./ui/MealDeck";
import { WeekBar } from "./ui/WeekBar";
import { HaveList } from "./ui/HaveList";
import { LivePanel } from "./ui/LivePanel";
import { Icon } from './ui/Icon';

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
    const recipe = RECIPES.find((r) => r.id === recipeId);
    if (!recipe) return;
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

  return (
    <>
      <header className="masthead">
        <div className="masthead__in">
          <span className="brand__mark">
            Super<span>market</span>
          </span>
          <span className="masthead__week">
            {plan.length > 0 ? `${plan.length} meals · ${toBuy.length} to buy` : "Nothing planned yet"}
          </span>
        </div>
      </header>

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
              onServings={setServingsEverywhere}
              onWanted={setWanted}
              onSurprise={() => setPlan(surpriseWeek(RECIPES, wanted, servings))}
              onClear={() => setPlan([])}
              onRemove={(key) => setPlan((current) => current.filter((m) => m.key !== key))}
            />
            <MealDeck
              recipes={RECIPES}
              plan={plan}
              ingredients={INGREDIENTS}
              onAdd={addMeal}
              onRemove={removeRecipe}
            />
          </>
        )}

        {tab === "list" && (
          <HaveList
            requirements={requirements}
            pantry={pantry}
            onToggle={(id) =>
              setPantryIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]))
            }
          />
        )}

        {tab === "shop" && (
          <LivePanel key={JSON.stringify([toBuy.map((r) => r.ingredient.id), toBuy.map((r) => r.qty)])} requirements={toBuy} />
        )}
      </main>

      {tab !== 'shop' && <div className="fresh-next"><button disabled={plan.length===0} onClick={()=>setTab(tab==='meals'?'list':'shop')}><span><strong>{tab==='meals'?'Review ingredients':'Review Tesco products'}</strong><small>{tab==='meals'?`${plan.length} dinners selected`:`${toBuy.length} ingredients to buy`}</small></span><Icon name="arrow"/></button></div>}
      <nav className="tabs" aria-label="Sections">
        <Tab id="meals" now={tab} go={setTab} icon="meals" label="Meals" />
        <Tab id="list" now={tab} go={setTab} icon="list" label="Ingredients" />
        <Tab id="shop" now={tab} go={setTab} icon="shop" label="Tesco" />
      </nav>
    </>
  );
}

function Tab({
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
  icon: string;
  label: string;
  note?: number;
}) {
  return (
    <button className="tab" type="button" aria-current={now === id ? "page" : undefined} onClick={() => go(id)}>
      <span className="tab__icon" aria-hidden="true">
        <Icon name={icon}/>
      </span>
      <span className="tab__label">{label}</span>
      {note != null && <span className="tab__note">{note}</span>}
    </button>
  );
}
