/**
 * Tesco's minimum basket rule, in one place.
 *
 * Under a certain spend Tesco adds a flat charge to the order. You only find
 * out at the checkout, by which point the fix (one more dinner, or a few
 * cupboard things) means coming back here and starting the shop again. Saying
 * it while the week is still being chosen is worth a line on the screen.
 *
 * Both numbers are Tesco's and can change without telling us, so they live
 * here as constants rather than being spread through the wording.
 */
export const MINIMUM_BASKET = 40;
export const UNDER_MINIMUM_CHARGE = 5;

/** How much more this basket needs to avoid the charge, or 0 once it is clear. */
export function shortOfMinimum(goods: number): number {
  if (goods <= 0) return 0;
  return Math.max(0, Math.round((MINIMUM_BASKET - goods) * 100) / 100);
}

/** What the goods in a basket come to, ignoring whatever the retailer adds on top. */
export function goodsTotal(items: Array<{ price: number; qty: number }>): number {
  return Math.round(items.reduce((sum, item) => sum + item.price * item.qty, 0) * 100) / 100;
}
