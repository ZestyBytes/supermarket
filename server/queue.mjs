/**
 * Serialised request queue.
 *
 * Firing a week's ingredient searches at a retailer in parallel gets them
 * refused. One at a time with a gap between is both politer and, once the
 * failures and retries are counted, usually faster than a burst.
 */
export function createQueue({ minIntervalMs = 350, retries = 1, backoffMs = 1200, sleep = defaultSleep } = {}) {
  let chain = Promise.resolve();
  let lastStart = 0;

  async function runOnce(task) {
    const wait = Math.max(0, lastStart + minIntervalMs - Date.now());
    if (wait > 0) await sleep(wait);
    lastStart = Date.now();
    return task();
  }

  return function enqueue(task, { retryable = isRetryable } = {}) {
    const run = chain.then(async () => {
      let lastError;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          return await runOnce(task);
        } catch (error) {
          lastError = error;
          if (!retryable(error) || attempt === retries) throw error;
          await sleep(backoffMs * (attempt + 1));
        }
      }
      throw lastError;
    });
    // Keep the chain alive when a task rejects, so one failure does not wedge
    // everything queued behind it.
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}

/** A rate limit or a network blip is worth one more go; a rejected session is not. */
export function isRetryable(error) {
  if (['SESSION_EXPIRED', 'SESSION_MISSING', 'BAD_REQUEST', 'BASKET_UNCERTAIN'].includes(error?.code)) return false;
  const status = error?.status;
  if (status === 401 || status === 403) return false;
  if (status === 429) return true;
  if (typeof status === "number") return status >= 500;
  return true;
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
