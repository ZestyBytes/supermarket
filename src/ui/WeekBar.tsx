import type { PlannedMeal, Recipe } from '../domain/types';
import { MealPhoto } from './MealPhoto';
import { Icon } from './Icon';

interface Props {
  plan: PlannedMeal[];
  recipes: Recipe[];
  servings: number;
  wanted: number;
  onServings: (n: number) => void;
  onWanted: (n: number) => void;
  onSurprise: () => void;
  onClear: () => void;
  onRemove: (key: string) => void;
}

export function WeekBar({ plan, recipes, servings, wanted, onServings, onWanted, onSurprise, onClear, onRemove }: Props) {
  return (
    <section className="fresh-week" aria-label="This week">
      <div className="fresh-heading"><h1>What’s for dinner?</h1><p>Your week, sorted.</p></div>
      <div className="fresh-controls">
        <label><span className="sr">People</span><select aria-label="People" value={servings} onChange={e => onServings(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{i + 1} {i === 0 ? 'person' : 'people'}</option>)}</select></label>
        <label><span className="sr">Dinners this week</span><select aria-label="Dinners this week" value={wanted} onChange={e => onWanted(Number(e.target.value))}>{Array.from({ length: 14 }, (_, i) => <option key={i} value={i + 1}>{i + 1} dinners</option>)}</select></label>
        <button className="fresh-pick" onClick={onSurprise}>Pick for me</button>
      </div>
      <div className="fresh-selection">
        <div className="fresh-thumbs">
          {plan.map(meal => (
            <button key={meal.key} className="selected-meal" aria-label={`Remove ${recipes.find(r => r.id === meal.recipeId)?.name || 'meal'}`} onClick={() => onRemove(meal.key)}>
              <MealPhoto id={meal.recipeId} />
              <span><Icon name="check" /></span>
            </button>
          ))}
          {Array.from({ length: Math.min(5, Math.max(0, wanted - plan.length)) }, (_, i) => (
            <a href="#choose-meals" className="empty-meal" key={i} aria-label="Choose another dinner"><Icon name="plus" /></a>
          ))}
        </div>
        <p aria-live="polite"><strong>{plan.length} of {wanted}</strong><span>dinners picked</span></p>
      </div>
      {plan.length > 0 && <button className="fresh-clear" onClick={onClear}>Clear selection</button>}
    </section>
  );
}
}
