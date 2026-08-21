import { NextResponse } from 'next/server';
import { readAffiliateLinks } from '@/lib/content-pipeline';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await readAffiliateLinks();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to read affiliate links:', error);
    return NextResponse.json({ error: 'Failed to read affiliate links' }, { status: 500 });
  }
}
