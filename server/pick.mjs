/**
 * Minimal path reader for retailer responses.
 *
 * Every retailer shapes its JSON differently, so the response shape lives in
 * config rather than in code: "data.results[].product.title" reaches into a
 * list, "basket.total.value" into an object.
 */
export function pick(value, path) {
  if (!path) return undefined;
  let current = value;

  for (const step of path.split(".")) {
    if (current == null) return undefined;

    if (step.endsWith("[]")) {
      const key = step.slice(0, -2);
      const list = key ? current[key] : current;
      if (!Array.isArray(list)) return undefined;
      return list;
    }
    current = current[step];
  }

  return current;
}

/** Read a list at `path`, then read `fields` out of each entry. */
export function pickAll(value, path, fields) {
  const list = pick(value, path);
  if (!Array.isArray(list)) return [];
  return list.map((entry) => {
    const out = {};
    for (const [name, fieldPath] of Object.entries(fields)) {
      out[name] = pick(entry, fieldPath);
    }
    return out;
  });
}

/** Fill {placeholders} in a URL or body template, encoding for a query string. */
export function fill(template, values) {
  if (typeof template !== "string") return template;
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    key in values ? encodeURIComponent(String(values[key])) : `{${key}}`,
  );
}
