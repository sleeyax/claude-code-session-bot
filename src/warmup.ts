import { spawn } from "child_process";
import { SESSION_DURATION_MS } from "./config";
import { insertSession } from "./db";
import type { WarmupResult, Session } from "./types";

export function parseWarmupOutput(stdout: string): {
  warmupResult: WarmupResult;
  sessionArgs: Parameters<typeof insertSession>;
} {
  const json = JSON.parse(stdout);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);

  return {
    warmupResult: {
      success: true,
      session_id: json.session_id,
      usage: json.usage,
      cost_usd: json.total_cost_usd,
    },
    sessionArgs: [
      json.session_id ?? "unknown",
      now.toISOString(),
      expiresAt.toISOString(),
      json.usage?.input_tokens ?? 0,
      json.usage?.output_tokens ?? 0,
      json.usage?.cache_creation_input_tokens ?? 0,
      json.usage?.cache_read_input_tokens ?? 0,
      json.total_cost_usd ?? 0,
    ],
  };
}

export function warmup(): Promise<{ result: WarmupResult; session?: Session }> {
  return new Promise((resolve) => {
    const proc = spawn("claude", ["-p", "ready", "--output-format", "json"], {
      timeout: 60_000,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));

    proc.on("close", (code) => {
      if (code !== 0) {
        resolve({
          result: { success: false, error: stderr || `exit code ${code}` },
        });
        return;
      }

      try {
        const { warmupResult, sessionArgs } = parseWarmupOutput(stdout);
        const session = insertSession(...sessionArgs);
        resolve({ result: warmupResult, session });
      } catch {
        resolve({
          result: { success: false, error: `Failed to parse output: ${stdout}` },
        });
      }
    });

    proc.on("error", (err) => {
      resolve({ result: { success: false, error: err.message } });
    });
  });
}
