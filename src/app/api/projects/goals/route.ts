import { NextResponse } from "next/server";
import { readFile, readdir, access } from "fs/promises";
import path from "path";

const WORKSPACE = path.join(
  process.env.HOME ?? "/Users/judy",
  ".openclaw/workspace"
);
const PROJECTS_DIR = path.join(WORKSPACE, "projects");

async function readFileSafe(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf-8");
  } catch {
    return "";
  }
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

// ── Generic parsers ────────────────────────────────────────────────────────

function extractFinalGoal(context: string): string {
  // Pattern 1: **목표:** inline  (e.g. n8n-mastery)
  const inline = context.match(/\*\*목표:\*\*\s*([^\n]+)/);
  if (inline) return inline[1].trim();

  // Pattern 2: ## 목표 section — first non-empty, non-table, non-heading line
  const section = context.match(/## 목표\n([\s\S]*?)(?=\n## |\n---|\n#{1,2} |$)/);
  if (section) {
    const lines = section[1].split("\n").map((l) => l.trim());
    const firstMeaningful = lines.find(
      (l) => l && !l.startsWith("|") && !l.startsWith("#") && !l.startsWith("-")
    );
    if (firstMeaningful) return firstMeaningful.replace(/^\*+|\*+$/g, "").trim();
  }

  return "";
}

function extractStepsMarkdown(context: string): string {
  // Pattern 1: ### 단계별 마일스톤  table (personal-brand)
  const m1 = context.match(/### 단계별 마일스톤\n([\s\S]*?)(?=\n---|\n#{1,3} |$)/);
  if (m1 && m1[1].includes("|")) return m1[1].trim();

  // Pattern 2: ## 목표 로드맵 → ### 1차 목표 / ### 2차 목표 (judy-ops)
  const roadmap = context.match(/## 목표 로드맵\n([\s\S]*?)(?=\n---|\n## |$)/);
  if (roadmap) {
    const rows: string[] = [];
    const phaseBlocks = roadmap[1].matchAll(
      /### (\d차 목표[^\n]*)\n([\s\S]*?)(?=\n### \d차|\n## |$)/g
    );
    for (const block of phaseBlocks) {
      const label = block[1].trim();
      const body = block[2];
      const target = (body.match(/\*\*목표:\*\*\s*([^\n]+)/) ?? [])[1]?.trim() ?? "";
      const deadline = (body.match(/달성 예상일:\*\*\s*([^\n]+)/) ?? [])[1]?.trim() ?? "⬜ 미설정";
      rows.push(`| ${label} | ${target} | ${deadline} |`);
    }
    if (rows.length > 0) {
      return `| 단계 | 목표 | 달성기한 |\n|---|---|---|\n${rows.join("\n")}`;
    }
  }

  return "";
}

function extractTasksMarkdown(task: string): string {
  // Pattern 1: ### 다음 작업 (judy-ops style)
  const m1 = task.match(/### 다음 작업[^\n]*\n([\s\S]*?)(?=\n###|\n##|$)/);
  if (m1) return m1[1].trim();

  // Pattern 2: ## Now + ## Next unchecked (personal-brand style)
  const nowSection = task.match(/## Now[^\n]*\n([\s\S]*?)(?=\n##|$)/);
  const nextSection = task.match(/## Next[^\n]*\n([\s\S]*?)(?=\n##|$)/);
  if (nowSection || nextSection) {
    const lines: string[] = [];
    if (nowSection) {
      const unchecked = nowSection[1].split("\n").filter((l) => l.match(/^-\s+\[ \]/));
      if (unchecked.length) { lines.push("**Now:**"); lines.push(...unchecked); }
    }
    if (nextSection) {
      const unchecked = nextSection[1].split("\n").filter((l) => l.match(/^-\s+\[ \]/));
      if (unchecked.length) {
        if (lines.length) lines.push("");
        lines.push("**Next:**");
        lines.push(...unchecked);
      }
    }
    if (lines.length) return lines.join("\n");
  }

  // Pattern 3: ## 지금 해야 할 것 (n8n-mastery style)
  const m3 = task.match(/## 지금 해야 할 것\n([\s\S]*?)(?=\n##|$)/);
  if (m3) return m3[1].trim();

  // Pattern 4: generic ## 다음 작업
  const m4 = task.match(/## 다음 작업[^\n]*\n([\s\S]*?)(?=\n##|$)/);
  if (m4) return m4[1].trim();

  // Fallback: top 10 unchecked items in the file
  const unchecked = task.match(/^- \[ \] .+/mg) ?? [];
  return unchecked.slice(0, 10).join("\n");
}

// ── Scan and build all active projects ────────────────────────────────────

export async function GET() {
  try {
    const entries = await readdir(PROJECTS_DIR, { withFileTypes: true });

    const results: Record<
      string,
      { finalGoal: string; stepsMarkdown: string; tasksMarkdown: string }
    > = {};

    await Promise.all(
      entries
        .filter((e) => e.isDirectory())
        .map(async (e) => {
          const dir = path.join(PROJECTS_DIR, e.name);
          const [hasActive, hasContext, hasTask] = await Promise.all([
            fileExists(path.join(dir, ".active")),
            fileExists(path.join(dir, "PROJECT_CONTEXT.md")),
            fileExists(path.join(dir, "CURRENT_TASK.md")),
          ]);
          if (!hasActive || !hasContext || !hasTask) return;

          const [context, task] = await Promise.all([
            readFileSafe(path.join(dir, "PROJECT_CONTEXT.md")),
            readFileSafe(path.join(dir, "CURRENT_TASK.md")),
          ]);

          results[e.name] = {
            finalGoal: extractFinalGoal(context),
            stepsMarkdown: extractStepsMarkdown(context),
            tasksMarkdown: extractTasksMarkdown(task),
          };
        })
    );

    return NextResponse.json(results);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
