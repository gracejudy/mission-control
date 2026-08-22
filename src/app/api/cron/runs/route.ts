import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { findJobProfile, jobOutputDir } from "@/lib/hermes-cron";

interface RunEntry {
  id: string;
  jobId: string;
  startedAt: string | null;
  completedAt: string | null;
  status: string;
  durationMs: number | null;
  error: string | null;
}

// Hermes doesn't have a `cron runs` CLI command — but no_agent jobs write one
// .md file per run under cron/output/<job_id>/<timestamp>.md, which is enough
// to reconstruct a history list. Agent-mode jobs (no --no-agent) don't write
// these files, so they'll just show no history — nothing to read yet.
const RUN_FILE_RE = /^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\.md$/;

// GET: Fetch run history for a cron job
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
      return NextResponse.json({ error: "Valid job ID is required" }, { status: 400 });
    }

    const profile = findJobProfile(id);
    if (!profile) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const outputDir = jobOutputDir(profile.path, id);
    let files: string[] = [];
    try {
      files = fs.readdirSync(outputDir).filter((f) => RUN_FILE_RE.test(f));
    } catch {
      files = [];
    }

    const runs: RunEntry[] = files
      .sort()
      .reverse()
      .map((file) => {
        const m = file.match(RUN_FILE_RE)!;
        const [, y, mo, d, h, mi, s] = m;
        const startedAt = `${y}-${mo}-${d}T${h}:${mi}:${s}+09:00`;

        let status = "success";
        let error: string | null = null;
        try {
          const content = fs.readFileSync(`${outputDir}/${file}`, "utf-8");
          if (content.includes("**Status:** script failed")) {
            status = "error";
            const match = content.match(/Script exited with code (\d+)/);
            error = match ? `exit code ${match[1]}` : "script failed";
          }
        } catch {
          // leave status as "success" — file listed but unreadable, not worth failing the whole request
        }

        return {
          id: file,
          jobId: id,
          startedAt,
          completedAt: null,
          status,
          durationMs: null,
          error,
        };
      });

    return NextResponse.json({ runs, total: runs.length });
  } catch (error) {
    console.error("Error fetching run history:", error);
    return NextResponse.json({ error: "Failed to fetch run history" }, { status: 500 });
  }
}
