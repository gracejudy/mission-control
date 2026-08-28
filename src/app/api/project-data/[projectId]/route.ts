import { NextResponse } from "next/server";
import { getProjectData } from "@/lib/project-data";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  try {
    const data = getProjectData(projectId);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "데이터 조회 실패";
    return NextResponse.json({ available: false, hasContent: false, error: message }, { status: 500 });
  }
}
