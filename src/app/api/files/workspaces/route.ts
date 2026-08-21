import { NextResponse } from 'next/server';
import { listWorkspaces } from '@/lib/hermes-workspace';

export async function GET() {
  try {
    return NextResponse.json({ workspaces: listWorkspaces() });
  } catch (error) {
    console.error('Failed to list workspaces:', error);
    return NextResponse.json({ workspaces: [] }, { status: 500 });
  }
}
