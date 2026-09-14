import { NextResponse } from 'next/server';
import { readIdeas, readStatus, updateStatus, computeSuggestions } from '@/lib/content-pipeline';

export const dynamic = 'force-dynamic';

/** Phase 2(ARCHITECTURE.md) — Signal Bus를 다시 읽어 actionNeeded 제안을 재계산하고 status.json에 반영한다. 사람이 미션보드에서 "제안 새로고침" 버튼으로 수동 트리거. 자동 실행/스케줄 없음. */
export async function POST() {
  try {
    const [ideas, status] = await Promise.all([readIdeas(), readStatus()]);
    const suggestions = await computeSuggestions(ideas, status);

    for (const [id, suggestion] of Object.entries(suggestions)) {
      await updateStatus(id, { suggestedActionNeeded: suggestion });
    }

    return NextResponse.json({ suggested: Object.keys(suggestions).length, ideaIds: Object.keys(suggestions) });
  } catch (error) {
    console.error('Failed to compute action-needed suggestions:', error);
    return NextResponse.json({ error: 'Failed to compute suggestions' }, { status: 500 });
  }
}
