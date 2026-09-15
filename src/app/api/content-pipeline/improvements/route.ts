import { NextResponse } from 'next/server';
import { readLatestImprovementRuns } from '@/lib/content-pipeline-improvements';

export const dynamic = 'force-dynamic';

/** 발행글별 가장 최근 개선 제안 요청 상태(requested/failed/done) + 결과 + 적용/무시 결정. */
export async function GET() {
  try {
    const runs = await readLatestImprovementRuns();
    return NextResponse.json({ runs });
  } catch (error) {
    console.error('Failed to load improvement suggestions:', error);
    return NextResponse.json({ error: 'Failed to load improvement suggestions' }, { status: 500 });
  }
}
