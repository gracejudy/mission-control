import { NextResponse } from "next/server";
import { findProject, deleteProject } from "@/lib/project-scripts";

export const dynamic = "force-dynamic";

// DELETE: 프로젝트(탭)와 그 안의 등록 스크립트 전체 삭제
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const project = findProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    deleteProject(projectId);
    return NextResponse.json({ success: true, deleted: projectId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
