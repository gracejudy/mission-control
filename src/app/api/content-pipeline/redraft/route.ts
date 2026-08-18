import { NextRequest, NextResponse } from 'next/server';
import { readIdeas, readStatus, queueDraftRequest, deleteFileIfExists } from '@/lib/content-pipeline';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ideaId: string | undefined = body?.ideaId;
    if (!ideaId) {
      return NextResponse.json({ error: 'Missing required field: ideaId' }, { status: 400 });
    }

    const ideas = await readIdeas();
    const idea = ideas.find((i) => i.id === ideaId);
    if (!idea) {
      return NextResponse.json({ error: `Unknown ideaId: ${ideaId}` }, { status: 404 });
    }

    const status = await readStatus();
    const entry = status[ideaId];
    if (!entry || entry.status !== 'draft') {
      return NextResponse.json(
        { error: `재발행은 초안이 있을 때만 가능 (현재 상태: ${entry?.status ?? 'idle'})` },
        { status: 409 }
      );
    }

    await deleteFileIfExists(entry.draftFile);
    await deleteFileIfExists(entry.evaluationFile);
    const { requestedAt } = await queueDraftRequest(idea);
    return NextResponse.json({ ideaId, status: 'requested', requestedAt });
  } catch (error) {
    console.error('Failed to redraft:', error);
    return NextResponse.json({ error: 'Failed to redraft' }, { status: 500 });
  }
}
