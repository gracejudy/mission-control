import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";

const MISSION_FILE = path.join(
  process.env.HOME ?? "/Users/judy",
  ".openclaw/workspace/MISSION-CONTROL.md"
);

export async function GET() {
  try {
    const [content, fileStat] = await Promise.all([
      readFile(MISSION_FILE, "utf-8"),
      stat(MISSION_FILE),
    ]);

    const lastModified = fileStat.mtime.toISOString();
    return NextResponse.json({ content, lastModified });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
