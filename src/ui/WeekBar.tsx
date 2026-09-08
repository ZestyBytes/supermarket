import type { PlannedMeal } from "../domain/types";

interface Props {
  plan: PlannedMeal[];
  servings: number;
  wanted: number;
  onServings: (servings: number) => void;
  onWanted: (meals: number) => void;
  onSurprise: () => void;
  onClear: () => void;
}

/** How many, for how many, and what is in the week so far. */
export function WeekBar({ plan, servings, wanted, onServings, onWanted, onSurprise, onClear }: Props) {

  return (
    <section className="week" aria-label="This week">
      <div className="week__dials">
        <Dial label="Meals this week" value={wanted} min={1} max={14} onChange={onWanted} />
        <Dial label="Cooking for" value={servings} min={1} max={12} onChange={onServings} suffix="people" />
      </div>

      <div className="week__acts">
        <button className="btn btn--go" type="button" onClick={onSurprise}>
          {plan.length > 0 ? "Surprise me again" : `Pick ${wanted} for me`}
        </button>
        {plan.length > 0 && (
          <button className="mini" type="button" onClick={onClear}>
            Clear the week
          </button>
        )}
      </div>

      <p className="week__count">
        {plan.length} of {wanted} chosen{plan.length > 0 && ` · feeding ${servings}`}
      </p>
    </section>
  );
}

function Dial({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="dial">
      <span className="label">{label}</span>
      <div className="stepper">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label={`Fewer: ${label}`}>
          −
        </button>
        <output>{value}</output>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))} aria-label={`More: ${label}`}>
          +
        </button>
      </div>
      {suffix && <span className="dial__suffix">{suffix}</span>}
    </div>
  );
}
