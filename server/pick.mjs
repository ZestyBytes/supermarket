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
    if (step === "") continue;

    // A batched GraphQL response is an array, so paths can start with an
    // index: "[0].data.search.results[]".
    const indexed = /^(.*)\[(\d+)\]$/.exec(step);
    if (indexed) {
      const [, key, index] = indexed;
      const list = key ? current[key] : current;
      if (!Array.isArray(list)) return undefined;
      current = list[Number(index)];
      continue;
    }

    if (step.endsWith("[]")) {
      const key = step.slice(0, -2);
      const list = key ? current[key] : current;
      return Array.isArray(list) ? list : undefined;
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

/**
 * Fill {placeholders} in a URL or a request body.
 *
 * How a value must be escaped depends on where it lands. In a query string it
 * is percent-encoded; inside a JSON body it needs JSON string escaping, and
 * percent-encoding there would search the retailer for "chicken%20breast"
 * rather than "chicken breast".
 */
export function fill(template, values, where = "url") {
  if (typeof template !== "string") return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    if (!(key in values)) return `{${key}}`;
    const value = String(values[key]);
    if (where === "json") return JSON.stringify(value).slice(1, -1);
    if (where === "raw") return value;
    return encodeURIComponent(value);
  });
}
