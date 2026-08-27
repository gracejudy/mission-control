import { NextRequest, NextResponse } from "next/server";
import { listAllCronJobs, findJobProfile, runHermesCron } from "@/lib/hermes-cron";
import { listSystemJobs, launchdSetPaused } from "@/lib/system-cron";

// GET: List all cron jobs — Hermes profiles' cron/jobs.json (mutable from this
// UI) plus macOS crontab/launchd jobs (read-only — see system-cron.ts for why).
export async function GET() {
  try {
    const [hermesJobs, systemJobs] = await Promise.all([
      Promise.resolve(listAllCronJobs()),
      listSystemJobs(),
    ]);
    return NextResponse.json([...hermesJobs, ...systemJobs]);
  } catch (error) {
    console.error("Error reading cron jobs:", error);
    return NextResponse.json(
      { error: "Failed to read cron jobs" },
      { status: 500 }
    );
  }
}

// PUT: Pause/resume a cron job (Hermes has no direct enable/disable — it's pause/resume)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, enabled } = body;

    if (!id || typeof id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(id)) {
      return NextResponse.json({ error: "Valid job ID is required" }, { status: 400 });
    }

    if (id.startsWith("launchd-")) {
      await launchdSetPaused(id, !enabled);
      return NextResponse.json({ success: true, id, enabled });
    }
    if (id.startsWith("cron-")) {
      return NextResponse.json({ error: "crontab jobs can't be paused from here" }, { status: 400 });
    }

    const profile = findJobProfile(id);
    if (!profile) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    await runHermesCron(profile.path, [enabled ? "resume" : "pause", id]);

    return NextResponse.json({ success: true, id, enabled });
  } catch (error) {
    console.error("Error updating cron job:", error);
    return NextResponse.json(
      { error: "Failed to update cron job" },
      { status: 500 }
    );
  }
}

// DELETE: Remove a cron job
export async function DELETE(request: NextRequest) {
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

    await runHermesCron(profile.path, ["remove", id]);

    return NextResponse.json({ success: true, deleted: id });
  } catch (error) {
    console.error("Error deleting cron job:", error);
    return NextResponse.json(
      { error: "Failed to delete cron job" },
      { status: 500 }
    );
  }
}
