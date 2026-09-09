import { useCallback, useMemo, useState } from "react";
import { consolidate } from "./domain/consolidate";
import { surpriseWeek } from "./domain/weekPlan";
import { INGREDIENTS } from "./data/ingredients";
import { RECIPES } from "./data/recipes";
import type { PlannedMeal } from "./domain/types";
import { usePersistentState } from "./ui/usePersistentState";
import { WeekBar } from "./ui/WeekBar";
import { MealDeck } from "./ui/MealDeck";
import { useBasket } from "./ui/useBasket";
import { useStock } from "./ui/useStock";
import { mealProgress } from "./domain/mealProgress";
import { HaveList } from "./ui/HaveList";
import { Connection } from "./ui/Connection";
import { AddToBasket } from "./ui/AddToBasket";
import { Settings } from "./ui/Settings";
import { Gate } from "./ui/Gate";
import { Icon } from "./ui/Icon";

const CATALOGUE = { ingredients: INGREDIENTS, recipes: RECIPES };
const DEFAULT_PANTRY = INGREDIENTS.filter((i) => i.staple).map((i) => i.id);

type Tab = "meals" | "list" | "settings";

export function App() {
  const [plan, setPlan] = usePersistentState<PlannedMeal[]>("supermarket.plan", []);
  const [pantryIds, setPantryIds] = usePersistentState<string[]>("supermarket.pantry", DEFAULT_PANTRY);
  const [servings, setServings] = usePersistentState<number>("supermarket.servings", 4);
  const [wanted, setWanted] = usePersistentState<number>("supermarket.wanted", 5);
  const [tab, setTab] = useState<Tab>("meals");
  const [ignoreGate, setIgnoreGate] = useState(false);

  const pantry = useMemo(() => new Set(pantryIds), [pantryIds]);
  const requirements = useMemo(() => consolidate(plan, CATALOGUE), [plan]);
  const toBuy = useMemo(() => requirements.filter((r) => !pantry.has(r.ingredient.id)), [requirements, pantry]);

  // Two background jobs, both started for you: what Tesco stocks at all, and
  // what it would sell you for this week in particular.
  const basket = useBasket(toBuy);
  const { stock: shelf, prices } = useStock(RECIPES, INGREDIENTS);

  // Only while a send is actually in flight. Without that, a meal you picked
  // would turn for as long as you left it unsent, which says work is happening
  // when the app is waiting for you.
  const progress = useCallback(
    (recipeId: string) => {
      const state = mealProgress(recipeId, toBuy, (id) => basket.items.find((item) => item.ingredientId === id)?.state);
      return state === "working" && !basket.syncing ? "none" : state;
    },
    [toBuy, basket.items, basket.syncing],
  );

  // The catalogue sweep says what every dinner would cost and whether it can be
  // shopped, which is what you want while choosing. The week's own match is
  // the better answer for what is in it, so it wins where the two overlap.
  const stock = useMemo(() => {
    const merged = new Map(shelf);
    for (const item of basket.items) if (item.product) merged.set(item.ingredientId, 'yes');
    return merged;
  }, [shelf, basket.items]);

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

  // Only a failure earns the whole screen. See Gate for why not the check.
  const broken = basket.phase === "offline" || basket.phase === "disconnected";
  if (!broken && ignoreGate) setIgnoreGate(false);
  if (broken && !ignoreGate) return <Gate state={basket} onIgnore={() => setIgnoreGate(true)} />;

  return (
    <div className="app-shell">
      <header className="app-header"><span className="wordmark">Supermarket<span>.</span></span><Connection state={basket} onOpenSettings={() => setTab("settings")} /></header>
      <fieldset className="workspace" disabled={basket.phase==='adding'}>

      {tab === "meals" && (
        <main className="sheet">
          <WeekBar
            plan={plan}
            recipes={RECIPES}
            wanted={wanted}
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
            prices={prices}
            servings={servings}
            progress={progress}
          />
        </main>
      )}

      {tab === "list" && (
        <main className="sheet">
          <h1 className="page-title">Shopping list</h1>
          <HaveList
            requirements={requirements}
            pantry={pantry}
            statuses={basket.items}
            theirs={basket.theirs}
            onSwap={basket.swap}
            leaving={basket.leaving}
            syncing={basket.syncing}
            onToggle={(id) =>
              setPantryIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]))
            }
          />
        </main>
      )}

      {tab === "settings" && (
        <main className="sheet">
          <h1 className="page-title">Settings</h1>
          <Settings
            state={basket}
            servings={servings}
            wanted={wanted}
            onServings={setServingsEverywhere}
            onWanted={setWanted}
          />
        </main>
      )}

      </fieldset>
      <div className="pad" />

      {tab === "list" && <AddToBasket state={basket} />}

      <nav className="tabs" aria-label="Sections">
        <TabButton id="meals" now={tab} go={setTab} icon="meals" label="Meals" />
        <TabButton id="list" now={tab} go={setTab} icon="list" label="Shopping list" note={toBuy.length || undefined} />
        <TabButton id="settings" now={tab} go={setTab} icon="settings" label="Settings" alert={broken} />
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
  alert,
}: {
  id: Tab;
  now: Tab;
  go: (tab: Tab) => void;
  icon: "meals" | "list" | "settings";
  label: string;
  note?: number;
  alert?: boolean;
}) {
  return (
    <button className="tab" type="button" aria-current={now === id ? "page" : undefined} onClick={() => go(id)}>
      <span className="tab__icon" aria-hidden="true">
        <Icon name={icon} />
      </span>
      <span className="tab__label">{label}</span>
      {note != null && <span className="tab__note">{note}</span>}
      {alert && <span className="tab__alert" aria-label="Needs attention" />}
    </button>
  );
}
