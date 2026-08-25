import { NextRequest, NextResponse } from "next/server";
import { findProject, findScript, runScript } from "@/lib/project-scripts";

export const dynamic = "force-dynamic";

// POST: 등록된 스크립트를 실제로 실행 (동기 응답 — 완료까지 대기)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, scriptId, values } = body as {
      projectId?: string;
      scriptId?: string;
      values?: Record<string, unknown>;
    };

    if (!projectId || !scriptId) {
      return NextResponse.json({ error: "projectId, scriptId는 필수입니다" }, { status: 400 });
    }
    if (!findProject(projectId)) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (!findScript(projectId, scriptId)) {
      return NextResponse.json({ error: "Script not found" }, { status: 404 });
    }

    const result = await runScript(projectId, scriptId, values ?? {});
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to run script";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
