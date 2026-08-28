/**
 * coupang-lister의 수요조사 파이프라인(scan-data/*.csv) 결과를 읽어
 * mission-control 대시보드용 데이터로 가공한다.
 *
 * 소스: /Users/judy/dev/coupang-lister/scan-data (project-scripts 레지스트리의
 * coupang-lister cwd 기준 — 경로를 여기 새로 하드코딩하지 않고 단일 소스를 따른다).
 */
import fs from "fs";
import path from "path";
import { findProject } from "./project-scripts";

type FreshnessStatus = "ok" | "warning" | "critical" | "missing";

export interface FreshnessEntry {
  type: string;
  label: string;
  fileName: string | null;
  date: string | null;
  ageDays: number | null;
  rowCount: number | null;
  expectedCadenceDays: number;
  status: FreshnessStatus;
}

export interface DemandCategoryRow {
  categoryName: string;
  totalVolume: number;
  avgPrice: number;
  topKeyword: string;
  competitionIdx: string;
  demandScore: number;
}

export interface GapScoreKeywordRow {
  keyword: string;
  searchVolume: number;
  gapScore: number;
  minAvgPrice: number;
  competitionIdx: string;
}

export interface CoupangDemandData {
  available: boolean;
  hasContent: boolean;
  scanDataDir?: string;
  freshness: FreshnessEntry[];
  topDemandCategories: DemandCategoryRow[];
  topGapScoreKeywords: GapScoreKeywordRow[];
}

function scanDataDir(): string | null {
  const project = findProject("coupang-lister");
  if (!project) return null;
  return path.join(project.cwd, "scan-data");
}

function findLatestFile(dir: string, prefix: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".csv") && !f.includes("_v1_"))
    .sort()
    .reverse();
  return files.length > 0 ? path.join(dir, files[0]) : null;
}

function dateFromFileName(fileName: string, prefix: string): string | null {
  const m = fileName.slice(prefix.length).match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}

function ageDaysFromDate(dateStr: string): number {
  const then = new Date(`${dateStr}T00:00:00`).getTime();
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
}

function countDataRows(filePath: string): number {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== "");
  return Math.max(0, lines.length - 1);
}

function statusFor(ageDays: number | null, cadenceDays: number): FreshnessStatus {
  if (ageDays === null) return "missing";
  if (ageDays <= cadenceDays * 1.5) return "ok";
  if (ageDays <= cadenceDays * 4) return "warning";
  return "critical";
}

/** notify_demand_report.js와 동일한 quote-aware CSV 파서(콤마 없는 대형 파일 다수라 가볍게 유지). */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuote = false;
  for (const ch of line) {
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === "," && !inQuote) { cells.push(current); current = ""; continue; }
    current += ch;
  }
  cells.push(current);
  return cells;
}

function parseCsv(content: string): Record<string, string>[] {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (cells[i] ?? "").trim(); });
    return row;
  });
}

function buildFreshnessEntry(
  dir: string, type: string, label: string, prefix: string, cadenceDays: number
): { entry: FreshnessEntry; filePath: string | null } {
  const filePath = findLatestFile(dir, prefix);
  if (!filePath) {
    return {
      entry: { type, label, fileName: null, date: null, ageDays: null, rowCount: null, expectedCadenceDays: cadenceDays, status: "missing" },
      filePath: null,
    };
  }
  const fileName = path.basename(filePath);
  const date = dateFromFileName(fileName, prefix);
  const ageDays = date ? ageDaysFromDate(date) : null;
  const rowCount = countDataRows(filePath);
  return {
    entry: { type, label, fileName, date, ageDays, rowCount, expectedCadenceDays: cadenceDays, status: statusFor(ageDays, cadenceDays) },
    filePath,
  };
}

export function getCoupangDemandData(): CoupangDemandData {
  const dir = scanDataDir();
  if (!dir) return { available: false, hasContent: false, freshness: [], topDemandCategories: [], topGapScoreKeywords: [] };

  const wingScan = buildFreshnessEntry(dir, "wing_scan", "카테고리 스캔 (wing_scan)", "wing_scan_", 30);
  const demand = buildFreshnessEntry(dir, "demand", "카테고리 수요 (demand)", "demand_", 3);
  const keywordDemand = buildFreshnessEntry(dir, "keyword_demand", "키워드 수요 · gapScore (keyword_demand)", "keyword_demand_", 7);
  const productInsights = buildFreshnessEntry(dir, "product_insights", "내 상품 성과 (product_insights)", "product_insights_", 3);

  const freshness = [wingScan.entry, demand.entry, keywordDemand.entry, productInsights.entry];
  const hasContent = freshness.some((f) => f.fileName !== null);

  let topDemandCategories: DemandCategoryRow[] = [];
  if (demand.filePath) {
    const rows = parseCsv(fs.readFileSync(demand.filePath, "utf-8"));
    topDemandCategories = rows
      .map((r) => ({
        categoryName: r.categoryName ?? "",
        totalVolume: Number(r.totalVolume) || 0,
        avgPrice: Number(r.avgPrice) || 0,
        topKeyword: r.topKeyword ?? "",
        competitionIdx: r.competitionIdx ?? "",
        demandScore: Number(r.demandScore) || 0,
      }))
      .filter((r) => r.demandScore > 0)
      .sort((a, b) => b.demandScore - a.demandScore)
      .slice(0, 20);
  }

  let topGapScoreKeywords: GapScoreKeywordRow[] = [];
  if (keywordDemand.filePath) {
    const rows = parseCsv(fs.readFileSync(keywordDemand.filePath, "utf-8"));
    topGapScoreKeywords = rows
      .filter((r) =>
        r.sourcingEligible === "Y" && r.brandEligible === "Y" && r.logisticsViable === "Y" && r.coveredByMyProduct === "N"
      )
      .map((r) => ({
        keyword: r.keyword ?? "",
        searchVolume: Number(r.searchVolume) || 0,
        gapScore: Number(r.gapScore) || 0,
        minAvgPrice: Number(r.minAvgPrice) || 0,
        competitionIdx: r.competitionIdx ?? "",
      }))
      .sort((a, b) => b.gapScore - a.gapScore)
      .slice(0, 20);
  }

  return { available: true, hasContent, scanDataDir: dir, freshness, topDemandCategories, topGapScoreKeywords };
}
