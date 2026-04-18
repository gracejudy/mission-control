/**
 * GET /api/logs/recent?service=mission-control&lines=5
 * Returns last N log lines (non-streaming, REST)
 */
import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const ALLOWED_SERVICES = [
  "mission-control",
  "classvault",
  "content-vault",
  "openclaw-gateway",
  "brain",
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const service = searchParams.get("service") ?? "mission-control";
  const lines = Math.min(parseInt(searchParams.get("lines") ?? "5", 10), 50);

  if (!ALLOWED_SERVICES.includes(service)) {
    return NextResponse.json({ error: "Service not allowed" }, { status: 400 });
  }

  // Try pm2 first (macOS), fall back to journalctl (Linux)
  const commands = [
    `pm2 logs ${service} --lines ${lines} --nocolor 2>&1 | tail -${lines}`,
    `journalctl -u ${service} -n ${lines} --no-pager --output=short 2>&1`,
  ];

  for (const cmd of commands) {
    try {
      const { stdout } = await execAsync(cmd, { timeout: 5000 });
      const logLines = stdout
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(-lines);
      if (logLines.length > 0) {
        return NextResponse.json({ lines: logLines, service });
      }
    } catch {
      continue;
    }
  }

  return NextResponse.json({ lines: [], service, error: "No logs found" });
}
