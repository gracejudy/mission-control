import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const MISSION_FILE = path.join(
  process.env.HOME ?? "/Users/judy",
  ".openclaw/workspace/MISSION-CONTROL.md"
);

function extractSection(content: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escaped}[\\s\\S]*?(?=\\n---[\\s\\S]|\\n## |$)`, "m");
  const match = content.match(re);
  return match ? match[0].trim() : "";
}

function extractSubSection(content: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escaped}[\\s\\S]*?(?=\\n### |\\n## |\\n---[\\s\\S]|$)`, "m");
  const match = content.match(re);
  return match ? match[0].trim() : "";
}

export async function GET() {
  try {
    const content = await readFile(MISSION_FILE, "utf-8");

    const pipelineOps = extractSection(content, "## pipeline-ops 현황");
    const generalExecutorSection = extractSection(content, "## general-executor 현황");
    const kpi = extractSubSection(generalExecutorSection, "### KPI");
    const judyopsStatus = extractSubSection(generalExecutorSection, "### judy-ops 현황");
    const personalBrandMilestone = extractSubSection(content, "### personal-brand 마일스톤");

    return NextResponse.json({
      "pipeline-ops": pipelineOps,
      "general-executor-kpi": kpi,
      "judyops-status": judyopsStatus,
      "personal-brand-milestone": personalBrandMilestone,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
