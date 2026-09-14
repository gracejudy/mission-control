import { NextRequest, NextResponse } from 'next/server';
import { updateStatus } from '@/lib/content-pipeline';

export const dynamic = 'force-dynamic';

/** Phase 2 — computeSuggestions()가 채운 suggestedActionNeeded를 사람이 무시("아니다")할 때 지운다. 실제 actionNeeded는 건드리지 않는다. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const entry = await updateStatus(id, { suggestedActionNeeded: undefined });
    return NextResponse.json({ ideaId: id, ...entry });
  } catch (error) {
    console.error('Failed to dismiss suggested actionNeeded:', error);
    return NextResponse.json({ error: 'Failed to dismiss suggestion' }, { status: 500 });
  }
}
