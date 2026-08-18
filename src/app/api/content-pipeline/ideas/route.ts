import { NextRequest, NextResponse } from 'next/server';
import {
  readIdeas,
  readStatus,
  mergeIdeaWithStatus,
  appendIdea,
  invalidCellValue,
  DuplicateIdeaError,
  IdeaType,
} from '@/lib/content-pipeline';

export const dynamic = 'force-dynamic';

const IDEA_TYPES: IdeaType[] = ['I', 'B', 'A'];

export async function GET() {
  try {
    const [rawIdeas, status] = await Promise.all([readIdeas(), readStatus()]);
    const ideas = rawIdeas.map((idea) => mergeIdeaWithStatus(idea, status));
    return NextResponse.json({ ideas });
  } catch (error) {
    console.error('Failed to load content-pipeline ideas:', error);
    return NextResponse.json({ error: 'Failed to load ideas' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const type: IdeaType | undefined = body?.type;
    const title: string | undefined = body?.title;
    const meta: string = typeof body?.meta === 'string' ? body.meta : '';
    const extra: Record<string, string> =
      body?.extra && typeof body.extra === 'object' ? body.extra : {};

    if (!type || !IDEA_TYPES.includes(type)) {
      return NextResponse.json({ error: '타입은 I, B, A 중 하나여야 합니다' }, { status: 400 });
    }
    if (!title || !title.trim()) {
      return NextResponse.json({ error: '제목을 입력해주세요' }, { status: 400 });
    }

    for (const [label, value] of [['제목', title], ['meta', meta], ...Object.entries(extra)]) {
      if (typeof value !== 'string') {
        return NextResponse.json({ error: `${label}: 문자열이어야 합니다` }, { status: 400 });
      }
      const reason = invalidCellValue(value);
      if (reason) {
        return NextResponse.json({ error: `${label}: ${reason}` }, { status: 400 });
      }
    }

    const idea = await appendIdea({ type, title, meta, extra });
    return NextResponse.json({ ...idea, status: 'idle' });
  } catch (error) {
    if (error instanceof DuplicateIdeaError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Failed to append content-pipeline idea:', error);
    return NextResponse.json({ error: '소재 등록에 실패했습니다' }, { status: 500 });
  }
}
