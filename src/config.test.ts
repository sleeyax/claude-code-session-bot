import { describe, it, expect } from "vitest";
import {
  TELEGRAM_BOT_TOKEN,
  ALLOWED_USER_IDS,
  TIMEZONE,
  SESSION_DURATION_MS,
  DB_PATH,
} from "./config";

describe("config", () => {
  it("TELEGRAM_BOT_TOKEN from env", () => {
    expect(TELEGRAM_BOT_TOKEN).toBe("test-token");
  });

  it("ALLOWED_USER_IDS parsed from comma-separated string", () => {
    expect(ALLOWED_USER_IDS).toEqual([111, 222]);
  });

  it("TIMEZONE defaults to UTC", () => {
    expect(TIMEZONE).toBe("UTC");
  });

  it("SESSION_DURATION_MS is 5 hours", () => {
    expect(SESSION_DURATION_MS).toBe(5 * 60 * 60 * 1000);
  });

  it("DB_PATH from env", () => {
    expect(DB_PATH).toBe(":memory:");
  });
});
