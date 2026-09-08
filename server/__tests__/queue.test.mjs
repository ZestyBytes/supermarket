import { describe, expect, it } from "vitest";
import { createQueue, isRetryable } from "../queue.mjs";

const noSleep = () => Promise.resolve();

describe("createQueue", () => {
  it("runs tasks one at a time, in order", async () => {
    const enqueue = createQueue({ minIntervalMs: 0, sleep: noSleep });
    const events = [];

    const tasks = [1, 2, 3].map((n) =>
      enqueue(async () => {
        events.push(`start ${n}`);
        await Promise.resolve();
        events.push(`end ${n}`);
      }),
    );
    await Promise.all(tasks);

    expect(events).toEqual(["start 1", "end 1", "start 2", "end 2", "start 3", "end 3"]);
  });

  it("retries a throttled request once", async () => {
    const enqueue = createQueue({ minIntervalMs: 0, retries: 1, sleep: noSleep });
    let attempts = 0;

    const result = await enqueue(async () => {
      attempts += 1;
      if (attempts === 1) throw Object.assign(new Error("slow down"), { status: 429 });
      return "ok";
    });

    expect(result).toBe("ok");
    expect(attempts).toBe(2);
  });

  it("does not retry a rejected session", async () => {
    const enqueue = createQueue({ minIntervalMs: 0, retries: 2, sleep: noSleep });
    let attempts = 0;

    await expect(
      enqueue(async () => {
        attempts += 1;
        throw Object.assign(new Error("Unauthorized"), { status: 401 });
      }),
    ).rejects.toThrow("Unauthorized");

    expect(attempts).toBe(1);
  });

  it("keeps running after a task fails", async () => {
    const enqueue = createQueue({ minIntervalMs: 0, retries: 0, sleep: noSleep });
    await expect(enqueue(async () => {
      throw Object.assign(new Error("nope"), { status: 401 });
    })).rejects.toThrow("nope");
    await expect(enqueue(async () => "still here")).resolves.toBe("still here");
  });

  it("waits between requests", async () => {
    const waits = [];
    const enqueue = createQueue({
      minIntervalMs: 300,
      sleep: (ms) => {
        waits.push(ms);
        return Promise.resolve();
      },
    });
    await enqueue(async () => "a");
    await enqueue(async () => "b");
    expect(waits.some((ms) => ms > 0)).toBe(true);
  });
});

describe("isRetryable", () => {
  it("retries throttling and server faults, not authorisation", () => {
    expect(isRetryable({ status: 429 })).toBe(true);
    expect(isRetryable({ status: 503 })).toBe(true);
    expect(isRetryable({ status: 401 })).toBe(false);
    expect(isRetryable({ status: 403 })).toBe(false);
    expect(isRetryable({ status: 404 })).toBe(false);
  });
});
