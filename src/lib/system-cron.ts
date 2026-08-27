/**
 * System-level scheduled jobs — macOS `crontab` + `~/Library/LaunchAgents/*.plist`.
 *
 * Unlike Hermes jobs (hermes-cron.ts) these don't share one safe mutation story, so
 * capability is granted per source, not blanket read-only:
 *   - crontab: run-now only. Toggling would mean rewriting the *whole* crontab file,
 *     which can hang this machine on a macOS permission prompt (hit this directly
 *     while building this feature) — too risky for a UI button.
 *   - launchd: run-now (`launchctl kickstart`) AND pause/resume (`launchctl unload`/
 *     `load` + persisting the plist's Disabled key) — both are the exact commands
 *     already used by hand on this machine for these jobs, just wired to a button.
 *   - Neither ever exposes delete — removing a crontab line or a plist file is a
 *     bigger step than "pause", and nobody asked for it.
 * Everything maps into the same CronJob shape Hermes jobs use (schedule:
 * {kind:"cron"|"every", ...}) so the existing Cards/Timeline views need no changes.
 */
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getNextRuns } from "./cron-parser";
import type { CronJob } from "@/components/CronJobCard";

const execFileAsync = promisify(execFile);

function shortId(prefix: string, input: string): string {
  return `${prefix}-${crypto.createHash("sha256").update(input).digest("hex").slice(0, 12)}`;
}

// ── crontab -l ───────────────────────────────────────────────────────────

// 5 whitespace-separated schedule fields, then the rest of the line as the command.
const CRON_LINE_RE = /^(\S+\s+\S+\s+\S+\s+\S+\s+\S+)\s+(.+)$/;

interface ParsedCrontabLine {
  id: string;
  rawLine: string;
  expr: string;
  command: string;
  name: string;
  description: string;
}

function parseCrontabLines(raw: string): ParsedCrontabLine[] {
  const lines: ParsedCrontabLine[] = [];
  let pendingComment: string[] = [];

  for (const rawLine of raw.split("\n")) {
    const line = rawLine.trim();

    if (line === "") {
      // A blank line breaks the "comment directly above its job" convention
      // this crontab follows — don't let an unrelated comment attach to the next job.
      pendingComment = [];
      continue;
    }
    if (line.startsWith("#")) {
      pendingComment.push(line.replace(/^#\s*/, ""));
      continue;
    }

    const m = line.match(CRON_LINE_RE);
    if (!m) {
      pendingComment = [];
      continue;
    }
    const [, expr, command] = m;
    const description = pendingComment.length > 0 ? pendingComment.join(" ") : command;
    const name = pendingComment[0] || command.split(/\s+/).slice(0, 4).join(" ");

    lines.push({ id: shortId("cron", rawLine), rawLine, expr, command, name, description });
    pendingComment = [];
  }

  return lines;
}

async function readCrontabRaw(): Promise<string> {
  try {
    const { stdout } = await execFileAsync("crontab", ["-l"]);
    return stdout;
  } catch {
    // `crontab -l` exits non-zero when there's no crontab installed for this user.
    return "";
  }
}

export async function listCrontabJobs(): Promise<CronJob[]> {
  const parsed = parseCrontabLines(await readCrontabRaw());

  return parsed.map((p) => {
    const nextRun = getNextRuns(p.expr, 1)[0];
    return {
      id: p.id,
      agentId: "system",
      name: p.name,
      description: p.description,
      schedule: { kind: "cron", expr: p.expr },
      scheduleDisplay: p.expr,
      timezone: "Asia/Seoul",
      enabled: true,
      nextRun: nextRun ? nextRun.toISOString() : null,
      lastRun: null,
      sessionTarget: p.command,
      payload: { source: "crontab", command: p.command },
      source: "crontab",
      canToggle: false,
      canRun: true,
      canDelete: false,
    };
  });
}

/** Run one crontab job's command immediately, exactly as cron would invoke it. */
export async function runCrontabJob(id: string): Promise<string> {
  const parsed = parseCrontabLines(await readCrontabRaw());
  const job = parsed.find((p) => p.id === id);
  if (!job) throw new Error("Crontab job not found (crontab may have changed since the page loaded)");

  // These lines use shell features (`cd ... &&`, redirections) — exec through a
  // shell rather than execFile, same as cron itself does. The command isn't
  // user-supplied at request time, it's whatever this machine already runs
  // automatically on its own schedule.
  const { exec } = await import("child_process");
  const execAsync = promisify(exec);
  const { stdout, stderr } = await execAsync(job.command, { timeout: 120_000, maxBuffer: 1024 * 1024 });
  return (stdout || stderr || "").trim() || "Job ran with no output";
}

// ── ~/Library/LaunchAgents/*.plist ──────────────────────────────────────

interface PlistCalendarInterval {
  Minute?: number;
  Hour?: number;
  Day?: number;
  Month?: number;
  Weekday?: number;
}

interface PlistData {
  Label?: string;
  ProgramArguments?: string[];
  Program?: string;
  StartCalendarInterval?: PlistCalendarInterval | PlistCalendarInterval[];
  StartInterval?: number;
  Disabled?: boolean;
}

const LAUNCH_AGENTS_DIR = path.join(process.env.HOME || "", "Library", "LaunchAgents");

async function readPlistJson(filePath: string): Promise<PlistData | null> {
  try {
    // plutil ships with macOS — no npm plist parser needed. `-o -` writes to
    // stdout instead of overwriting the file, so listing is a pure read.
    const { stdout } = await execFileAsync("plutil", ["-convert", "json", "-o", "-", filePath]);
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

function calendarIntervalToCronExpr(iv: PlistCalendarInterval): string {
  const minute = iv.Minute != null ? String(iv.Minute) : "*";
  const hour = iv.Hour != null ? String(iv.Hour) : "*";
  const day = iv.Day != null ? String(iv.Day) : "*";
  const month = iv.Month != null ? String(iv.Month) : "*";
  const weekday = iv.Weekday != null ? String(iv.Weekday) : "*";
  return `${minute} ${hour} ${day} ${month} ${weekday}`;
}

interface ParsedLaunchdJob {
  id: string;
  label: string;
  plistPath: string;
  command: string;
  enabled: boolean;
  scheduleKind: "cron" | "every";
  exprs: string[];
  everyMs?: number;
}

async function listLaunchdRaw(): Promise<ParsedLaunchdJob[]> {
  let files: string[] = [];
  try {
    // Exact ".plist" suffix — naturally excludes the ".plist.disabled" /
    // ".plist.bak-*" files this machine accumulates from past migrations.
    files = fs.readdirSync(LAUNCH_AGENTS_DIR).filter((f) => f.endsWith(".plist"));
  } catch {
    return [];
  }

  const jobs: ParsedLaunchdJob[] = [];

  for (const file of files) {
    const plistPath = path.join(LAUNCH_AGENTS_DIR, file);
    const data = await readPlistJson(plistPath);
    if (!data) continue;
    // No schedule key at all = a KeepAlive daemon (kept running, not "run on a
    // schedule") — out of scope for a *cron* jobs page.
    if (!data.StartCalendarInterval && !data.StartInterval) continue;

    const command = data.Program || (data.ProgramArguments || []).join(" ") || "?";
    const label = data.Label || file.replace(/\.plist$/, "");
    const enabled = data.Disabled !== true;

    if (data.StartCalendarInterval) {
      const intervals = Array.isArray(data.StartCalendarInterval)
        ? data.StartCalendarInterval
        : [data.StartCalendarInterval];
      jobs.push({
        id: shortId("launchd", label),
        label,
        plistPath,
        command,
        enabled,
        scheduleKind: "cron",
        exprs: intervals.map(calendarIntervalToCronExpr),
      });
    } else if (data.StartInterval) {
      jobs.push({
        id: shortId("launchd", label),
        label,
        plistPath,
        command,
        enabled,
        scheduleKind: "every",
        exprs: [],
        everyMs: data.StartInterval * 1000,
      });
    }
  }

  return jobs;
}

export async function listLaunchdJobs(): Promise<CronJob[]> {
  const raw = await listLaunchdRaw();

  return raw.map((j) => {
    if (j.scheduleKind === "cron") {
      const nextRuns = j.exprs
        .map((e) => getNextRuns(e, 1)[0])
        .filter((d): d is Date => !!d)
        .sort((a, b) => a.getTime() - b.getTime());

      return {
        id: j.id,
        agentId: "system",
        name: j.label,
        description: j.exprs.length > 1 ? `${j.command} (하루 ${j.exprs.length}회)` : j.command,
        schedule: { kind: "cron", expr: j.exprs[0] },
        scheduleDisplay: j.exprs.length > 1 ? j.exprs.join(" | ") : j.exprs[0],
        timezone: "Asia/Seoul",
        enabled: j.enabled,
        nextRun: nextRuns[0] ? nextRuns[0].toISOString() : null,
        lastRun: null,
        sessionTarget: j.command,
        payload: { source: "launchd", command: j.command, plistPath: j.plistPath, label: j.label },
        source: "launchd" as const,
        canToggle: true,
        canRun: true,
        canDelete: false,
      };
    }

    return {
      id: j.id,
      agentId: "system",
      name: j.label,
      description: j.command,
      schedule: { kind: "every", everyMs: j.everyMs },
      scheduleDisplay: `Every ${(j.everyMs || 0) / 1000}s`,
      timezone: "Asia/Seoul",
      enabled: j.enabled,
      nextRun: null,
      lastRun: null,
      sessionTarget: j.command,
      payload: { source: "launchd", command: j.command, plistPath: j.plistPath, label: j.label },
      source: "launchd" as const,
      canToggle: true,
      canRun: true,
      canDelete: false,
    };
  });
}

function currentGuiDomain(): string {
  return `gui/${process.getuid ? process.getuid() : 501}`;
}

/** Force a loaded launchd job to run right now. Doesn't touch its schedule/config. */
export async function launchdRunNow(id: string): Promise<string> {
  const jobs = await listLaunchdRaw();
  const job = jobs.find((j) => j.id === id);
  if (!job) throw new Error("launchd job not found (it may have been added/removed since the page loaded)");

  await execFileAsync("launchctl", ["kickstart", "-k", `${currentGuiDomain()}/${job.label}`]);
  return `Kickstarted ${job.label}`;
}

/**
 * Pause or resume a launchd job: persist Disabled in the plist (survives reboot/
 * relogin, same as `defaults write ... Disabled` would) and unload/load it so the
 * effect is immediate. This is a real launchctl operation on a real running agent —
 * not the lightweight jobs.json flag flip Hermes pause/resume does.
 */
export async function launchdSetPaused(id: string, paused: boolean): Promise<void> {
  const jobs = await listLaunchdRaw();
  const job = jobs.find((j) => j.id === id);
  if (!job) throw new Error("launchd job not found (it may have been added/removed since the page loaded)");

  if (paused) {
    // Unload first — plutil can edit a plist whether or not it's loaded, but
    // unloading first avoids launchd racing a in-flight run against the edit.
    await execFileAsync("launchctl", ["unload", job.plistPath]).catch(() => {});
    await execFileAsync("plutil", ["-replace", "Disabled", "-bool", "true", job.plistPath]);
  } else {
    await execFileAsync("plutil", ["-replace", "Disabled", "-bool", "false", job.plistPath]);
    await execFileAsync("launchctl", ["load", job.plistPath]);
  }
}

/** All system-level scheduled jobs — crontab lines + launchd plists with a real schedule. */
export async function listSystemJobs(): Promise<CronJob[]> {
  const [crontabJobs, launchdJobs] = await Promise.all([listCrontabJobs(), listLaunchdJobs()]);
  return [...crontabJobs, ...launchdJobs];
}
