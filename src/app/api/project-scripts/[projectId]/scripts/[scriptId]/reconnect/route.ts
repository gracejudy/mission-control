import { NextResponse } from "next/server";
import { findScript, reconnectScript } from "@/lib/project-scripts";

export const dynamic = "force-dynamic";

// POST: 스크립트 파일 변경을 확인했다는 뜻으로 저장된 해시를 현재 파일로 갱신
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; scriptId: string }> }
) {
  try {
    const { projectId, scriptId } = await params;
    if (!findScript(projectId, scriptId)) {
      return NextResponse.json({ error: "Script not found" }, { status: 404 });
    }
    const script = reconnectScript(projectId, scriptId);
    return NextResponse.json({ success: true, script });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reconnect script";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
