import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { readStatus, DRAFTS_DIR, resolveInPipelineDir } from '@/lib/content-pipeline';

export const dynamic = 'force-dynamic';

async function findDraftPath(id: string): Promise<string | null> {
  const status = await readStatus();
  const draftFile = status[id]?.draftFile;
  if (draftFile) {
    const resolved = resolveInPipelineDir(draftFile);
    try {
      await fs.access(resolved);
      return resolved;
    } catch {
      // fall through to prefix scan
    }
  }

  try {
    const files = await fs.readdir(DRAFTS_DIR);
    const match = files.find(
      (f) => f.startsWith(`${id}-`) && !f.endsWith('-published.txt')
    );
    return match ? path.join(DRAFTS_DIR, match) : null;
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const draftPath = await findDraftPath(id);
    if (!draftPath) {
      return NextResponse.json({ error: `No draft found for ${id}` }, { status: 404 });
    }
    const content = await fs.readFile(draftPath, 'utf-8');

    let evaluation: { filename: string; content: string } | null = null;
    const status = await readStatus();
    const evaluationFile = status[id]?.evaluationFile;
    if (evaluationFile) {
      try {
        const evalPath = resolveInPipelineDir(evaluationFile);
        const evalContent = await fs.readFile(evalPath, 'utf-8');
        evaluation = { filename: path.basename(evalPath), content: evalContent };
      } catch {
        // 평가 파일이 기록돼 있지만 실제로 없으면 조용히 생략 — 초안 자체는 정상 반환
      }
    }

    return NextResponse.json({ filename: path.basename(draftPath), content, evaluation });
  } catch (error) {
    console.error('Failed to read draft:', error);
    return NextResponse.json({ error: 'Failed to read draft' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const content: string | undefined = body?.content;
    if (typeof content !== 'string') {
      return NextResponse.json({ error: 'Missing required field: content' }, { status: 400 });
    }

    const draftPath = await findDraftPath(id);
    if (!draftPath) {
      return NextResponse.json(
        { error: `No draft exists yet for ${id} — nothing to overwrite` },
        { status: 404 }
      );
    }

    await fs.writeFile(draftPath, content);
    return NextResponse.json({ filename: path.basename(draftPath), content });
  } catch (error) {
    console.error('Failed to save draft:', error);
    return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 });
  }
}
