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
    const publishedText: string | undefined = body?.publishedText;
    const url: string | undefined = body?.url;

    if (!publishedText || !url) {
      return NextResponse.json(
        { error: 'Missing required fields: publishedText, url' },
        { status: 400 }
      );
    }

    const publishedRelPath = path.join('drafts', `${id}-published.txt`);
    const publishedPath = resolveInPipelineDir(publishedRelPath);
    await fs.mkdir(DRAFTS_DIR, { recursive: true });
    await fs.writeFile(publishedPath, publishedText);

    const publishedAt = todayKST();
    const entry = await updateStatus(id, {
      status: 'published',
      publishedFile: publishedRelPath,
      publishedUrl: url,
      publishedAt,
    });

    return NextResponse.json({ ideaId: id, ...entry });
  } catch (error) {
    console.error('Failed to publish draft:', error);
    return NextResponse.json({ error: 'Failed to publish draft' }, { status: 500 });
  }
}
