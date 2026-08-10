import { NextResponse } from 'next/server';
import { readAutomation, writeAutomation, isPidAlive } from '@/lib/content-pipeline';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const current = await readAutomation();

    if (current.pid && isPidAlive(current.pid)) {
      try {
        // Negative PID targets the whole process group — spawn() used
        // detached:true, so the watcher (and any claude -p child it's
        // mid-running) is its own group leader and dies together.
        process.kill(-current.pid, 'SIGTERM');
      } catch {
        try {
          process.kill(current.pid, 'SIGTERM');
        } catch {
          // already gone
        }
      }
    }

    const state = await writeAutomation({
      enabled: false,
      pid: null,
      stoppedReason: 'manual',
    });

    return NextResponse.json(state);
  } catch (error) {
    console.error('Failed to stop automation:', error);
    return NextResponse.json({ error: 'Failed to stop automation' }, { status: 500 });
  }
}
