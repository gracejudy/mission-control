import { NextRequest, NextResponse } from 'next/server';
import { readIdeas, readStatus, queueDraftRequest } from '@/lib/content-pipeline';

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
    const currentStatus = status[ideaId]?.status ?? 'idle';
    if (currentStatus !== 'idle') {
      return NextResponse.json(
        { error: `Idea ${ideaId} is already ${currentStatus}` },
        { status: 409 }
      );
    }

    const { requestedAt } = await queueDraftRequest(idea);
    return NextResponse.json({ ideaId, status: 'requested', requestedAt });
  } catch (error) {
    console.error('Failed to request draft:', error);
    return NextResponse.json({ error: 'Failed to request draft' }, { status: 500 });
  }
}
