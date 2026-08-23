/**
 * ~/brain/docs/backlog.md 를 프로젝트별로 그룹화해서 읽는다.
 *
 * 파싱/신선도(git blame·log 기반 stale_days·age_days·status) 계산은 이미 검증된
 * ~/brain/daemon/scripts/backlog_data.py 를 subprocess 로 그대로 재사용한다
 * (hermes-cron.ts 의 execFile 셸아웃 패턴과 동일). 공개 대시보드가 쓰는
 * backlog_server.py(127.0.0.1:8787) HTTP API 는 의도적으로 거치지 않는다 —
 * 그쪽은 공개 노출 대비 인증 토큰 + rate-limit lockout까지 딸려 있어, 미션보드가
 * dev 모드 HMR로 자주 재조회하면 스스로 잠길 위험이 있다.
 *
 * apply_redact=false 로 호출해 시크릿 마스킹 없이 원문 그대로 받는다 — 미션보드는
 * 사용자 본인만 보는 로컬 페이지라 공개 위젯의 redaction 제약이 필요 없다.
 */
import { execFile } from "child_process";
import { promisify } from "util";
import { stat } from "fs/promises";
import os from "os";
import path from "path";

const execFileAsync = promisify(execFile);

export const BACKLOG_FILE =
  process.env.BACKLOG_FILE_PATH || path.join(os.homedir(), "brain/docs/backlog.md");

export const BACKLOG_DATA_SCRIPT =
  process.env.BACKLOG_DATA_SCRIPT_PATH ||
  path.join(os.homedir(), "brain/daemon/scripts/backlog_data.py");

const PYTHON_BIN = process.env.BACKLOG_PYTHON_BIN || "python3";

export interface BacklogItem {
  project: string;
  prio: "🔴" | "🟡" | "🟢";
  title: string;
  body: string;
  target: string | null;
  raw: string;
  first_seen: string | null;
  age_days: number | null;
  age_floor: boolean;
  last_touched: string | null;
  stale_days: number | null;
  auto: boolean;
  in_progress: boolean;
}

export interface BacklogProject {
  name: string;
  open: number;
  red: number;
  yellow: number;
  green: number;
  auto: number;
  oldest_days: number | null;
  oldest_is_floor: boolean;
  stalest_days: number | null;
  repo: string | null;
  last_commit: string | null;
  last_commit_days: number | null;
  dirty: number | null;
  status: string | null;
}

export interface BacklogSummary {
  generated_at: string;
  backlog_mtime: string;
  age_floor_date: string | null;
  totals: {
    open: number;
    red: number;
    yellow: number;
    green: number;
    auto: number;
    unknown_age: number;
  };
  projects: BacklogProject[];
}

export interface BacklogDetail {
  generated_at: string;
  age_floor_date: string | null;
  items: BacklogItem[];
}

export interface BacklogData {
  summary: BacklogSummary;
  detail: BacklogDetail;
}

let cache: { mtimeMs: number; data: BacklogData } | null = null;

export async function getBacklogData(): Promise<BacklogData> {
  const fileStat = await stat(BACKLOG_FILE);
  if (cache && cache.mtimeMs === fileStat.mtimeMs) {
    return cache.data;
  }

  const { stdout } = await execFileAsync(
    PYTHON_BIN,
    [BACKLOG_DATA_SCRIPT, "--json", "--no-redact"],
    { maxBuffer: 10 * 1024 * 1024 }
  );
  const data = JSON.parse(stdout) as BacklogData;
  cache = { mtimeMs: fileStat.mtimeMs, data };
  return data;
}
