import { NextResponse } from 'next/server';
import { readAutomation, isPidAlive, writeAutomation } from '@/lib/content-pipeline';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let state = await readAutomation();
    const alive = isPidAlive(state.pid);

    // Self-heal: state file says enabled but the process is actually gone
    // (e.g. it was killed outside our API, or crashed) — reflect reality.
    if (state.enabled && !alive) {
      state = await writeAutomation({ enabled: false, pid: null, stoppedReason: 'process not found' });
    }

    const remainingMs = state.expiresAt ? new Date(state.expiresAt).getTime() - Date.now() : null;

    return NextResponse.json({
      ...state,
      alive,
      remainingSeconds: remainingMs !== null ? Math.max(Math.round(remainingMs / 1000), 0) : null,
    });
  } catch (error) {
    console.error('Failed to read automation status:', error);
    return NextResponse.json({ error: 'Failed to read automation status' }, { status: 500 });
  }
}
