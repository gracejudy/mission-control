import { NextResponse } from 'next/server';
import { readIdeas, readStatus, mergeIdeaWithStatus } from '@/lib/content-pipeline';

export const dynamic = 'force-dynamic';

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
