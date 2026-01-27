import { SESSION_DURATION_MS } from "./config";
import {
  getPendingSchedules,
  insertSchedule,
  markScheduleFired,
  deleteSchedule,
} from "./db";
import { warmup } from "./warmup";
import type { Schedule } from "./types";

type ScheduleCallback = (schedule: Schedule, success: boolean, error?: string) => void;

const timers = new Map<number, NodeJS.Timeout>();

let onFire: ScheduleCallback = () => {};

export function setScheduleCallback(cb: ScheduleCallback): void {
  onFire = cb;
}

export function restoreSchedules(): void {
  const pending = getPendingSchedules();
  for (const schedule of pending) {
    setTimer(schedule);
  }
  if (pending.length > 0) {
    console.log(`Restored ${pending.length} pending schedule(s)`);
  }
}

export function addSchedule(targetDatetime: Date, hoursRemaining: number): Schedule | string {
  const warmupAtMs = targetDatetime.getTime() - (SESSION_DURATION_MS - hoursRemaining * 3600_000);
  const warmupAt = new Date(warmupAtMs);

  if (warmupAt.getTime() <= Date.now()) {
    return `Warmup time already passed (would have been ${warmupAt.toISOString()})`;
  }

  const schedule = insertSchedule(
    targetDatetime.toISOString(),
    hoursRemaining,
    warmupAt.toISOString()
  );

  setTimer(schedule);
  return schedule;
}

export function cancelSchedule(id: number): boolean {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  return deleteSchedule(id);
}

function setTimer(schedule: Schedule): void {
  const delay = new Date(schedule.warmup_at).getTime() - Date.now();
  if (delay <= 0) return;

  const timer = setTimeout(async () => {
    timers.delete(schedule.id);
    markScheduleFired(schedule.id);

    const { result } = await warmup();
    onFire(schedule, result.success, result.error);
  }, delay);

  timers.set(schedule.id, timer);
}
