import { NextResponse } from "next/server";
import { readdir, access } from "fs/promises";
import path from "path";

const PROJECTS_DIR = path.join(
  process.env.HOME ?? "/Users/judy",
  ".openclaw/workspace/projects"
);

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const entries = await readdir(PROJECTS_DIR, { withFileTypes: true });

    const checks = await Promise.all(
      entries
        .filter((e) => e.isDirectory())
        .map(async (e) => {
          const dir = path.join(PROJECTS_DIR, e.name);
          const [hasActive, hasContext, hasTask] = await Promise.all([
            exists(path.join(dir, ".active")),
            exists(path.join(dir, "PROJECT_CONTEXT.md")),
            exists(path.join(dir, "CURRENT_TASK.md")),
          ]);
          return { id: e.name, active: hasActive && hasContext && hasTask };
        })
    );

    const projects = checks
      .filter((p) => p.active)
      .map(({ id }) => ({ id }));

    return NextResponse.json({ projects });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
