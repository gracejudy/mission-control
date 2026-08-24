import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import { updateStatus, DRAFTS_DIR, resolveInPipelineDir, fetchNaverPost } from '@/lib/content-pipeline';
import path from 'path';

export const dynamic = 'force-dynamic';

function todayKST(): string {
  return new Date().toLocaleDateString('sv', { timeZone: 'Asia/Seoul' });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const url: string | undefined = body?.url;

    if (!url) {
      return NextResponse.json({ error: 'Missing required field: url' }, { status: 400 });
    }

    // 2026-08-24: URL만 받아 제목·본문을 직접 수집한다 — 예전엔 제목 필수 입력 + 본문을
    // 사람이 네이버 에디터에서 복사해 붙여넣었는데(blog.naver.com이 막혀 있다는 착각 때문;
    // 실제로는 robots.txt의 AI크롤러 차단을 WebFetch가 준수해서 우리 쪽 도구만 막혀 있었을 뿐
    // 서버 봇탐지는 없었다), 이제 URL 하나로 실제 발행 제목·본문을 그대로 가져온다.
    const { title, text } = await fetchNaverPost(url);

    const publishedRelPath = path.join('drafts', `${id}-published.txt`);
    const publishedPath = resolveInPipelineDir(publishedRelPath);
    await fs.mkdir(DRAFTS_DIR, { recursive: true });
    await fs.writeFile(publishedPath, text);

    const publishedAt = todayKST();
    const entry = await updateStatus(id, {
      status: 'published',
      publishedTitle: title,
      publishedFile: publishedRelPath,
      publishedUrl: url,
      publishedAt,
    });

    return NextResponse.json({ ideaId: id, ...entry });
  } catch (error) {
    console.error('Failed to publish draft:', error);
    const message = error instanceof Error ? error.message : 'Failed to publish draft';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
