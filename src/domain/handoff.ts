import { money } from "./units";
import type { BasketLine } from "./basket";

/**
 * Where a real retailer integration plugs in.
 *
 * Tesco, Sainsbury's and Ocado all gate their basket APIs behind partner
 * credentials and an OAuth flow, so nothing here talks to them yet. Every
 * export below produces a list a shopper can carry into a real shop, and a
 * retailer adapter would implement the same interface.
 */
export interface BasketTarget {
  id: string;
  name: string;
  send(lines: BasketLine[]): Promise<{ ok: boolean; message: string }>;
}

export function asText(lines: BasketLine[]): string {
  const rows = lines.map((l) => `${l.qty} × ${l.product.name} (${l.product.size}); ${money(l.product.price * l.qty)}`);
  const total = lines.reduce((sum, l) => sum + l.product.price * l.qty, 0);
  return [...rows, "", `Total ${money(total)}`].join("\n");
}

export function asCsv(lines: BasketLine[]): string {
  const rows = lines.map((l) =>
    [l.product.id, quote(l.product.name), quote(l.product.size), l.qty, l.product.price.toFixed(2), l.source].join(","),
  );
  return ["product_id,name,size,quantity,unit_price,source", ...rows].join("\n");
}

/** The only target that exists today: the shopper's own device. */
export const clipboardTarget: BasketTarget = {
  id: "clipboard",
  name: "Copy the list",
  async send(lines) {
    try {
      await navigator.clipboard.writeText(asText(lines));
      return { ok: true, message: "Shopping list copied. Paste it into your supermarket app." };
    } catch {
      return { ok: false, message: "Your browser blocked the clipboard. Use Download CSV instead." };
    }
  },
};

function quote(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
