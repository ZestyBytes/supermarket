import { money } from "../domain/units";
import type { BasketLine, BasketTotals } from "../domain/basket";
import { FREE_DELIVERY_OVER } from "../domain/basket";
import type { DeliverySlot } from "../data/recipes";

interface Props {
  lines: BasketLine[];
  sums: BasketTotals;
  slots: DeliverySlot[];
  slotId: string;
  onSlot: (id: string) => void;
  onQty: (productId: string, qty: number) => void;
  onEmpty: () => void;
  onCopy: () => void;
  onCsv: () => void;
}

export function Basket({ lines, sums, slots, slotId, onSlot, onQty, onEmpty, onCopy, onCsv }: Props) {
  return (
    <aside className="pane" aria-labelledby="basket-head">
      <div className="card">
        <div className="card__head">
          <h2 id="basket-head">Your basket</h2>
          <span className="label">{sums.items} items</span>
        </div>

        <ul className="lines">
          {lines.length === 0 && (
            <li className="empty empty--tight">Empty. Add the week's plan in one go.</li>
          )}
          {lines.map((line) => (
            <li className="line" key={line.product.id}>
              <span className="line__name">{line.product.name}</span>
              <span className="line__cost">{money(line.product.price * line.qty)}</span>
              <span className="line__meta">
                {line.product.size} at {money(line.product.price)}
                {line.source === "manual" && " · added by hand"}
              </span>
              <div className="stepper stepper--small">
                <button type="button" onClick={() => onQty(line.product.id, line.qty - 1)} aria-label={`One fewer ${line.product.name}`}>
                  −
                </button>
                <output>{line.qty}</output>
                <button type="button" onClick={() => onQty(line.product.id, line.qty + 1)} aria-label={`One more ${line.product.name}`}>
                  +
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="card__body">
          <div className="sums">
            <div className="sum">
              <span>Goods</span>
              <span>{money(sums.goods)}</span>
            </div>
            {sums.savings > 0 && (
              <div className="sum sum--save">
                <span>Offer savings</span>
                <span>−{money(sums.savings)}</span>
              </div>
            )}
            <div className="sum">
              <span>Delivery</span>
              <span>{sums.delivery === 0 ? "Free" : money(sums.delivery)}</span>
            </div>
            <div className="sum sum--total">
              <span>To pay</span>
              <span>{money(sums.total)}</span>
            </div>
          </div>

          <div className="progress">
            <div className="progress__track">
              <div
                className="progress__fill"
                style={{ width: `${Math.min(100, (sums.goods / FREE_DELIVERY_OVER) * 100)}%` }}
              />
            </div>
            <p className="progress__note">
              {sums.toFreeDelivery > 0
                ? `Spend ${money(sums.toFreeDelivery)} more for free delivery`
                : "Free delivery unlocked"}
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__head">
          <h2>Delivery slot</h2>
          <span className="label">Next 3 days</span>
        </div>
        <div className="card__body">
          <ul className="slots">
            {slots.map((slot) => (
              <li key={slot.id}>
                <button
                  className="slot"
                  type="button"
                  aria-pressed={slot.id === slotId}
                  onClick={() => onSlot(slot.id)}
                >
                  <span className="slot__when">
                    {slot.day}, {slot.window}
                  </span>
                  <span className={`slot__fee${slot.fee === 0 ? " slot__fee--free" : ""}`}>
                    {slot.fee === 0 ? "Free" : money(slot.fee)}
                  </span>
                  <span className="slot__left">{slot.left} slots left</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card">
        <div className="card__head">
          <h2>Send it to the shop</h2>
          <span className="label">Handoff</span>
        </div>
        <div className="card__body handoff">
          <p className="handoff__note">
            No UK supermarket opens its basket API without partner credentials, so this exports the
            list instead. A retailer adapter drops into <code>src/domain/handoff.ts</code>.
          </p>
          <div className="handoff__acts">
            <button className="btn" type="button" onClick={onCopy} disabled={lines.length === 0}>
              Copy the list
            </button>
            <button className="btn" type="button" onClick={onCsv} disabled={lines.length === 0}>
              Download CSV
            </button>
          </div>
          {lines.length > 0 && (
            <button className="mini" type="button" onClick={onEmpty}>
              Empty the basket
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
