import { NextRequest, NextResponse } from 'next/server';
import { deleteIdea, IdeaNotDeletableError } from '@/lib/content-pipeline';

export const dynamic = 'force-dynamic';

/** 2026-10-19: 상태 무관 소재 삭제(10-06 초안 한정에서 확장) — 처리 방식(행 삭제·초안 보관·status 흔적)은 deleteIdea 참고. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // id는 ideas.md 행 매칭 정규식에 들어가므로 형식을 먼저 고정한다.
  if (!/^[IBA]\d+$/.test(id)) {
    return NextResponse.json({ error: `잘못된 소재 ID: ${id}` }, { status: 400 });
  }
  try {
    return NextResponse.json(await deleteIdea(id));
  } catch (error) {
    if (error instanceof IdeaNotDeletableError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Failed to delete content-pipeline idea:', error);
    const message = error instanceof Error ? error.message : '소재 삭제에 실패했습니다';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
