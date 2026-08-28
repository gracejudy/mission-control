import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import {
  readIdeas,
  readStatus,
  queueDraftRequest,
  resolveInPipelineDir,
} from '@/lib/content-pipeline';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ideaId: string | undefined = body?.ideaId;
    const memo: string | undefined = typeof body?.memo === 'string' ? body.memo : undefined;
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

    // 기존 초안을 지침 반영의 기준점으로 쓴다 — 먼저 지우면 "무엇을 고칠지" 잃는다.
    // 처리가 끝나면 같은 경로에 덮어써지므로(queueDraftRequest의 previousDraftFile), 여기서 지울 필요도 없다.
    let previousDraft: string | undefined;
    if (entry.draftFile) {
      try {
        previousDraft = await fs.readFile(resolveInPipelineDir(entry.draftFile), 'utf-8');
      } catch {
        // 파일이 이미 없으면 참고 없이 진행
      }
    }

    const { requestedAt } = await queueDraftRequest(idea, {
      memo,
      previousDraft,
      previousDraftFile: entry.draftFile,
    });
    return NextResponse.json({ ideaId, status: 'requested', requestedAt });
  } catch (error) {
    console.error('Failed to redraft:', error);
    return NextResponse.json({ error: 'Failed to redraft' }, { status: 500 });
  }
}
