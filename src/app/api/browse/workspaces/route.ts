import { NextResponse } from 'next/server';
import { listBrowseWorkspaces } from '@/lib/hermes-workspace';

// Workspace list for the general File Browser (Hermes profiles + ~/brain).
// The Memory page uses /api/files/workspaces instead, which excludes ~/brain
// since it isn't a Hermes memory profile.
export async function GET() {
  try {
    return NextResponse.json({ workspaces: listBrowseWorkspaces() });
  } catch (error) {
    console.error('Failed to list browse workspaces:', error);
    return NextResponse.json({ workspaces: [] }, { status: 500 });
  }
}
