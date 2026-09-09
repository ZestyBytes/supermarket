import type { Requirement } from "./types";
import { searchTermFor } from "./liveMatch";

/**
 * A wider search to fall back on when the exact variety is not in stock.
 *
 * There may be no chestnut mushrooms today, but there will be mushrooms, and
 * coming home without any because we asked too precisely is a worse answer
 * than coming home with the wrong kind. So each ingredient that has a safe
 * wider term declares it.
 *
 * Declared rather than derived, because the grammar trick does not survive
 * contact with food. Dropping the first word turns "baby spinach" into
 * "spinach", which is right, and "chicken breast" into "breast", which is
 * not; dropping the last turns "salmon fillets" into "salmon", which is
 * right, and "chestnut mushrooms" into "chestnut", which is a nut. The
 * ingredients with no safe wider term are the point: nothing here should ever
 * turn a chicken breast into a whole chicken, or lamb mince into lamb.
 */
const BROADER: Record<string, string> = {
  mushroom: "mushrooms",
  spinach: "spinach",
  broccoli: "broccoli",
  coriander: "coriander",
  chilli: "chillies",
  salmon: "salmon fillets",
  bacon: "bacon",
  sausage: "sausages",
  "beef-mince": "beef mince",
  potato: "potatoes",
  tomato: "tomatoes",
  onion: "onions",
  rice: "basmati rice",
  tortilla: "tortilla wraps",
  peas: "peas",
  yoghurt: "natural yoghurt",
  cheese: "cheddar",
};

/**
 * The wider term, when it says something the exact one did not.
 *
 * Where the two would send the same search there is nothing to fall back to,
 * so this returns nothing rather than asking Tesco the same question twice.
 */
export function broaderTermFor(requirement: Requirement): string | undefined {
  const wider = BROADER[requirement.ingredient.id];
  if (!wider) return undefined;
  return wider.toLowerCase() === searchTermFor(requirement).toLowerCase() ? undefined : wider;
}
