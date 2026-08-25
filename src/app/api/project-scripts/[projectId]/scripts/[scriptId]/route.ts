import { NextResponse } from "next/server";
import { findScript, deleteScript } from "@/lib/project-scripts";

export const dynamic = "force-dynamic";

// DELETE: 등록된 스크립트 카드 삭제
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; scriptId: string }> }
) {
  try {
    const { projectId, scriptId } = await params;
    if (!findScript(projectId, scriptId)) {
      return NextResponse.json({ error: "Script not found" }, { status: 404 });
    }
    deleteScript(projectId, scriptId);
    return NextResponse.json({ success: true, deleted: scriptId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete script";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
