import fs from 'fs/promises';
import path from 'path';

export const CONTENT_PIPELINE_DIR =
  process.env.CONTENT_PIPELINE_DIR ||
  path.join(process.env.HOME || '', 'dev/judy-brain/projects/content-pipeline');

export const IDEAS_MD_PATH = path.join(CONTENT_PIPELINE_DIR, 'ideas.md');
export const STATUS_JSON_PATH = path.join(CONTENT_PIPELINE_DIR, 'status.json');
export const DRAFTS_DIR = path.join(CONTENT_PIPELINE_DIR, 'drafts');
export const TASKS_DIR = path.join(CONTENT_PIPELINE_DIR, 'tasks');
export const AUTOMATION_JSON_PATH = path.join(CONTENT_PIPELINE_DIR, 'automation.json');
export const WATCHER_SCRIPT_PATH = path.join(CONTENT_PIPELINE_DIR, 'scripts', 'queue-watcher.sh');
export const AUTOMATION_DURATION_MS = 60 * 60 * 1000;

export type IdeaType = 'I' | 'B' | 'A';
export type IdeaStatus = 'idle' | 'requested' | 'draft' | 'published';

export interface RawIdea {
  id: string;
  type: IdeaType;
  title: string;
  meta: string; // 키워드(I) | 파트너(B, A)
  extra: Record<string, string>;
}

export interface StatusEntry {
  status: IdeaStatus;
  requestedAt?: string;
  draftFile?: string;
  evaluationFile?: string;
  publishedFile?: string;
  publishedUrl?: string;
  publishedAt?: string;
}

export type StatusMap = Record<string, StatusEntry>;

export interface Idea extends RawIdea, StatusEntry {}

/** Resolve a path relative to CONTENT_PIPELINE_DIR, guarding against traversal outside it. */
export function resolveInPipelineDir(...segments: string[]): string {
  const resolved = path.resolve(CONTENT_PIPELINE_DIR, ...segments);
  const base = path.resolve(CONTENT_PIPELINE_DIR) + path.sep;
  if (!resolved.startsWith(base)) {
    throw new Error('Path escapes content-pipeline directory');
  }
  return resolved;
}

const SECTION_RE = /^##\s*타입\s*([IBA])\s*—/;
const HEADING_RE = /^##\s/;

const COLUMNS: Record<IdeaType, string[]> = {
  I: ['id', 'title', 'keyword', 'volume', 'competition'],
  B: ['id', 'title', 'partner', 'linkNeeded'],
  A: ['id', 'title', 'partner', 'memo'],
};

/** Parses the `## 타입 I/B/A —` markdown tables out of ideas.md. Stops each section at the next `##` heading. */
export function parseIdeasMarkdown(raw: string): RawIdea[] {
  const lines = raw.split(/\r?\n/);
  const ideas: RawIdea[] = [];
  let currentType: IdeaType | null = null;
  let sawHeader = false;
  let sawSeparator = false;

  for (const line of lines) {
    const sectionMatch = line.match(SECTION_RE);
    if (sectionMatch) {
      currentType = sectionMatch[1] as IdeaType;
      sawHeader = false;
      sawSeparator = false;
      continue;
    }
    if (HEADING_RE.test(line) && !sectionMatch) {
      currentType = null;
      continue;
    }
    if (!currentType) continue;

    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;

    if (!sawHeader) {
      sawHeader = true;
      continue;
    }
    if (!sawSeparator) {
      sawSeparator = true;
      continue;
    }

    const cells = trimmed.split('|').slice(1, -1).map((c) => c.trim());
    const cols = COLUMNS[currentType];
    if (cells.length < cols.length || !cells[0]) continue;

    const idea: RawIdea = {
      id: cells[0],
      type: currentType,
      title: cells[1] ?? '',
      meta: cells[2] ?? '',
      extra: {},
    };
    for (let i = 3; i < cols.length; i++) {
      idea.extra[cols[i]] = cells[i] ?? '';
    }
    ideas.push(idea);
  }
  return ideas;
}

export async function readIdeas(): Promise<RawIdea[]> {
  const raw = await fs.readFile(IDEAS_MD_PATH, 'utf-8');
  return parseIdeasMarkdown(raw);
}

export interface NewIdeaInput {
  type: IdeaType;
  title: string;
  meta?: string;
  extra?: Record<string, string>;
}

/** Thrown by appendIdea when the same title already exists under the same type. */
export class DuplicateIdeaError extends Error {}

/** Placeholder written for optional cells left blank, so every row keeps its full column count. */
const CELL_PLACEHOLDER = '-';

/** Returns a Korean reason string if `value` cannot be written into a markdown table cell, else null. */
export function invalidCellValue(value: string): string | null {
  if (value.includes('|')) return "'|' 문자는 표를 깨뜨려서 쓸 수 없습니다";
  if (/[\r\n]/.test(value)) return '줄바꿈은 쓸 수 없습니다';
  return null;
}

/** Next unused id for `type`, considering both ideas.md rows and leftover status.json keys. */
export function nextIdeaId(type: IdeaType, ideas: RawIdea[], status: StatusMap): string {
  let max = 0;
  for (const id of [...ideas.map((i) => i.id), ...Object.keys(status)]) {
    const match = id.match(/^([IBA])(\d+)$/);
    if (!match || match[1] !== type) continue;
    max = Math.max(max, parseInt(match[2], 10));
  }
  return `${type}${max + 1}`;
}

// Serializes ideas.md read-modify-write within this process, same rationale as
// withStatusLock below: cross-process races (a human editing ideas.md in an
// editor at the same instant) are an accepted, low-probability risk for a
// single-user local tool.
let ideasMutex: Promise<unknown> = Promise.resolve();

function withIdeasLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = ideasMutex.then(fn, fn);
  ideasMutex = result.catch(() => undefined);
  return result;
}

/**
 * Appends one row to the `## 타입 X —` table in ideas.md and returns the new idea.
 * Only table rows are touched: the 빠른 수익화 기회 / 향후 전략 / 우선순위 sections and
 * every table header/separator line are left byte-identical.
 */
export function appendIdea(input: NewIdeaInput): Promise<RawIdea> {
  return withIdeasLock(async () => {
    const raw = await fs.readFile(IDEAS_MD_PATH, 'utf-8');
    const eol = raw.includes('\r\n') ? '\r\n' : '\n';
    const lines = raw.split(/\r?\n/);

    const sectionStart = lines.findIndex((line) => {
      const match = line.match(SECTION_RE);
      return !!match && match[1] === input.type;
    });
    if (sectionStart === -1) {
      throw new Error(`ideas.md에 "## 타입 ${input.type}" 섹션이 없습니다`);
    }

    // Last table line before the next `##` heading — new rows go directly after it.
    let insertAt = -1;
    for (let i = sectionStart + 1; i < lines.length; i++) {
      if (HEADING_RE.test(lines[i])) break;
      if (lines[i].trim().startsWith('|')) insertAt = i;
    }
    if (insertAt === -1) {
      throw new Error(`ideas.md의 "## 타입 ${input.type}" 섹션에 표가 없습니다`);
    }

    const ideas = parseIdeasMarkdown(raw);
    const title = input.title.trim();
    const duplicate = ideas.find((i) => i.type === input.type && i.title === title);
    if (duplicate) {
      throw new DuplicateIdeaError(`같은 제목의 소재가 이미 있습니다 (${duplicate.id})`);
    }

    const status = await readStatus();
    const id = nextIdeaId(input.type, ideas, status);

    const cols = COLUMNS[input.type];
    const cells = [id, title, input.meta ?? ''];
    for (let i = 3; i < cols.length; i++) {
      cells.push(input.extra?.[cols[i]] ?? '');
    }
    // Every column must be filled — parseIdeasMarkdown skips rows with fewer cells than COLUMNS.
    const filled = cells.map((cell) => cell.trim() || CELL_PLACEHOLDER);

    lines.splice(insertAt + 1, 0, `| ${filled.join(' | ')} |`);

    const tmpPath = `${IDEAS_MD_PATH}.tmp`;
    await fs.writeFile(tmpPath, lines.join(eol));
    await fs.rename(tmpPath, IDEAS_MD_PATH);

    const idea: RawIdea = {
      id,
      type: input.type,
      title: filled[1],
      meta: filled[2],
      extra: {},
    };
    for (let i = 3; i < cols.length; i++) {
      idea.extra[cols[i]] = filled[i];
    }
    return idea;
  });
}

function timestampSlug(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function buildTaskContent(idea: RawIdea, now: Date): string {
  const metaLines = Object.entries(idea.extra)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n');

  return `# 초안 요청 — ${idea.title}

_Issued by mission-control (content-pipeline) | ${now.toISOString()}_
_아이디어 ID: ${idea.id} | 타입: ${idea.type}_

## 소재 정보
- 제목 아이디어: ${idea.title}
- meta: ${idea.meta}
${metaLines}

## 지침
1. \`projects/content-pipeline/style_guide.md\`의 타입 ${idea.type} 구조/톤/규칙을 따라 초안 작성
2. 완성된 초안을 \`projects/content-pipeline/drafts/${idea.id}-{설명slug}.txt\`로 저장
3. \`projects/content-pipeline/status.json\`의 \`"${idea.id}"\` 항목을 \`{status:"draft", draftFile:"drafts/${idea.id}-{설명slug}.txt"}\`로 갱신 (기존 필드 유지, 이 두 키만 덮어씀)
4. 이 파일을 \`projects/content-pipeline/tasks/_done/\`로 이동

알림 발송은 워쳐 스크립트가 별도로 처리하므로 신경 쓰지 않아도 됨.

## 완료 기준
- [ ] 초안 저장
- [ ] status.json 갱신
- [ ] 파일 _done/ 이동
`;
}

/** Writes a queue request file for `idea` and flips its status to "requested". Shared by fresh requests and redraft. */
export async function queueDraftRequest(idea: RawIdea): Promise<{ requestedAt: string }> {
  const now = new Date();
  const taskFile = path.join(TASKS_DIR, `${timestampSlug(now)}-${idea.id}.md`);

  await fs.mkdir(TASKS_DIR, { recursive: true });
  await fs.writeFile(taskFile, buildTaskContent(idea, now));

  const requestedAt = now.toISOString();
  await updateStatus(idea.id, {
    status: 'requested',
    requestedAt,
    draftFile: undefined,
    evaluationFile: undefined,
  });

  return { requestedAt };
}

/** Best-effort delete of a StatusEntry file (draftFile or evaluationFile). Missing file is not an error. */
export async function deleteFileIfExists(relPath: string | undefined): Promise<void> {
  if (!relPath) return;
  try {
    await fs.unlink(resolveInPipelineDir(relPath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

// Serializes all status.json reads/writes within this process so concurrent
// requests never interleave a read-modify-write. Cross-process races (e.g. a
// Claude Code session editing status.json at the same instant) are an
// accepted, low-probability risk for a single-user local tool.
let statusMutex: Promise<unknown> = Promise.resolve();

function withStatusLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = statusMutex.then(fn, fn);
  statusMutex = result.catch(() => undefined);
  return result;
}

async function loadStatusUnlocked(): Promise<StatusMap> {
  try {
    const data = await fs.readFile(STATUS_JSON_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function saveStatusUnlocked(status: StatusMap): Promise<void> {
  const tmpPath = `${STATUS_JSON_PATH}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(status, null, 2));
  await fs.rename(tmpPath, STATUS_JSON_PATH);
}

export function readStatus(): Promise<StatusMap> {
  return withStatusLock(loadStatusUnlocked);
}

/** Reads status.json, applies `patch` to entry `id`, writes it back atomically, returns the new entry. */
export function updateStatus(id: string, patch: Partial<StatusEntry>): Promise<StatusEntry> {
  return withStatusLock(async () => {
    const status = await loadStatusUnlocked();
    const current = status[id] ?? { status: 'idle' as IdeaStatus };
    const next: StatusEntry = { ...current, ...patch };
    status[id] = next;
    await saveStatusUnlocked(status);
    return next;
  });
}

export function mergeIdeaWithStatus(raw: RawIdea, status: StatusMap): Idea {
  const entry = status[raw.id] ?? { status: 'idle' as IdeaStatus };
  return { ...raw, ...entry };
}

export interface AutomationState {
  enabled: boolean;
  pid: number | null;
  startedAt: string | null;
  expiresAt: string | null;
  stoppedReason: string | null;
}

const DEFAULT_AUTOMATION_STATE: AutomationState = {
  enabled: false,
  pid: null,
  startedAt: null,
  expiresAt: null,
  stoppedReason: null,
};

let automationMutex: Promise<unknown> = Promise.resolve();

function withAutomationLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = automationMutex.then(fn, fn);
  automationMutex = result.catch(() => undefined);
  return result;
}

async function loadAutomationUnlocked(): Promise<AutomationState> {
  try {
    const data = await fs.readFile(AUTOMATION_JSON_PATH, 'utf-8');
    return { ...DEFAULT_AUTOMATION_STATE, ...JSON.parse(data) };
  } catch {
    return { ...DEFAULT_AUTOMATION_STATE };
  }
}

async function saveAutomationUnlocked(state: AutomationState): Promise<void> {
  const tmpPath = `${AUTOMATION_JSON_PATH}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(state, null, 2));
  await fs.rename(tmpPath, AUTOMATION_JSON_PATH);
}

export function readAutomation(): Promise<AutomationState> {
  return withAutomationLock(loadAutomationUnlocked);
}

export function writeAutomation(patch: Partial<AutomationState>): Promise<AutomationState> {
  return withAutomationLock(async () => {
    const current = await loadAutomationUnlocked();
    const next: AutomationState = { ...current, ...patch };
    await saveAutomationUnlocked(next);
    return next;
  });
}

/** True if a process with this PID is currently running (best-effort — does not confirm it's actually our watcher). */
export function isPidAlive(pid: number | null): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
