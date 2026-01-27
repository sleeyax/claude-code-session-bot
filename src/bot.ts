import TelegramBot from "node-telegram-bot-api";
import * as chrono from "chrono-node";
import { ALLOWED_USER_IDS, TIMEZONE } from "./config";
import { getActiveSession, getSessionHistory, getPendingSchedules } from "./db";
import { warmup } from "./warmup";
import { addSchedule, cancelSchedule } from "./scheduler";

const fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  dateStyle: "medium",
  timeStyle: "short",
});

export function fmtDuration(ms: number): string {
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function isAllowed(msg: TelegramBot.Message): boolean {
  return !!msg.from && ALLOWED_USER_IDS.includes(msg.from.id);
}

export function parseScheduleInput(input: string): { dateStr: string; hours: number } {
  const parts = input.split(/\s+/);
  let hours = 2;
  let dateStr = input;
  const hoursMatch = parts[parts.length - 1].match(/^(\d+(?:\.\d+)?)h?$/);
  if (hoursMatch && parts.length > 1) {
    const val = parseFloat(hoursMatch[1]);
    if (val >= 0.5 && val <= 5) {
      hours = val;
      dateStr = parts.slice(0, -1).join(" ");
    }
  }
  return { dateStr, hours };
}

export function createBot(token: string): TelegramBot {
  const bot = new TelegramBot(token, { polling: true });

  bot.onText(/\/(help|start)/, (msg) => {
    if (!isAllowed(msg)) return;
    const text = [
      `*Claude Code Session Bot*`,
      ``,
      `/warmup — Start a session now`,
      `/session — Show active session info`,
      `/schedule \`<datetime>\` \`[hours]\` — Schedule a warmup`,
      `/schedules — List pending schedules`,
      `/cancel \`<id>\` — Cancel a schedule`,
      `/history — Recent session history`,
      `/help — Show this message`,
      ``,
      `*Schedule examples*`,
      `/schedule tomorrow 9am`,
      `/schedule monday 14:00 3h`,
      `/schedule jan 30 8:00 4h`,
    ];
    bot.sendMessage(msg.chat.id, text.join("\n"), { parse_mode: "Markdown" });
  });

  bot.onText(/\/session/, (msg) => {
    if (!isAllowed(msg)) return;
    const session = getActiveSession();
    if (!session) {
      bot.sendMessage(msg.chat.id, "No active session.");
      return;
    }
    const remaining = new Date(session.expires_at).getTime() - Date.now();
    const lines = [
      `*Active Session*`,
      `Session: \`${session.session_id}\``,
      `Started: ${fmt.format(new Date(session.started_at))}`,
      `Expires: ${fmt.format(new Date(session.expires_at))}`,
      `Remaining: *${fmtDuration(remaining)}*`,
      ``,
      `*Tokens*`,
      `Input: ${session.input_tokens.toLocaleString()}`,
      `Output: ${session.output_tokens.toLocaleString()}`,
      `Cache create: ${session.cache_creation_tokens.toLocaleString()}`,
      `Cache read: ${session.cache_read_tokens.toLocaleString()}`,
    ];
    bot.sendMessage(msg.chat.id, lines.join("\n"), { parse_mode: "Markdown" });
  });

  bot.onText(/\/warmup/, async (msg) => {
    if (!isAllowed(msg)) return;
    bot.sendMessage(msg.chat.id, "Warming up...");
    const { result, session } = await warmup();
    if (!result.success) {
      bot.sendMessage(msg.chat.id, `Warmup failed: ${result.error}`);
      return;
    }
    const remaining = session
      ? fmtDuration(new Date(session.expires_at).getTime() - Date.now())
      : "5h 0m";
    bot.sendMessage(
      msg.chat.id,
      `Session started! *${remaining}* remaining.\nTokens used: ${result.usage?.input_tokens ?? 0} in / ${result.usage?.output_tokens ?? 0} out`,
      { parse_mode: "Markdown" }
    );
  });

  bot.onText(/\/schedule (.+)/, (msg, match) => {
    if (!isAllowed(msg)) return;
    const input = match![1].trim();
    const { dateStr, hours } = parseScheduleInput(input);

    const targetDate = chrono.parseDate(dateStr, new Date(), { forwardDate: true });
    if (!targetDate) {
      bot.sendMessage(msg.chat.id, "Could not parse datetime. Try: `tomorrow 9am`, `monday 14:00`, `jan 30 8:00`", { parse_mode: "Markdown" });
      return;
    }

    const result = addSchedule(targetDate, hours);
    if (typeof result === "string") {
      bot.sendMessage(msg.chat.id, result);
      return;
    }

    const lines = [
      `Schedule created (ID: ${result.id})`,
      `Target: ${fmt.format(targetDate)} with *${hours}h* remaining`,
      `Warmup at: *${fmt.format(new Date(result.warmup_at))}*`,
    ];
    bot.sendMessage(msg.chat.id, lines.join("\n"), { parse_mode: "Markdown" });
  });

  bot.onText(/\/schedules/, (msg) => {
    if (!isAllowed(msg)) return;
    const pending = getPendingSchedules();
    if (pending.length === 0) {
      bot.sendMessage(msg.chat.id, "No pending schedules.");
      return;
    }
    const lines = pending.map(
      (s) =>
        `ID ${s.id}: warmup at ${fmt.format(new Date(s.warmup_at))} (target: ${fmt.format(new Date(s.target_datetime))}, ${s.hours_remaining}h remaining)`
    );
    bot.sendMessage(msg.chat.id, lines.join("\n"));
  });

  bot.onText(/\/cancel (\d+)/, (msg, match) => {
    if (!isAllowed(msg)) return;
    const id = parseInt(match![1], 10);
    const ok = cancelSchedule(id);
    bot.sendMessage(msg.chat.id, ok ? `Schedule ${id} cancelled.` : `Schedule ${id} not found or already fired.`);
  });

  bot.onText(/\/history/, (msg) => {
    if (!isAllowed(msg)) return;
    const sessions = getSessionHistory(5);
    if (sessions.length === 0) {
      bot.sendMessage(msg.chat.id, "No session history.");
      return;
    }
    const lines = sessions.map((s) => {
      const expired = new Date(s.expires_at).getTime() < Date.now();
      const status = expired ? "expired" : `${fmtDuration(new Date(s.expires_at).getTime() - Date.now())} left`;
      return `${fmt.format(new Date(s.started_at))} - ${status} (${s.output_tokens} out tokens)`;
    });
    bot.sendMessage(msg.chat.id, `*Recent Sessions*\n${lines.join("\n")}`, { parse_mode: "Markdown" });
  });

  bot.on("polling_error", (err) => {
    console.error("Polling error:", err.message);
  });

  return bot;
}
