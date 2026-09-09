import { createTescoTransport, type TescoHeaders, type Transport } from "./tescoDirect";

/** The slice of the extension API this app uses, so a page without one can say so. */
interface ChromeLike {
  runtime?: { id?: string; sendMessage?: (message: unknown) => Promise<unknown> };
}

function chromeApi(): ChromeLike | undefined {
  return (globalThis as { chrome?: ChromeLike }).chrome;
}

/**
 * Whether this copy is running as part of the extension.
 *
 * The difference is not cosmetic: inside the extension the app may call Tesco
 * itself, and outside it may not, which is the whole reason a local server
 * exists. Deciding it from `chrome.runtime.id` rather than from the address
 * bar means a page served from anywhere else, including the hosted copy, falls
 * back rather than failing.
 */
export function inExtension(): boolean {
  return typeof chromeApi()?.runtime?.id === "string";
}

/**
 * The two headers a Tesco page adds that its cookies do not carry.
 *
 * Held by the extension's background worker, in memory, for as long as the
 * browser is open. Nothing is written to disk, and the app asks for them at
 * the moment it needs them rather than keeping a copy of its own.
 */
async function ask(): Promise<TescoHeaders | undefined> {
  const send = chromeApi()?.runtime?.sendMessage;
  if (!send) return undefined;
  try {
    const answer = (await send({ type: "tesco-headers" })) as { headers?: TescoHeaders } | undefined;
    return answer?.headers;
  } catch {
    return undefined;
  }
}

async function borrowHeaders(): Promise<TescoHeaders | undefined> {
  const held = await ask();
  if (held?.authorization) return held;

  // Being signed in is not the same as having been watched signing in. These
  // can only be taken from a request Tesco's own page makes, so a tab opened
  // before the extension was loaded has never given us one, and the app tells
  // someone plainly signed in that they are not. Ask Tesco for a page, wait,
  // and look again, rather than sending a person off to refresh a tab.
  const send = chromeApi()?.runtime?.sendMessage;
  if (!send) return held;
  try {
    await send({ type: "tesco-refresh" });
  } catch {
    return held;
  }

  for (let wait = 0; wait < 12; wait++) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const now = await ask();
    if (now?.authorization) return now;
  }
  return undefined;
}

/** The direct transport, when there is one to have. */
export function extensionTransport(): Transport | undefined {
  return inExtension() ? createTescoTransport({ headers: borrowHeaders }) : undefined;
}


/**
 * What the extension has actually observed, for when it says something the
 * person can see is untrue.
 *
 * Names of headers and counts only. The token's value is the one thing that
 * must never be displayed, so it is never sent here in the first place.
 */
export async function whatItSaw(): Promise<Record<string, string>> {
  const send = chromeApi()?.runtime?.sendMessage;
  if (!send) return {};
  try {
    const answer = (await send({ type: "tesco-seen" })) as { seen?: Record<string, string> } | undefined;
    return answer?.seen ?? {};
  } catch {
    return {};
  }
}
