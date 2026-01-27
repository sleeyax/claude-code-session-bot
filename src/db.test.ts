import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  initDb,
  insertSession,
  getActiveSession,
  getSessionHistory,
  insertSchedule,
  getPendingSchedules,
  markScheduleFired,
  deleteSchedule,
} from "./db";

beforeEach(() => {
  initDb(":memory:");
});

describe("sessions", () => {
  const futureDate = new Date(Date.now() + 3_600_000).toISOString();
  const pastDate = new Date(Date.now() - 3_600_000).toISOString();
  const now = new Date().toISOString();

  it("insertSession returns session with all fields", () => {
    const s = insertSession("s1", now, futureDate, 100, 50, 10, 5, 0.05);
    expect(s.id).toBeDefined();
    expect(s.session_id).toBe("s1");
    expect(s.started_at).toBe(now);
    expect(s.expires_at).toBe(futureDate);
    expect(s.input_tokens).toBe(100);
    expect(s.output_tokens).toBe(50);
    expect(s.cache_creation_tokens).toBe(10);
    expect(s.cache_read_tokens).toBe(5);
    expect(s.cost_usd).toBe(0.05);
  });

  it("getActiveSession returns active session", () => {
    insertSession("s1", now, futureDate, 0, 0, 0, 0, 0);
    const active = getActiveSession();
    expect(active).toBeDefined();
    expect(active!.session_id).toBe("s1");
  });

  it("getActiveSession returns undefined for expired session", () => {
    insertSession("s1", pastDate, pastDate, 0, 0, 0, 0, 0);
    expect(getActiveSession()).toBeUndefined();
  });

  it("getActiveSession returns most recent when multiple active", () => {
    const farFuture = new Date(Date.now() + 7_200_000).toISOString();
    insertSession("s1", pastDate, futureDate, 0, 0, 0, 0, 0);
    insertSession("s2", now, farFuture, 0, 0, 0, 0, 0);
    const active = getActiveSession();
    expect(active!.session_id).toBe("s2");
  });

  it("getSessionHistory returns sessions DESC ordered", () => {
    insertSession("s1", "2025-01-01T00:00:00Z", futureDate, 0, 0, 0, 0, 0);
    insertSession("s2", "2025-01-02T00:00:00Z", futureDate, 0, 0, 0, 0, 0);
    insertSession("s3", "2025-01-03T00:00:00Z", futureDate, 0, 0, 0, 0, 0);
    const history = getSessionHistory(10);
    expect(history.map((s) => s.session_id)).toEqual(["s3", "s2", "s1"]);
  });

  it("getSessionHistory respects limit", () => {
    insertSession("s1", "2025-01-01T00:00:00Z", futureDate, 0, 0, 0, 0, 0);
    insertSession("s2", "2025-01-02T00:00:00Z", futureDate, 0, 0, 0, 0, 0);
    insertSession("s3", "2025-01-03T00:00:00Z", futureDate, 0, 0, 0, 0, 0);
    expect(getSessionHistory(2)).toHaveLength(2);
  });
});

describe("schedules", () => {
  const futureWarmup = new Date(Date.now() + 3_600_000).toISOString();
  const futureTarget = new Date(Date.now() + 7_200_000).toISOString();
  const pastWarmup = new Date(Date.now() - 3_600_000).toISOString();

  it("insertSchedule returns schedule with all fields", () => {
    const s = insertSchedule(futureTarget, 2, futureWarmup);
    expect(s.id).toBeDefined();
    expect(s.target_datetime).toBe(futureTarget);
    expect(s.hours_remaining).toBe(2);
    expect(s.warmup_at).toBe(futureWarmup);
    expect(s.fired).toBe(0);
  });

  it("getPendingSchedules returns unfired future schedules", () => {
    insertSchedule(futureTarget, 2, futureWarmup);
    const pending = getPendingSchedules();
    expect(pending).toHaveLength(1);
  });

  it("getPendingSchedules excludes fired schedules", () => {
    const s = insertSchedule(futureTarget, 2, futureWarmup);
    markScheduleFired(s.id);
    expect(getPendingSchedules()).toHaveLength(0);
  });

  it("getPendingSchedules excludes past warmup_at", () => {
    insertSchedule(futureTarget, 2, pastWarmup);
    expect(getPendingSchedules()).toHaveLength(0);
  });

  it("markScheduleFired sets fired flag", () => {
    const s = insertSchedule(futureTarget, 2, futureWarmup);
    markScheduleFired(s.id);
    expect(getPendingSchedules()).toHaveLength(0);
  });

  it("deleteSchedule removes unfired schedule", () => {
    const s = insertSchedule(futureTarget, 2, futureWarmup);
    expect(deleteSchedule(s.id)).toBe(true);
    expect(getPendingSchedules()).toHaveLength(0);
  });

  it("deleteSchedule returns false for fired schedule", () => {
    const s = insertSchedule(futureTarget, 2, futureWarmup);
    markScheduleFired(s.id);
    expect(deleteSchedule(s.id)).toBe(false);
  });

  it("deleteSchedule returns false for non-existent id", () => {
    expect(deleteSchedule(999)).toBe(false);
  });
});
