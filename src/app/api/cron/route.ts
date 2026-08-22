import { NextRequest, NextResponse } from "next/server";
import { listAllCronJobs, findJobProfile, runHermesCron } from "@/lib/hermes-cron";

// GET: List all cron jobs across every Hermes profile — read directly from
// each profile's cron/jobs.json (fast, no CLI dependency for the common path).
export async function GET() {
  try {
    return NextResponse.json(listAllCronJobs());
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
