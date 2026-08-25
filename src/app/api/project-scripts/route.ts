import { NextRequest, NextResponse } from "next/server";
import { access } from "fs/promises";
import { readRegistry, addProject } from "@/lib/project-scripts";

export const dynamic = "force-dynamic";

// GET: 등록된 프로젝트 + 프로젝트별 스크립트 전체 목록
export async function GET() {
  try {
    return NextResponse.json(readRegistry());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: 새 프로젝트(탭) 등록
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const label = typeof body.label === "string" ? body.label.trim() : "";
    const cwd = typeof body.cwd === "string" ? body.cwd.trim() : "";

    if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
      return NextResponse.json(
        { error: "id는 소문자/숫자/하이픈만 사용할 수 있습니다 (예: coupang-lister)" },
        { status: 400 }
      );
    }
    if (!label) {
      return NextResponse.json({ error: "label은 필수입니다" }, { status: 400 });
    }
    if (!cwd || !cwd.startsWith("/")) {
      return NextResponse.json({ error: "cwd는 절대경로여야 합니다" }, { status: 400 });
    }

    try {
      await access(cwd);
    } catch {
      return NextResponse.json({ error: `경로가 존재하지 않습니다: ${cwd}` }, { status: 400 });
    }

    const project = addProject({ id, label, cwd });
    return NextResponse.json({ success: true, project });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add project";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
