import { NextRequest, NextResponse } from "next/server";
import { findProject, addScript, type ParamType, type ScriptParam } from "@/lib/project-scripts";

export const dynamic = "force-dynamic";

const VALID_TYPES: ParamType[] = ["text", "number", "date", "select", "flag"];

function parseParams(raw: unknown): ScriptParam[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
    .map((p) => {
      const key = String(p.key ?? "").trim();
      const label = String(p.label ?? key).trim();
      const flag = String(p.flag ?? "").trim();
      const type = VALID_TYPES.includes(p.type as ParamType) ? (p.type as ParamType) : "text";
      const options = Array.isArray(p.options) ? p.options.map((o) => String(o)) : undefined;
      const param: ScriptParam = { key, label, flag, type };
      if (options) param.options = options;
      if (p.default !== undefined && p.default !== "") param.default = p.default as string | number | boolean;
      if (p.placeholder) param.placeholder = String(p.placeholder);
      if (p.argStyle === "space") param.argStyle = "space";
      if (p.required === true) param.required = true;
      if (typeof p.min === "number") param.min = p.min;
      if (typeof p.max === "number") param.max = p.max;
      if (typeof p.pattern === "string" && p.pattern) param.pattern = p.pattern;
      if (typeof p.patternMessage === "string" && p.patternMessage) param.patternMessage = p.patternMessage;
      return param;
    })
    .filter((p) => p.key && p.flag);
}

// POST: 프로젝트에 새 스크립트 카드 등록
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    if (!findProject(projectId)) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const command = typeof body.command === "string" ? body.command.trim() : "";
    const baseArgs = Array.isArray(body.baseArgs)
      ? body.baseArgs.map((a: unknown) => String(a)).filter(Boolean)
      : typeof body.baseArgs === "string"
        ? body.baseArgs.trim().split(/\s+/).filter(Boolean)
        : [];

    if (!name) return NextResponse.json({ error: "스크립트 이름은 필수입니다" }, { status: 400 });
    if (!command) return NextResponse.json({ error: "실행 커맨드는 필수입니다 (예: node)" }, { status: 400 });
    if (baseArgs.length === 0) {
      return NextResponse.json({ error: "실행 파일 경로가 필요합니다 (예: scripts/check_orders.js)" }, { status: 400 });
    }

    const script = addScript(projectId, {
      name,
      description: typeof body.description === "string" ? body.description.trim() : "",
      command,
      baseArgs,
      params: parseParams(body.params),
      confirmBeforeRun: Boolean(body.confirmBeforeRun),
    });

    return NextResponse.json({ success: true, script });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add script";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
