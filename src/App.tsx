import { useMemo, useState } from "react";
import { consolidate } from "./domain/consolidate";
import { matchToProducts } from "./domain/match";
import { applyPlan, outstanding, totals, type BasketLine } from "./domain/basket";
import { asCsv, asText } from "./domain/handoff";
import { money } from "./domain/units";
import { INGREDIENTS } from "./data/ingredients";
import { PRODUCTS } from "./data/products";
import { RECIPES, SLOTS } from "./data/recipes";
import type { PlannedMeal } from "./domain/types";
import { usePersistentState } from "./ui/usePersistentState";
import { Planner } from "./ui/Planner";
import { RecipeLibrary } from "./ui/RecipeLibrary";
import { ShoppingList } from "./ui/ShoppingList";
import { Basket } from "./ui/Basket";
import { Aisles } from "./ui/Aisles";
import { LivePanel } from "./ui/LivePanel";

const CATALOGUE = { ingredients: INGREDIENTS, recipes: RECIPES };
const DEFAULT_PANTRY = INGREDIENTS.filter((i) => i.staple).map((i) => i.id);

/** The five dinners from the brief, so the app opens on a real week. */
const STARTER_PLAN: PlannedMeal[] = [
  { key: "m1", recipeId: "bolognese", servings: 4 },
  { key: "m2", recipeId: "fajitas", servings: 4 },
  { key: "m3", recipeId: "cottage-pie", servings: 4 },
  { key: "m4", recipeId: "chicken-curry", servings: 4 },
  { key: "m5", recipeId: "salmon-potatoes", servings: 4 },
];

export function App() {
  const [plan, setPlan] = usePersistentState<PlannedMeal[]>("supermarket.plan", STARTER_PLAN);
  const [pantryIds, setPantryIds] = usePersistentState<string[]>("supermarket.pantry", DEFAULT_PANTRY);
  const [prefer, setPrefer] = usePersistentState<Record<string, string>>("supermarket.prefer", {});
  const [basket, setBasket] = usePersistentState<BasketLine[]>("supermarket.basket", []);
  const [slotId, setSlotId] = usePersistentState<string>("supermarket.slot", "slot-3");
  const [view, setView] = useState<"plan" | "aisles">("plan");
  const [flash, setFlash] = useState("");

  const pantry = useMemo(() => new Set(pantryIds), [pantryIds]);
  const requirements = useMemo(() => consolidate(plan, CATALOGUE), [plan]);
  const match = useMemo(
    () => matchToProducts(requirements, PRODUCTS, { pantry, prefer }),
    [requirements, pantry, prefer],
  );
  const gaps = useMemo(() => outstanding(basket, match.lines), [basket, match.lines]);
  const slot = SLOTS.find((s) => s.id === slotId) ?? SLOTS[0];
  const sums = useMemo(() => totals(basket, slot.fee), [basket, slot]);

  const outstandingCost = match.lines.reduce(
    (sum, line) => sum + (gaps.get(line.product.id) ?? 0) * line.product.price,
    0,
  );

  function addMeal(recipeId: string) {
    const recipe = RECIPES.find((r) => r.id === recipeId);
    if (!recipe) return;
    setPlan((current) => [
      ...current,
      { key: `${recipeId}-${Date.now()}`, recipeId, servings: recipe.serves },
    ]);
    setFlash(`${recipe.name} added to the week.`);
  }

  function addPlanToBasket(productId?: string) {
    const lines = productId ? match.lines.filter((l) => l.product.id === productId) : match.lines;
    const added = lines.reduce((sum, l) => sum + (gaps.get(l.product.id) ?? 0), 0);
    setBasket((current) => applyPlan(current, lines));
    setFlash(
      added > 0
        ? `${added} item${added === 1 ? "" : "s"} added to the basket.`
        : "The basket already covers the plan.",
    );
  }

  function setQty(productId: string, qty: number) {
    setBasket((current) => {
      if (qty <= 0) return current.filter((l) => l.product.id !== productId);
      const existing = current.find((l) => l.product.id === productId);
      if (existing) return current.map((l) => (l.product.id === productId ? { ...l, qty } : l));
      const product = PRODUCTS.find((p) => p.id === productId);
      return product ? [...current, { product, qty, source: "manual" as const }] : current;
    });
  }

  async function copyList() {
    try {
      await navigator.clipboard.writeText(asText(basket));
      setFlash("Shopping list copied — paste it into your supermarket app.");
    } catch {
      setFlash("Your browser blocked the clipboard. Use Download CSV instead.");
    }
  }

  function downloadCsv() {
    const blob = new Blob([asCsv(basket)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "supermarket-basket.csv";
    link.click();
    URL.revokeObjectURL(url);
    setFlash("CSV downloaded.");
  }

  return (
    <>
      <header className="masthead">
        <div className="masthead__in">
          <div className="brand">
            <span className="brand__mark">
              Super<span>market</span>
            </span>
            <span className="brand__strap">Meals in, one basket out</span>
          </div>
          <div className="seg" role="group" aria-label="View">
            <button type="button" aria-pressed={view === "plan"} onClick={() => setView("plan")}>
              This week
            </button>
            <button type="button" aria-pressed={view === "aisles"} onClick={() => setView("aisles")}>
              Sample catalogue
            </button>
          </div>
          {view === 'aisles' && <div className="masthead__basket">
            <span className="label">Basket</span>
            <strong>
              {sums.items} · {money(sums.total)}
            </strong>
          </div>}
        </div>
      </header>

      <main className="layout">
        <div className="col">
          {view === "plan" ? (
            <>
              <div className="strip">
                <div>
                  <h1>Five dinners, one shop</h1>
                  <p>
                    Pick the meals. Every ingredient is scaled to the servings you are cooking,
                    added up across the week, matched to a real pack size and rounded up — so
                    onions wanted by four recipes arrive as one bag, not four lines.
                  </p>
                </div>
                <p className="strip__note">
                  {plan.length} meals planned
                  <br />
                  {requirements.length} ingredients · {match.lines.length} products
                </p>
              </div>

              <Planner
                plan={plan}
                recipes={RECIPES}
                onServings={(key, servings) =>
                  setPlan((current) => current.map((m) => (m.key === key ? { ...m, servings } : m)))
                }
                onRemove={(key) => setPlan((current) => current.filter((m) => m.key !== key))}
                onClear={() => setPlan([])}
              />

              <ShoppingList
                match={match}
                gaps={gaps}
                outstandingCost={outstandingCost}
                onTogglePantry={(id) =>
                  setPantryIds((current) =>
                    current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
                  )
                }
                onPrefer={(ingredientId, productId) =>
                  setPrefer((current) => ({ ...current, [ingredientId]: productId }))
                }
                onAddAll={() => addPlanToBasket()}
                onAddOne={(productId) => addPlanToBasket(productId)}
              />

              <LivePanel key={JSON.stringify([requirements, pantryIds])} requirements={requirements.filter(r => !pantry.has(r.ingredient.id))} />

              <RecipeLibrary recipes={RECIPES} plan={plan} onAdd={addMeal} />
            </>
          ) : (
            <Aisles products={PRODUCTS} ingredients={INGREDIENTS} basket={basket} onQty={setQty} />
          )}
        </div>

        {view === 'aisles' ? <Basket
          lines={basket}
          sums={sums}
          slots={SLOTS}
          slotId={slot.id}
          onSlot={setSlotId}
          onQty={setQty}
          onEmpty={() => setBasket([])}
          onCopy={copyList}
          onCsv={downloadCsv}
        /> : <aside className="pane"><section className="card"><div className="card__body"><h2>Your Tesco shop</h2><p>1. Choose meals and servings.</p><p>2. Exclude ingredients you already have.</p><p>3. Find and review live Tesco products.</p><p>4. Add to Tesco and check out there.</p><a href="#live-head">Review Tesco products ↓</a><p>Delivery and checkout stay on Tesco.</p></div></section></aside>}
      </main>

      <p className="live" role="status" aria-live="polite">
        {flash}
      </p>
    </>
  );
}
