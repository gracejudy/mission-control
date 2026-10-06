import { NextRequest, NextResponse } from 'next/server';
import {
  readIdeas,
  readStatus,
  readStrategy,
  mergeIdeaWithStatus,
  appendIdea,
  invalidCellValue,
  DuplicateIdeaError,
  IdeaType,
  FetchedNaverPost,
  fetchNaverPost,
  findIdeaByPublishedUrl,
  findIdeaByTitle,
  cancelPendingDraftRequests,
  recordPublishedPost,
} from '@/lib/content-pipeline';

export const dynamic = 'force-dynamic';

const IDEA_TYPES: IdeaType[] = ['I', 'B', 'A'];

export async function GET() {
  try {
    const [rawIdeas, status, strategy] = await Promise.all([readIdeas(), readStatus(), readStrategy()]);
    const ideas = rawIdeas.map((idea) => ({
      ...mergeIdeaWithStatus(idea, status),
      strategy: strategy[idea.id] ?? null,
    }));
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

    // 2026-10-05: 발행글 등록 — publishedUrl이 있으면 이미 올린 글을 소재로 들이면서 바로
    // published로 기록한다. idle로 두면 초안 요청/자동화 대상으로 잘못 잡히기 때문.
    // 글 수집·중복 확인을 appendIdea 전에 끝내서, 실패 시 ideas.md에 빈 소재가 남지 않게 한다.
    const publishedUrl = typeof body?.publishedUrl === 'string' ? body.publishedUrl.trim() : '';
    let post: FetchedNaverPost | null = null;
    if (publishedUrl) {
      let existingId: string | null;
      try {
        existingId = findIdeaByPublishedUrl(await readStatus(), publishedUrl);
      } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'URL 형식 오류' }, { status: 400 });
      }
      if (existingId) {
        return NextResponse.json({ error: `이미 등록된 발행글입니다 (${existingId})` }, { status: 409 });
      }
      try {
        post = await fetchNaverPost(publishedUrl);
      } catch (error) {
        const message = error instanceof Error ? error.message : '발행글을 불러오지 못했습니다';
        return NextResponse.json({ error: message }, { status: 502 });
      }

      // 2026-10-06: 같은 제목의 소재가 이미 있으면 새로 만들지 않고 그 소재에 발행 기록을 붙인다
      // ("소재로 먼저 넣고 글은 나중에 올린" 경우). 대기 중인 초안 요청은 발행된 글의 초안을 새로
      // 쓰게 되므로 함께 지운다. 이미 다른 글로 발행된 소재면 덮어쓰지 않고 거부한다.
      const linked = await findIdeaByTitle(post.title);
      if (linked) {
        if (linked.status === 'published') {
          return NextResponse.json(
            { error: `같은 제목의 소재(${linked.id})가 이미 다른 글로 발행완료 상태입니다` },
            { status: 409 }
          );
        }
        const cancelled = await cancelPendingDraftRequests(linked.id);
        const entry = await recordPublishedPost(linked.id, publishedUrl, post, { publishedAt: post.publishedAt });
        return NextResponse.json({ ...linked, ...entry, linked: true, cancelledTasks: cancelled });
      }
    }

    const idea = await appendIdea({ type, title, meta, extra });
    if (!post) return NextResponse.json({ ...idea, status: 'idle' });

    try {
      const entry = await recordPublishedPost(idea.id, publishedUrl, post, { publishedAt: post.publishedAt });
      return NextResponse.json({ ...idea, ...entry });
    } catch (error) {
      console.error('Idea appended but recording published post failed:', error);
      return NextResponse.json(
        { error: `소재(${idea.id})는 추가됐지만 발행 기록(status.json)에 실패했습니다 — 대기 상태로 남아 있습니다` },
        { status: 500 }
      );
    }
  } catch (error) {
    if (error instanceof DuplicateIdeaError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Failed to append content-pipeline idea:', error);
    return NextResponse.json({ error: '소재 등록에 실패했습니다' }, { status: 500 });
  }
}
