import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const WORKSPACE = path.join(
  process.env.HOME ?? "/Users/judy",
  ".openclaw/workspace"
);

async function readFileSafe(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf-8");
  } catch {
    return "";
  }
}

function extractSection(content: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(${escaped}[\\s\\S]*?)(?=\\n#{1,3} |$)`, "m");
  const match = content.match(re);
  return match ? match[1].trim() : "";
}

function extractCrawlerStepsMarkdown(content: string): string {
  // Extract 1차/2차 목표 sections from PROJECT_CONTEXT.md
  const first = content.match(/### 1차 목표[^\n]*\n([\s\S]*?)(?=\n###|\n##|$)/);
  const second = content.match(/### 2차 목표[^\n]*\n([\s\S]*?)(?=\n###|\n##|$)/);

  const rows: string[] = [];
  if (first) {
    const targetMatch = first[1].match(/\*\*목표:\*\*\s*([^\n]+)/);
    const deadlineMatch = first[1].match(/달성 예상일:\*\*\s*([^\n]+)/);
    rows.push(
      `| 1차 — 파이프라인 규모화 | ${targetMatch ? targetMatch[1].trim() : "500개"} | ${deadlineMatch ? deadlineMatch[1].trim() : "⬜ 미설정"} |`
    );
  } else {
    rows.push("| 1차 — 파이프라인 규모화 | 500개 | ⬜ 미설정 |");
  }
  if (second) {
    const targetMatch = second[1].match(/\*\*목표:\*\*\s*([^\n]+)/);
    const deadlineMatch = second[1].match(/달성 예상일:\*\*\s*([^\n]+)/);
    rows.push(
      `| 2차 — 수익화 | ${targetMatch ? targetMatch[1].trim() : "월 순이익 500만원"} | ${deadlineMatch ? deadlineMatch[1].trim() : "⬜ 미설정"} |`
    );
  } else {
    rows.push("| 2차 — 수익화 | 월 순이익 500만원 | ⬜ 미설정 |");
  }

  return `| 단계 | 목표 | 달성기한 |\n|---|---|---|\n${rows.join("\n")}`;
}

function extractNextTasks(content: string): string {
  // Extract "### 다음 작업" section from CURRENT_TASK.md
  const match = content.match(/### 다음 작업[^\n]*\n([\s\S]*?)(?=\n###|\n##|$)/);
  if (!match) return "";
  return match[1].trim();
}

function extractPBMilestonesMarkdown(content: string): string {
  // Extract milestone table from project_context.md
  const match = content.match(/### 단계별 마일스톤\n([\s\S]*?)(?=\n---|\n##|$)/);
  return match ? match[1].trim() : "";
}

function extractPBCurrentTasks(content: string): string {
  const lines: string[] = [];

  // Now section — unchecked items only
  const nowMatch = content.match(/## Now[^\n]*\n([\s\S]*?)(?=\n##|$)/);
  if (nowMatch) {
    const nowLines = nowMatch[1]
      .split("\n")
      .filter((l) => l.match(/^-\s+\[ \]/));
    if (nowLines.length > 0) {
      lines.push("**Now (진행 중):**");
      lines.push(...nowLines);
    }
  }

  // Next section — unchecked top-level items only
  const nextMatch = content.match(/## Next[^\n]*\n([\s\S]*?)(?=\n##|$)/);
  if (nextMatch) {
    const nextLines = nextMatch[1]
      .split("\n")
      .filter((l) => l.match(/^-\s+\[ \]/));
    if (nextLines.length > 0) {
      if (lines.length > 0) lines.push("");
      lines.push("**Next (예정):**");
      lines.push(...nextLines);
    }
  }

  // Blockers
  const blockerMatch = content.match(/## Blockers[^\n]*\n([\s\S]*?)(?=\n##|$)/);
  if (blockerMatch) {
    const blockerLines = blockerMatch[1]
      .split("\n")
      .filter((l) => l.match(/^-\s+\[ \]/));
    if (blockerLines.length > 0) {
      if (lines.length > 0) lines.push("");
      lines.push("**Blockers:**");
      lines.push(...blockerLines);
    }
  }

  return lines.join("\n");
}

export async function GET() {
  try {
    const judyOpsContext = await readFileSafe(
      path.join(WORKSPACE, "projects/judy-ops/PROJECT_CONTEXT.md")
    );
    const judyOpsTask = await readFileSafe(
      path.join(WORKSPACE, "projects/judy-ops/CURRENT_TASK.md")
    );
    const pbContext = await readFileSafe(
      path.join(WORKSPACE, "projects/personal-brand/project_context.md")
    );
    const pbTask = await readFileSafe(
      path.join(WORKSPACE, "projects/personal-brand/CURRENT_TASK.md")
    );

    const crawlerSteps = extractCrawlerStepsMarkdown(judyOpsContext);
    const judyOpsTasks = extractNextTasks(judyOpsTask);
    const pbMilestones = extractPBMilestonesMarkdown(pbContext);
    const pbTasks = extractPBCurrentTasks(pbTask);

    return NextResponse.json({
      "crawler-pipeline": {
        finalGoal: "LIVE + REGISTERED 기준 500개 상품 Qoo10 등록",
        stepsMarkdown: crawlerSteps,
        tasksMarkdown: judyOpsTasks,
      },
      "judy-ops": {
        finalGoal: "월 순이익 500만원 (1차: 파이프라인 500개 달성 후 전환)",
        stepsMarkdown: crawlerSteps,
        tasksMarkdown: judyOpsTasks,
      },
      "personal-brand": {
        finalGoal: "누적 30건 (300만원) — M4 달성",
        stepsMarkdown: pbMilestones,
        tasksMarkdown: pbTasks,
      },
      "mission-board": {
        finalGoal: "",
        stepsMarkdown: "",
        tasksMarkdown: "",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
