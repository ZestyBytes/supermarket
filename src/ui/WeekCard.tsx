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
 * The week at a glance: how far along, for how many, and one button that
 * finishes it for you.
 *
 * The progress bar is the point. "3 of 5 dinners" answers the only question
 * anyone opens this app with, and answers it before you have read anything.
 */
export function WeekCard({ chosen, wanted, servings, onWanted, onServings, onSurprise, onClear }: Props) {
  const done = Math.min(1, wanted === 0 ? 0 : chosen / wanted);
  const short = Math.max(0, wanted - chosen);

  return (
    <section className="week" aria-label="This week">
      <div className="week__head">
        <p className="week__done">
          {chosen === 0 ? `No dinners planned yet` : `${chosen} of ${wanted} dinners planned`}
        </p>
        <p className="week__who">Feeding {servings}</p>
      </div>

      <div className="bar">
        <div className="bar__fill" style={{ transform: `scaleX(${done})` }} />
      </div>

      <div className="dials">
        <Dial label="Dinners" value={wanted} min={1} max={14} onChange={onWanted} />
        <Dial label="People" value={servings} min={1} max={12} onChange={onServings} />
      </div>

      <button className="surprise" type="button" onClick={onSurprise}>
        <Icon.sparkle size={18} />
        {chosen === 0 ? `Pick ${wanted} for me` : short > 0 ? `Fill the other ${short} for me` : "Pick a different week"}
      </button>

      {chosen > 0 && (
        <button className="clear" type="button" onClick={onClear}>
          Clear the week
        </button>
      )}
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
