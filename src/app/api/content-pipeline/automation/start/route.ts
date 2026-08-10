import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import {
  readAutomation,
  writeAutomation,
  isPidAlive,
  WATCHER_SCRIPT_PATH,
  AUTOMATION_DURATION_MS,
} from '@/lib/content-pipeline';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const current = await readAutomation();
    if (current.enabled && isPidAlive(current.pid)) {
      return NextResponse.json({ ...current, alreadyRunning: true });
    }

    const child = spawn('bash', [WATCHER_SCRIPT_PATH], {
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        WATCHER_DURATION_SECONDS: String(Math.round(AUTOMATION_DURATION_MS / 1000)),
      },
    });
    child.unref();

    if (!child.pid) {
      return NextResponse.json({ error: 'Failed to start watcher process' }, { status: 500 });
    }

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + AUTOMATION_DURATION_MS);

    const state = await writeAutomation({
      enabled: true,
      pid: child.pid,
      startedAt: startedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      stoppedReason: null,
    });

    return NextResponse.json(state);
  } catch (error) {
    console.error('Failed to start automation:', error);
    return NextResponse.json({ error: 'Failed to start automation' }, { status: 500 });
  }
}
