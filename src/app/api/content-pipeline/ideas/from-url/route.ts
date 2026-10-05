import { NextRequest, NextResponse } from 'next/server';
import { fetchNaverPost, findIdeaByPublishedUrl, readStatus } from '@/lib/content-pipeline';

export const dynamic = 'force-dynamic';

/**
 * 2026-10-05: 발행글 등록 — 이미 올린 네이버 글 URL에서 제목·태그·발행일을 읽어 소재 추가 폼을
 * 미리 채우기 위한 조회 전용 엔드포인트. 아무것도 쓰지 않는다; 실제 등록은 POST /ideas에
 * publishedUrl을 실어 보낼 때 일어난다.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = typeof body?.url === 'string' ? body.url.trim() : '';
    if (!url) {
      return NextResponse.json({ error: 'URL을 입력해주세요' }, { status: 400 });
    }

    // URL 형식 오류는 fetch 전에 걸러서 400으로 — 네트워크 실패(500)와 구분.
    let existingId: string | null;
    try {
      existingId = findIdeaByPublishedUrl(await readStatus(), url);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'URL 형식 오류' }, { status: 400 });
    }
    if (existingId) {
      return NextResponse.json({ error: `이미 등록된 발행글입니다 (${existingId})`, existingId }, { status: 409 });
    }

    const post = await fetchNaverPost(url);
    return NextResponse.json({
      url,
      title: post.title,
      tags: post.tags,
      publishedAt: post.publishedAt ?? null,
    });
  } catch (error) {
    console.error('Failed to fetch published post for idea:', error);
    const message = error instanceof Error ? error.message : '발행글을 불러오지 못했습니다';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
