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

function parseCrawlerPipeline(content: string) {
  // 현재: X개 (LIVE Y + REGISTERED Z ...) 패턴
  const currentMatch = content.match(/현재:\s*(\d+)개/);
  const liveMatch = content.match(/LIVE\s+(\d+)/);
  const registeredMatch = content.match(/REGISTERED\s+(\d+)/);

  const live = liveMatch ? parseInt(liveMatch[1]) : 0;
  const registered = registeredMatch ? parseInt(registeredMatch[1]) : 0;
  const active_products = currentMatch
    ? parseInt(currentMatch[1])
    : live + registered;

  const target = 500;
  const progress_pct = Math.round((active_products / target) * 100 * 10) / 10;

  // deadline 역산값
  const deadlineMatch = content.match(/예상 완료일:\s*(\d{4}-\d{2}-\d{2})/);
  const deadline = deadlineMatch ? deadlineMatch[1] : null;

  return { active_products, target, progress_pct, deadline };
}

function parsePersonalBrand(content: string, seedsUnprocessed: number) {
  const milestoneMatch = content.match(/현재 단계:\s*(M\d)/);
  const milestone = milestoneMatch ? milestoneMatch[1] : "M0";
  return { milestone, seeds_unprocessed: seedsUnprocessed };
}

function parseSeedsCount(content: string): number {
  const matches = content.match(/\| 상태 \| 미가공/g);
  return matches ? matches.length : 0;
}

export async function GET() {
  try {
    const judyOpsContext = await readFileSafe(
      path.join(WORKSPACE, "projects/judy-ops/PROJECT_CONTEXT.md")
    );
    const personalBrandContext = await readFileSafe(
      path.join(WORKSPACE, "projects/personal-brand/project_context.md")
    );
    const seedsContent = await readFileSafe(
      path.join(WORKSPACE, "projects/personal-brand/content_seeds.md")
    );

    const unprocessed = parseSeedsCount(seedsContent);
    const crawlerPipeline = parseCrawlerPipeline(judyOpsContext);
    const personalBrand = parsePersonalBrand(personalBrandContext, unprocessed);

    return NextResponse.json({
      "crawler-pipeline": crawlerPipeline,
      "personal-brand": personalBrand,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
