import { useState } from "react";
import { Icon } from "./Icon";

interface Props {
  chosen: number;
  wanted: number;
  servings: number;
  onWanted: (meals: number) => void;
  onServings: (people: number) => void;
  onSurprise: () => void;
  onClear: () => void;
}

/**
 * The week at a glance, and one button that finishes it for you.
 *
 * How many dinners and how many people are settled once and then rarely
 * touched, so they are a line of text with a way in, not two controls sitting
 * open above every screen. What stays visible is the only thing that changes
 * daily: how far along the week is.
 */
export function WeekCard({ chosen, wanted, servings, onWanted, onServings, onSurprise, onClear }: Props) {
  const [editing, setEditing] = useState(false);
  const done = Math.min(1, wanted === 0 ? 0 : chosen / wanted);
  const short = Math.max(0, wanted - chosen);

  return (
    <section className="week" aria-label="This week">
      <div className="week__head">
        <p className="week__done">
          {chosen === 0 ? "No dinners chosen yet" : `${chosen} of ${wanted} dinners`}
        </p>
        <button className="week__set" type="button" aria-expanded={editing} onClick={() => setEditing(!editing)}>
          {wanted} for {servings}
          {editing ? <Icon.up size={15} /> : <Icon.down size={15} />}
        </button>
      </div>

      <div className="bar">
        <div className="bar__fill" style={{ transform: `scaleX(${done})` }} />
      </div>

      {editing && (
        <div className="dials">
          <Dial label="Dinners" value={wanted} min={1} max={14} onChange={onWanted} />
          <Dial label="People" value={servings} min={1} max={12} onChange={onServings} />
        </div>
      )}

      <div className="week__acts">
        <button className="surprise" type="button" onClick={onSurprise}>
          {chosen === 0 ? `Pick ${wanted} for me` : short > 0 ? `Fill the other ${short}` : "Pick a different week"}
        </button>
        {chosen > 0 && (
          <button className="clear" type="button" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
    </section>
  );
}

function Dial({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="dial">
      <span className="label">{label}</span>
      <div className="stepper">
        <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
          <Icon.minus size={18} />
        </button>
        <output aria-label={label}>{value}</output>
        <button type="button" aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
          <Icon.plus size={18} />
        </button>
      </div>
    </div>
  );
}
