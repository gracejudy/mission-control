import { NextRequest, NextResponse } from "next/server";
import { findJobProfile, runHermesCron } from "@/lib/hermes-cron";

async function createNotification(title: string, message: string, type: "info" | "success" | "warning" | "error" = "info") {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, message, type }),
    });
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
}

// POST: Trigger a cron job to run immediately (`hermes cron run <id>` runs
// synchronously — for agent-mode jobs this makes a real LLM call and blocks
// until it finishes, so this request can take a while).
export async function POST(request: NextRequest) {
  let id: string | undefined;
  try {
    const body = await request.json();
    id = body.id;

    if (!id || typeof id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(id)) {
      return NextResponse.json({ error: "Valid job ID is required" }, { status: 400 });
    }

    const profile = findJobProfile(id);
    if (!profile) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Agent-mode jobs run synchronously and can take a while (real LLM turn) —
    // give this much more room than the other cron CLI calls (pause/resume/remove).
    const output = await runHermesCron(profile.path, ["run", id], 180000);

    await createNotification(
      "Cron Job Triggered",
      `Job "${id}" was run manually.`,
      "success"
    );

    return NextResponse.json({
      success: true,
      jobId: id,
      message: output.trim() || "Job ran with no output",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to trigger job";
    console.error("Error triggering cron job:", error);

    await createNotification(
      "Cron Job Failed",
      `Failed to run job "${id}": ${message}`,
      "error"
    );

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
