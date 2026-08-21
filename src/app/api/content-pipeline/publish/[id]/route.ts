import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import { updateStatus, DRAFTS_DIR, resolveInPipelineDir } from '@/lib/content-pipeline';
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
    const title: string | undefined = body?.title;
    const publishedText: string | undefined = body?.publishedText;
    const url: string | undefined = body?.url;

    // 2026-08-21: URL과 제목은 필수(추적/스타일 학습 자료용), 본문은 선택(네이버 에디터 복사가
    // 번거로울 때 생략 가능 — 성과분석 4단계는 제목만으로도 조회수 순위 매칭이 가능함)
    if (!title || !url) {
      return NextResponse.json(
        { error: 'Missing required fields: title, url' },
        { status: 400 }
      );
    }

    const publishedRelPath = path.join('drafts', `${id}-published.txt`);
    let savedPublishedFile: string | undefined;
    if (publishedText) {
      const publishedPath = resolveInPipelineDir(publishedRelPath);
      await fs.mkdir(DRAFTS_DIR, { recursive: true });
      await fs.writeFile(publishedPath, publishedText);
      savedPublishedFile = publishedRelPath;
    }

    const publishedAt = todayKST();
    const entry = await updateStatus(id, {
      status: 'published',
      publishedTitle: title,
      ...(savedPublishedFile ? { publishedFile: savedPublishedFile } : {}),
      publishedUrl: url,
      publishedAt,
    });

    return NextResponse.json({ ideaId: id, ...entry });
  } catch (error) {
    console.error('Failed to publish draft:', error);
    return NextResponse.json({ error: 'Failed to publish draft' }, { status: 500 });
  }
}
