/**
 * 프로젝트별로 등록된 "실행 가능한 스크립트" 레지스트리.
 *
 * cron-jobs(hermes CLI로 위임)와 달리, 여기서는 이 서버(Mac mini)에서 직접
 * `execFile`로 스크립트를 실행한다. 파라미터 값은 항상 argv 배열 원소로 전달하고
 * 셸을 거치지 않는다(execFile은 shell:true를 쓰지 않는 한 셸 인터폴레이션이 없음) —
 * 값에 세미콜론/백틱 등이 들어와도 커맨드 인젝션으로 이어지지 않는다.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const REGISTRY_FILE = path.join(process.cwd(), "data", "project-scripts.json");

export type ParamType = "text" | "number" | "date" | "select" | "flag";

export interface ScriptParam {
  key: string;
  label: string;
  flag: string;
  type: ParamType;
  default?: string | number | boolean;
  options?: string[];
  placeholder?: string;
  /** "--flag=value"(기본) 대신 "--flag value" 두 토큰으로 넘겨야 하는 스크립트용. */
  argStyle?: "equals" | "space";
  /** 비워두면 스크립트가 process.exit 등으로 죽는 경우. UI에서 실행 전 막는다. */
  required?: boolean;
  /** number 타입 하한/상한 (스크립트나 대상 API의 실제 제약에서 가져올 것). */
  min?: number;
  max?: number;
  /** text 타입 형식 검증용 정규식(문자열) + 위반 시 보여줄 안내 문구. */
  pattern?: string;
  patternMessage?: string;
}

export interface RegisteredScript {
  id: string;
  name: string;
  description: string;
  command: string;
  baseArgs: string[];
  params: ScriptParam[];
  confirmBeforeRun: boolean;
  createdAt: string;
  /** 등록 시점의 실행 파일 sha256 해시. 실행 전 재확인해 변경 감지에 쓴다. */
  fileHash: string;
  /** 마지막으로 실제 실행(execFile)된 시각. 목록 정렬(최근 사용순)에 쓴다. 실행 전 검증/해시
   *  불일치로 막힌 시도는 "사용"으로 안 친다 — 실제 execFile 직전에만 갱신한다. */
  lastRunAt?: string;
}

export interface RegisteredProject {
  id: string;
  label: string;
  cwd: string;
  createdAt: string;
}

export interface ProjectScriptsRegistry {
  projects: RegisteredProject[];
  scripts: Record<string, RegisteredScript[]>;
}

const EMPTY_REGISTRY: ProjectScriptsRegistry = { projects: [], scripts: {} };

/** 최근 사용순(lastRunAt 내림차순) 정렬. 한 번도 안 쓴 스크립트는 뒤로 밀리되, 서로간
 *  상대 순서(등록 순)는 안정적으로 유지된다(Array.sort는 stable). */
function sortByRecentUse(scripts: RegisteredScript[]): RegisteredScript[] {
  return [...scripts].sort((a, b) => {
    const at = a.lastRunAt ? Date.parse(a.lastRunAt) : -Infinity;
    const bt = b.lastRunAt ? Date.parse(b.lastRunAt) : -Infinity;
    return bt - at;
  });
}

export function readRegistry(): ProjectScriptsRegistry {
  try {
    const raw = fs.readFileSync(REGISTRY_FILE, "utf-8");
    const data = JSON.parse(raw);
    const projects = Array.isArray(data.projects) ? data.projects : [];
    const rawScripts: Record<string, RegisteredScript[]> =
      data.scripts && typeof data.scripts === "object" ? data.scripts : {};
    const scripts: Record<string, RegisteredScript[]> = {};
    for (const projectId of Object.keys(rawScripts)) {
      scripts[projectId] = sortByRecentUse(rawScripts[projectId] ?? []);
    }
    return { projects, scripts };
  } catch {
    return EMPTY_REGISTRY;
  }
}

function writeRegistry(registry: ProjectScriptsRegistry): void {
  fs.mkdirSync(path.dirname(REGISTRY_FILE), { recursive: true });
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2) + "\n", "utf-8");
}

export function findProject(projectId: string): RegisteredProject | undefined {
  return readRegistry().projects.find((p) => p.id === projectId);
}

export function findScript(projectId: string, scriptId: string): RegisteredScript | undefined {
  return readRegistry().scripts[projectId]?.find((s) => s.id === scriptId);
}

/** baseArgs 중 "-"로 시작하지 않는 첫 토큰 = 실제 실행 파일 경로로 간주. */
export function extractScriptPath(baseArgs: string[]): string | null {
  return baseArgs.find((a) => !a.startsWith("-")) ?? null;
}

function hashFile(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

function computeScriptHash(cwd: string, baseArgs: string[]): string {
  const scriptPath = extractScriptPath(baseArgs);
  if (!scriptPath) throw new Error("실행 파일 경로를 baseArgs에서 찾을 수 없습니다");
  const resolved = path.join(cwd, scriptPath);
  try {
    return hashFile(resolved);
  } catch {
    throw new Error(`스크립트 파일을 찾을 수 없습니다: ${resolved}`);
  }
}

export function addProject(input: { id: string; label: string; cwd: string }): RegisteredProject {
  const registry = readRegistry();
  if (registry.projects.some((p) => p.id === input.id)) {
    throw new Error(`이미 존재하는 프로젝트 id입니다: ${input.id}`);
  }
  const project: RegisteredProject = { ...input, createdAt: new Date().toISOString() };
  registry.projects.push(project);
  registry.scripts[input.id] = registry.scripts[input.id] ?? [];
  writeRegistry(registry);
  return project;
}

export function deleteProject(projectId: string): void {
  const registry = readRegistry();
  registry.projects = registry.projects.filter((p) => p.id !== projectId);
  delete registry.scripts[projectId];
  writeRegistry(registry);
}

export function addScript(
  projectId: string,
  input: Omit<RegisteredScript, "id" | "createdAt" | "fileHash">
): RegisteredScript {
  const registry = readRegistry();
  const project = registry.projects.find((p) => p.id === projectId);
  if (!project) {
    throw new Error(`프로젝트를 찾을 수 없습니다: ${projectId}`);
  }
  const script: RegisteredScript = {
    ...input,
    id: `${input.name.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "") || "script"}-${Date.now().toString(36)}`,
    fileHash: computeScriptHash(project.cwd, input.baseArgs),
    createdAt: new Date().toISOString(),
  };
  registry.scripts[projectId] = [...(registry.scripts[projectId] ?? []), script];
  writeRegistry(registry);
  return script;
}

/** 실행 파일이 바뀐 걸 사용자가 확인했다는 뜻으로 저장된 해시를 현재 파일 상태로 갱신한다. */
export function reconnectScript(projectId: string, scriptId: string): RegisteredScript {
  const registry = readRegistry();
  const project = registry.projects.find((p) => p.id === projectId);
  if (!project) throw new Error(`프로젝트를 찾을 수 없습니다: ${projectId}`);
  const scripts = registry.scripts[projectId] ?? [];
  const idx = scripts.findIndex((s) => s.id === scriptId);
  if (idx === -1) throw new Error(`스크립트를 찾을 수 없습니다: ${scriptId}`);

  const updated: RegisteredScript = {
    ...scripts[idx],
    fileHash: computeScriptHash(project.cwd, scripts[idx].baseArgs),
  };
  scripts[idx] = updated;
  registry.scripts[projectId] = scripts;
  writeRegistry(registry);
  return updated;
}

export function deleteScript(projectId: string, scriptId: string): void {
  const registry = readRegistry();
  registry.scripts[projectId] = (registry.scripts[projectId] ?? []).filter((s) => s.id !== scriptId);
  writeRegistry(registry);
}

/** 실제 실행(execFile) 직전에만 호출 — "최근 사용순" 정렬의 기준 시각을 갱신한다. */
function touchScriptLastRun(projectId: string, scriptId: string, ranAt: string): void {
  const registry = readRegistry();
  const scripts = registry.scripts[projectId] ?? [];
  const idx = scripts.findIndex((s) => s.id === scriptId);
  if (idx === -1) return;
  scripts[idx] = { ...scripts[idx], lastRunAt: ranAt };
  registry.scripts[projectId] = scripts;
  writeRegistry(registry);
}

export function buildArgs(script: RegisteredScript, values: Record<string, unknown>): string[] {
  const args = [...script.baseArgs];
  for (const p of script.params) {
    const v = values[p.key];
    if (p.type === "flag") {
      if (v === true || v === "true") args.push(p.flag);
      continue;
    }
    if (v === undefined || v === null || v === "") continue;
    if (p.argStyle === "space") {
      args.push(p.flag, String(v));
    } else {
      args.push(`${p.flag}=${v}`);
    }
  }
  return args;
}

export interface RunResult {
  success: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
  ranAt: string;
  command: string;
  error?: string;
  /** true면 등록 당시와 실행 파일 해시가 달라 실행하지 않고 막은 상태 */
  stale?: boolean;
}

/** UI의 선체크와 동일한 규칙을 서버에서도 한 번 더 강제한다 (defense in depth). */
export function validateValues(script: RegisteredScript, values: Record<string, unknown>): string[] {
  const errors: string[] = [];
  for (const p of script.params) {
    if (p.type === "flag") continue;
    const raw = values[p.key];
    const isEmpty = raw === undefined || raw === null || raw === "";
    if (p.required && isEmpty) {
      errors.push(`${p.label}: 필수 항목입니다`);
      continue;
    }
    if (isEmpty) continue;
    if (p.type === "number") {
      const n = Number(raw);
      if (Number.isNaN(n)) {
        errors.push(`${p.label}: 숫자를 입력하세요`);
      } else {
        if (p.min !== undefined && n < p.min) errors.push(`${p.label}: 최소 ${p.min} 이상이어야 합니다`);
        if (p.max !== undefined && n > p.max) errors.push(`${p.label}: 최대 ${p.max}까지 가능합니다`);
      }
    }
    if (p.type === "text" && p.pattern) {
      if (!new RegExp(p.pattern).test(String(raw))) {
        errors.push(`${p.label}: ${p.patternMessage ?? "형식이 올바르지 않습니다"}`);
      }
    }
  }
  return errors;
}

const RUN_TIMEOUT_MS = 5 * 60 * 1000;

export async function runScript(
  projectId: string,
  scriptId: string,
  values: Record<string, unknown>
): Promise<RunResult> {
  const project = findProject(projectId);
  if (!project) throw new Error(`프로젝트를 찾을 수 없습니다: ${projectId}`);
  const script = findScript(projectId, scriptId);
  if (!script) throw new Error(`스크립트를 찾을 수 없습니다: ${scriptId}`);

  const args = buildArgs(script, values);
  const commandDisplay = [script.command, ...args].join(" ");
  const startedAt = Date.now();
  const ranAt = new Date(startedAt).toISOString();

  const validationErrors = validateValues(script, values);
  if (validationErrors.length > 0) {
    return {
      success: false,
      stdout: "",
      stderr: "",
      durationMs: Date.now() - startedAt,
      ranAt,
      command: commandDisplay,
      error: validationErrors.join(" / "),
    };
  }

  let currentHash: string;
  try {
    currentHash = computeScriptHash(project.cwd, script.baseArgs);
  } catch (err) {
    return {
      success: false,
      stdout: "",
      stderr: "",
      durationMs: Date.now() - startedAt,
      ranAt,
      command: commandDisplay,
      error: err instanceof Error ? err.message : "스크립트 파일 확인 실패",
    };
  }

  if (currentHash !== script.fileHash) {
    return {
      success: false,
      stale: true,
      stdout: "",
      stderr: "",
      durationMs: Date.now() - startedAt,
      ranAt,
      command: commandDisplay,
      error: "스크립트가 변경되었습니다. 재연결이 필요합니다.",
    };
  }

  touchScriptLastRun(projectId, scriptId, ranAt);
  try {
    const { stdout, stderr } = await execFileAsync(script.command, args, {
      cwd: project.cwd,
      timeout: RUN_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024,
    });
    return {
      success: true,
      stdout,
      stderr,
      durationMs: Date.now() - startedAt,
      ranAt,
      command: commandDisplay,
    };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string; killed?: boolean; signal?: string };
    return {
      success: false,
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
      durationMs: Date.now() - startedAt,
      ranAt,
      command: commandDisplay,
      error: e.killed ? `타임아웃(${RUN_TIMEOUT_MS / 1000}초) 초과로 종료됨` : e.message ?? "실행 실패",
    };
  }
}
