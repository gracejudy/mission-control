import { NextRequest, NextResponse } from 'next/server';
import { updateStatus } from '@/lib/content-pipeline';

export const dynamic = 'force-dynamic';

/**
 * 2026-09-14: publish/[id]는 최초 "발행완료로 표시" 시점에만 호출되고, 그 이후 published
 * 카드에는 affiliateProgram/링크를 고치는 UI 자체가 없었다(편집 모달이 status==="draft"일
 * 때만 열림) — 발행 후에 실제 블로그 글에 제휴링크를 삽입한 경우(예: I4) 이를 기록할 방법이
 * 없던 gap을 메운다. publish API처럼 네이버 글을 재수집하지 않고 status.json 필드만 갱신.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const affiliateProgram: string | undefined =
      typeof body?.affiliateProgram === 'string' && body.affiliateProgram.trim()
        ? body.affiliateProgram.trim()
        : undefined;
    const affiliateLink: string | undefined =
      typeof body?.affiliateLink === 'string' && body.affiliateLink.trim()
        ? body.affiliateLink.trim()
        : undefined;

    if (!affiliateProgram && !affiliateLink) {
      return NextResponse.json(
        { error: 'affiliateProgram 또는 affiliateLink 중 하나는 있어야 합니다' },
        { status: 400 }
      );
    }

    const entry = await updateStatus(id, {
      ...(affiliateProgram ? { affiliateProgram } : {}),
      ...(affiliateLink ? { affiliateLink } : {}),
    });

    return NextResponse.json({ ideaId: id, ...entry });
  } catch (error) {
    console.error('Failed to update affiliate info:', error);
    return NextResponse.json({ error: 'Failed to update affiliate info' }, { status: 500 });
  }
}
