import { NextResponse } from "next/server";
import { readMissionFile } from "@/lib/mission-file";

export type FreedomStatus = "🟢" | "🟡" | "🔴" | "⬜";

export interface FreedomMetric {
  label: string;
  current: string;
  target: string;
  status: FreedomStatus;
  progress: number; // 0–100
  direction: "up" | "down";
}

// Korean numeric string → base unit number
// 시간/분 → minutes, % → percent value, 원/만/억 → won
function parseKoreanAmount(raw: string): number | null {
  const s = raw.replace(/약\s*/g, "").trim();

  const pct = s.match(/^([\d.]+)\s*%/);
  if (pct) return parseFloat(pct[1]);

  const hours = s.match(/([\d.]+)\s*시간/);
  const mins = s.match(/([\d.]+)\s*분/);
  if (hours || mins) {
    let total = 0;
    if (hours) total += parseFloat(hours[1]) * 60;
    if (mins) total += parseFloat(mins[1]);
    return total;
  }

  const eok = s.match(/([\d,]+)\s*억/);
  const man = s.match(/([\d,]+)\s*만/);
  if (eok || man) {
    let total = 0;
    if (eok) total += parseFloat(eok[1].replace(/,/g, "")) * 100_000_000;
    if (man) total += parseFloat(man[1].replace(/,/g, "")) * 10_000;
    return total;
  }

  const won = s.match(/^([\d,]+)\s*원/);
  if (won) return parseFloat(won[1].replace(/,/g, ""));

  const plain = s.match(/^[\d.]+$/);
  if (plain) return parseFloat(s);

  return null;
}

// direction + baseline reference for known metric labels
function metricConfig(label: string): { direction: "up" | "down"; baseline?: number } {
  if (label.includes("개입")) return { direction: "down", baseline: 420 }; // 7hr baseline in minutes
  if (label.includes("잔금") || label.includes("대출")) return { direction: "down" };
  return { direction: "up" };
}

function computeProgress(
  currentNum: number | null,
  targetNum: number | null,
  direction: "up" | "down",
  baseline?: number
): number {
  if (currentNum === null || targetNum === null) return 0;
  if (direction === "up") {
    if (targetNum === 0) return 100;
    return Math.min(Math.max((currentNum / targetNum) * 100, 0), 100);
  }
  // lower is better
  const start = baseline ?? currentNum;
  if (start === targetNum) return 100;
  const pct = ((start - currentNum) / (start - targetNum)) * 100;
  return Math.min(Math.max(pct, 0), 100);
}

function parseFreedomTable(content: string): FreedomMetric[] {
  // Extract "## Freedom 거리계" section up to the next --- or ##
  const sectionMatch = content.match(/## Freedom 거리계([\s\S]*?)(?=\n---|\n## )/);
  if (!sectionMatch) return [];

  const metrics: FreedomMetric[] = [];

  for (const row of sectionMatch[1].split("\n")) {
    if (!row.startsWith("|")) continue;
    const cells = row
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length < 4) continue;
    if (cells[0] === "지표" || /^-+$/.test(cells[0])) continue;

    const [label, current, target, statusRaw] = cells;
    const status = (statusRaw.match(/[🟢🟡🔴⬜]/u)?.[0] ?? "⬜") as FreedomStatus;
    const cfg = metricConfig(label);
    const currentNum = parseKoreanAmount(current);
    const targetNum = parseKoreanAmount(target);
    const progress = computeProgress(currentNum, targetNum, cfg.direction, cfg.baseline);

    metrics.push({
      label,
      current,
      target,
      status,
      progress: Math.round(progress * 10) / 10,
      direction: cfg.direction,
    });
  }

  return metrics;
}

export async function GET() {
  try {
    const { content, lastModified } = await readMissionFile();
    const metrics = parseFreedomTable(content);
    return NextResponse.json({ metrics, lastModified });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
