import { NextRequest, NextResponse } from 'next/server';
import {
  ImprovementRequestError,
  queueImprovementRequest,
  setImprovementDecision,
} from '@/lib/content-pipeline-improvements';

export const dynamic = 'force-dynamic';

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof ImprovementRequestError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(fallback, error);
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status: 500 });
}

/** 발행글 개선 제안 요청 — 라이브 글을 다시 읽어 스냅샷을 남기고 tasks/ 큐에 넣는다. 처리는 queue-watcher가 한다(자동처리 ON + 09~16시). */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const meta = await queueImprovementRequest(id);
    return NextResponse.json({ ideaId: id, requestTs: meta.requestTs, requestedAt: meta.requestedAt });
  } catch (error) {
    return errorResponse(error, 'Failed to queue improvement request');
  }
}

/** 제안 항목 하나를 적용/무시로 표시. body: { requestTs, itemId, decision: "applied" | "dismissed" | null } */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const requestTs = typeof body?.requestTs === 'string' ? body.requestTs : '';
    const itemId = typeof body?.itemId === 'string' ? body.itemId : '';
    const decision = body?.decision;
    if (!requestTs || !itemId) {
      return NextResponse.json({ error: 'requestTs와 itemId가 필요합니다' }, { status: 400 });
    }
    if (decision !== 'applied' && decision !== 'dismissed' && decision !== null) {
      return NextResponse.json({ error: 'decision은 applied, dismissed, null 중 하나여야 합니다' }, { status: 400 });
    }
    const meta = await setImprovementDecision(id, requestTs, itemId, decision);
    return NextResponse.json({ ideaId: id, decisions: meta.decisions });
  } catch (error) {
    return errorResponse(error, 'Failed to update improvement decision');
  }
}
