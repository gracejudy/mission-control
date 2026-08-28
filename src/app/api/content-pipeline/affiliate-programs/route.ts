import { NextRequest, NextResponse } from 'next/server';
import { readAffiliatePrograms, addAffiliateProgram } from '@/lib/content-pipeline';

export const dynamic = 'force-dynamic';

export async function GET() {
  const programs = await readAffiliatePrograms();
  return NextResponse.json({ programs });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name: string | undefined = typeof body?.name === 'string' ? body.name : undefined;
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Missing required field: name' }, { status: 400 });
    }
    const programs = await addAffiliateProgram(name);
    return NextResponse.json({ programs });
  } catch (error) {
    console.error('Failed to add affiliate program:', error);
    return NextResponse.json({ error: 'Failed to add affiliate program' }, { status: 500 });
  }
}
