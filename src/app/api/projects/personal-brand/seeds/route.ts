import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const SEEDS_FILE = path.join(
  process.env.HOME ?? "/Users/judy",
  ".openclaw/workspace/projects/personal-brand/content_seeds.md"
);

interface Seed {
  id: string;
  title: string;
  episode: string;
  pillar: string;
  angle: string;
  source: string;
  status: string;
}

function parseSeeds(content: string): Seed[] {
  const seeds: Seed[] = [];
  // Split on "### S" to get individual seed blocks
  const blocks = content.split(/\n(?=### S\d+)/);

  for (const block of blocks) {
    const headerMatch = block.match(/^### (S\d+)\s*[—-]\s*(.+)/m);
    if (!headerMatch) continue;

    const id = headerMatch[1];
    const title = headerMatch[2].trim();

    const getCell = (key: string): string => {
      const re = new RegExp(`\\|\\s*${key}\\s*\\|\\s*(.+?)\\s*\\|`, "m");
      const m = block.match(re);
      return m ? m[1].trim() : "";
    };

    seeds.push({
      id,
      title,
      episode: getCell("에피소드"),
      pillar: getCell("필러"),
      angle: getCell("각도"),
      source: getCell("출처"),
      status: getCell("상태"),
    });
  }

  return seeds;
}

export async function GET() {
  try {
    const content = await readFile(SEEDS_FILE, "utf-8");
    const seeds = parseSeeds(content);
    const unprocessed = seeds.filter((s) => s.status === "미가공").length;

    return NextResponse.json({ seeds, total: seeds.length, unprocessed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
