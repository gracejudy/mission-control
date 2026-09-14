import { NextRequest, NextResponse } from 'next/server';
import { readStatus, updateStatus } from '@/lib/content-pipeline';

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

/** Phase 2 — computeSuggestions()가 채워둔 suggestedActionNeeded를 사람이 검토 후 실제 actionNeeded로 승격("적용")한다. 자동 승격 없음, 이 호출이 곧 사람의 확정이다. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const status = await readStatus();
    const suggestion = status[id]?.suggestedActionNeeded;
    if (!suggestion) {
      return NextResponse.json({ error: `${id}에 적용 대기 중인 제안이 없습니다` }, { status: 404 });
    }
    const entry = await updateStatus(id, {
      actionNeeded: { type: suggestion.type, reason: suggestion.reason, flaggedAt: new Date().toISOString().slice(0, 10) },
      suggestedActionNeeded: undefined,
    });
    return NextResponse.json({ ideaId: id, ...entry });
  } catch (error) {
    console.error('Failed to apply suggested actionNeeded:', error);
    return NextResponse.json({ error: 'Failed to apply suggestion' }, { status: 500 });
  }
}
