import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseWarmupOutput } from "./warmup";

describe("parseWarmupOutput", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("parses valid JSON with all fields", () => {
    const stdout = JSON.stringify({
      session_id: "sess_123",
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 10,
        cache_read_input_tokens: 5,
      },
      total_cost_usd: 0.05,
    });

    const { warmupResult, sessionArgs } = parseWarmupOutput(stdout);

    expect(warmupResult).toEqual({
      success: true,
      session_id: "sess_123",
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 10,
        cache_read_input_tokens: 5,
      },
      cost_usd: 0.05,
    });

    expect(sessionArgs[0]).toBe("sess_123"); // session_id
    expect(sessionArgs[1]).toBe("2025-01-15T10:00:00.000Z"); // started_at
    expect(sessionArgs[2]).toBe("2025-01-15T15:00:00.000Z"); // expires_at (5h later)
    expect(sessionArgs[3]).toBe(100); // input_tokens
    expect(sessionArgs[4]).toBe(50); // output_tokens
    expect(sessionArgs[5]).toBe(10); // cache_creation_tokens
    expect(sessionArgs[6]).toBe(5); // cache_read_tokens
    expect(sessionArgs[7]).toBe(0.05); // cost_usd
  });

  it("defaults missing session_id to unknown", () => {
    const stdout = JSON.stringify({ usage: {}, total_cost_usd: 0 });
    const { sessionArgs } = parseWarmupOutput(stdout);
    expect(sessionArgs[0]).toBe("unknown");
  });

  it("defaults missing usage fields to 0", () => {
    const stdout = JSON.stringify({ session_id: "s1" });
    const { sessionArgs } = parseWarmupOutput(stdout);
    expect(sessionArgs[3]).toBe(0); // input_tokens
    expect(sessionArgs[4]).toBe(0); // output_tokens
    expect(sessionArgs[5]).toBe(0); // cache_creation_tokens
    expect(sessionArgs[6]).toBe(0); // cache_read_tokens
  });

  it("defaults missing cost to 0", () => {
    const stdout = JSON.stringify({ session_id: "s1" });
    const { sessionArgs } = parseWarmupOutput(stdout);
    expect(sessionArgs[7]).toBe(0);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseWarmupOutput("not json")).toThrow();
  });
});
