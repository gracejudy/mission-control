import { NextRequest, NextResponse } from 'next/server';
import { updateStatus } from '@/lib/content-pipeline';

export const dynamic = 'force-dynamic';

/** 주간 성과 리뷰에서 세팅된 actionNeeded 플래그를 지운다(사람이 처리 완료 표시). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const entry = await updateStatus(id, { actionNeeded: undefined });
    return NextResponse.json({ ideaId: id, ...entry });
  } catch (error) {
    console.error('Failed to clear actionNeeded:', error);
    return NextResponse.json({ error: 'Failed to clear actionNeeded' }, { status: 500 });
  }
}
