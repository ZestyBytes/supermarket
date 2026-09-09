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
async function borrowHeaders(): Promise<TescoHeaders | undefined> {
  const send = chromeApi()?.runtime?.sendMessage;
  if (!send) return undefined;
  try {
    const answer = (await send({ type: "tesco-headers" })) as { headers?: TescoHeaders } | undefined;
    return answer?.headers;
  } catch {
    return undefined;
  }
}

/** The direct transport, when there is one to have. */
export function extensionTransport(): Transport | undefined {
  return inExtension() ? createTescoTransport({ headers: borrowHeaders }) : undefined;
}
