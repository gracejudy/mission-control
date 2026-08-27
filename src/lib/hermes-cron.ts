/**
 * Hermes cron: reads each profile's cron/jobs.json directly (jobs are stored
 * per-profile, one file each) and maps them into the CronJob shape the
 * existing UI (CronJobCard, CronWeeklyTimeline) already expects.
 *
 * Mutations (pause/resume/remove/run) shell out to the `hermes` CLI with
 * HERMES_HOME pointed at the owning profile — there's no safe way to hand-edit
 * jobs.json directly, since the live gateway process (ai.hermes.gateway*)
 * holds its own lock on it (see cron/.jobs.lock next to jobs.json).
 */
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { listWorkspaces, type HermesWorkspace } from "./hermes-workspace";

const execFileAsync = promisify(execFile);

export const HERMES_BIN = process.env.HERMES_BIN || `${process.env.HOME}/.local/bin/hermes`;

interface RawHermesSchedule {
  kind?: string;
  expr?: string;
  display?: string;
  everyMs?: number;
  at?: string;
  [key: string]: unknown;
}

interface RawHermesJob {
  id: string;
  name?: string;
  prompt?: string;
  skill?: string | null;
  skills?: string[];
  script?: string | null;
  no_agent?: boolean;
  schedule?: RawHermesSchedule;
  schedule_display?: string;
  enabled?: boolean;
  next_run_at?: string | null;
  last_run_at?: string | null;
  last_status?: string | null;
  last_error?: string | null;
}

export interface CronJob {
  id: string;
  agentId: string;
  name: string;
  description: string;
  schedule: string | Record<string, unknown>;
  scheduleDisplay: string;
  timezone: string;
  enabled: boolean;
  nextRun: string | null;
  lastRun: string | null;
  sessionTarget: string;
  payload: Record<string, unknown>;
  // Mirrors CronJobCard's CronJob shape (see components/CronJobCard.tsx) — kept as a
  // separate declaration here rather than a shared import, matching how this file
  // already predates that split. Hermes jobs just set `source`; capability flags stay
  // undefined so CronJobCard's `!== false` checks default them to allowed, unchanged.
  source?: "hermes" | "crontab" | "launchd";
  canToggle?: boolean;
  canRun?: boolean;
  canDelete?: boolean;
}

function jobsPath(profilePath: string): string {
  return path.join(profilePath, "cron", "jobs.json");
}

function readProfileJobs(profilePath: string): RawHermesJob[] {
  try {
    const raw = fs.readFileSync(jobsPath(profilePath), "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data.jobs) ? data.jobs : [];
  } catch {
    return [];
  }
}

function mapJob(profile: HermesWorkspace, job: RawHermesJob): CronJob {
  const sessionTarget = job.no_agent
    ? `script: ${job.script || "?"}`
    : job.skill || job.skills?.join(", ") || (job.script ? `script: ${job.script}` : "agent");

  return {
    id: job.id,
    agentId: profile.id === "default" ? "default" : profile.id.replace(/^profiles\//, ""),
    name: job.name || job.id,
    description: job.prompt || sessionTarget,
    schedule: job.schedule || {},
    scheduleDisplay: job.schedule_display || job.schedule?.display || job.schedule?.expr || "?",
    timezone: "Asia/Seoul",
    enabled: job.enabled ?? true,
    nextRun: job.next_run_at || null,
    lastRun: job.last_run_at || null,
    sessionTarget,
    payload: { profile: profile.id, ...job },
    source: "hermes",
  };
}

/** All cron jobs across every Hermes profile, flattened for the UI. */
export function listAllCronJobs(): CronJob[] {
  const jobs: CronJob[] = [];
  for (const profile of listWorkspaces()) {
    for (const raw of readProfileJobs(profile.path)) {
      jobs.push(mapJob(profile, raw));
    }
  }
  return jobs;
}

/** Which profile owns a given job id — needed to set HERMES_HOME for CLI calls. */
export function findJobProfile(id: string): HermesWorkspace | null {
  for (const profile of listWorkspaces()) {
    if (readProfileJobs(profile.path).some((j) => j.id === id)) return profile;
  }
  return null;
}

/** Path to a job's run-output directory (one .md file per run, no_agent jobs only). */
export function jobOutputDir(profilePath: string, id: string): string {
  return path.join(profilePath, "cron", "output", id);
}

export async function runHermesCron(profilePath: string, args: string[], timeout = 15000): Promise<string> {
  const { stdout } = await execFileAsync(HERMES_BIN, ["cron", ...args], {
    timeout,
    env: { ...process.env, HERMES_HOME: profilePath },
  });
  return stdout;
}
