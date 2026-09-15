import fs from 'fs/promises';
import path from 'path';
import {
  CONTENT_PIPELINE_DIR,
  TASKS_DIR,
  RawIdea,
  StatusEntry,
  StatusMap,
  AffiliateLink,
  SignalRecord,
  emitSignal,
  fetchNaverPost,
  parseNaverPostUrl,
  readAffiliateLinks,
  readIdeas,
  readSignals,
  readStatus,
  readStrategy,
} from './content-pipeline';

/**
 * 2026-09-15: 발행글 개선 제안 — 발행된 글 하나를 라이브로 다시 읽고, 그 글의 조회수·링크 성과·보유 링크
 * 목록·세시간전 파트너 목록을 묶어 queue-watcher(claude -p)에게 "제휴링크 클릭률/조회수/유입/댓글 개선
 * 제안"을 요청한다. 초안 요청과 같은 큐(tasks/)를 쓰되 status.json은 건드리지 않는다 — 발행 상태와 제안
 * 이력은 별개라서 섞으면 published 필드를 덮어쓸 위험이 생긴다.
 *
 * 저장 구조 (improvements/{ideaId}/):
 *   {requestTs}.meta.json — mission-control이 요청 시점에 씀. 요청 당시 데이터 스냅샷(전후 비교 기준선) + 항목별 적용/무시 결정.
 *   {requestTs}.json      — claude -p가 씀. 제안 결과. 한 번 써진 뒤엔 아무도 수정하지 않는다.
 * LLM이 기존 JSON을 고치게 하지 않으려고 두 파일로 나눴다.
 */

export const IMPROVEMENTS_DIR = path.join(CONTENT_PIPELINE_DIR, 'improvements');
export const PERFORMANCE_JSON_PATH = path.join(CONTENT_PIPELINE_DIR, 'performance.json');
/** 세시간전 파트너 목록 — registry.json "3ha-affiliate-programs" collector의 출력(brain 노트). 없거나 못 읽으면 파트너 목록 없이 진행. */
export const THREE_HA_PROGRAMS_NOTE_PATH =
  process.env.THREE_HA_PROGRAMS_NOTE_PATH ||
  path.join(process.env.HOME || '', 'brain/notes/learn/2026-06-10-3ha-affiliate-programs.md');

const IDEA_ID_RE = /^[IBA]\d+$/;
const REQUEST_TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/;
const BLOG_ID = 'mesure';

export type ImprovementCategory =
  | 'link_add'
  | 'link_placement'
  | 'cta'
  | 'content_gap'
  | 'title'
  | 'keyword'
  | 'internal_link'
  | 'engagement';

export type LinkFitVerdict = 'fit' | 'weak' | 'unfit';

export interface ImprovementItem {
  id: string;
  category: ImprovementCategory;
  priority: 'high' | 'medium' | 'low';
  suggestion: string;
  rationale: string;
  link?: {
    url?: string;
    program?: string;
    needsNewLink?: boolean;
    productHint?: string;
  };
}

export interface ImprovementResult {
  ideaId: string;
  requestTs: string;
  generatedAt: string;
  linkFit: { verdict: LinkFitVerdict; reason: string };
  items: ImprovementItem[];
  dataCaveats?: string[];
}

export interface PostLinkSnapshot {
  url: string;
  kind: 'affiliate' | 'internal' | 'other';
  /** internal 링크가 우리 발행글이면 그 소재 ID */
  ideaId?: string;
  label?: string;
  program?: string;
  clicks?: number;
  conversionRate?: number | null;
  lastClickedAt?: string | null;
  /** 같은 링크가 다른 발행글에도 있으면 그 소재 ID들 — 있으면 클릭을 이 글 몫으로 귀속할 수 없다 */
  alsoUsedIn?: string[];
}

export interface ImprovementSnapshot {
  fetchedAt: string;
  title: string;
  url: string;
  publishedAt: string | null;
  daysSincePublish: number | null;
  textLength: number;
  imageCount: number;
  /** 2026-09-16: 본문 이미지 원본 파일명(순서대로). 스냅샷 이전 요청(09-15)엔 없다. */
  imageNames?: string[];
  /** 공정위(광고·제휴) 고지 감지 결과 — 텍스트 줄 또는 파일명이 고지 이미지로 보이는 이미지. 둘 다 null이면 "못 찾음"이지 "없음" 확정은 아니다. */
  disclosure?: { text: string | null; image: string | null };
  links: PostLinkSnapshot[];
  /** 조회수 순위 파일이 들어온 주(observedAt)마다의 이 글 조회수. 순위표에 없던 주는 null(사실상 0~1회). */
  weeklyViews: { observedAt: string; value: number | null }[];
}

export interface ImprovementDecision {
  decision: 'applied' | 'dismissed';
  decidedAt: string;
}

export interface ImprovementMeta {
  ideaId: string;
  requestTs: string;
  requestedAt: string;
  taskFile: string;
  snapshot: ImprovementSnapshot;
  decisions: Record<string, ImprovementDecision>;
}

export type ImprovementState = 'requested' | 'failed' | 'done';

export interface ImprovementRun {
  state: ImprovementState;
  meta: ImprovementMeta;
  result: ImprovementResult | null;
  /** state==='failed'일 때 이유 */
  error?: string;
}

export class ImprovementRequestError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function timestampSlug(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function ideaDir(ideaId: string): string {
  if (!IDEA_ID_RE.test(ideaId)) throw new ImprovementRequestError(`잘못된 소재 ID: ${ideaId}`, 400);
  return path.join(IMPROVEMENTS_DIR, ideaId);
}

function metaPath(ideaId: string, requestTs: string): string {
  if (!REQUEST_TS_RE.test(requestTs)) throw new ImprovementRequestError(`잘못된 요청 시각: ${requestTs}`, 400);
  return path.join(ideaDir(ideaId), `${requestTs}.meta.json`);
}

function resultPath(ideaId: string, requestTs: string): string {
  if (!REQUEST_TS_RE.test(requestTs)) throw new ImprovementRequestError(`잘못된 요청 시각: ${requestTs}`, 400);
  return path.join(ideaDir(ideaId), `${requestTs}.json`);
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2));
  await fs.rename(tmpPath, filePath);
}

// 같은 이유(단일 사용자 로컬 도구)로 프로세스 내 직렬화만 한다 — content-pipeline.ts의 statusMutex 참고.
let metaMutex: Promise<unknown> = Promise.resolve();

function withMetaLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = metaMutex.then(fn, fn);
  metaMutex = result.catch(() => undefined);
  return result;
}

function logNoOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return parseNaverPostUrl(url).logNo;
  } catch {
    return null;
  }
}

const AFFILIATE_HOSTS = ['3ha.in', 'naver.me', 'link.coupang.com', 'brandconnect.naver.com'];

/** 다른 발행글에 같은 제휴링크가 있는지 — status.json의 affiliateLink + 발행 스냅샷(drafts/*-published.txt) 기준. 발행 후 네이버에서 직접 고친 내용은 스냅샷에 없을 수 있다. */
async function findLinkUsage(url: string, status: StatusMap, excludeId: string): Promise<string[]> {
  const used = new Set<string>();
  for (const [id, entry] of Object.entries(status)) {
    if (id === excludeId || entry.status !== 'published') continue;
    if (entry.affiliateLink === url) {
      used.add(id);
      continue;
    }
    if (entry.publishedFile) {
      try {
        const text = await fs.readFile(path.join(CONTENT_PIPELINE_DIR, entry.publishedFile), 'utf-8');
        if (text.includes(url)) used.add(id);
      } catch {
        // 스냅샷이 없으면 확인 불가 — 조용히 건너뛴다
      }
    }
  }
  return [...used];
}

async function classifyLinks(
  urls: string[],
  ideaId: string,
  status: StatusMap,
  catalog: AffiliateLink[]
): Promise<PostLinkSnapshot[]> {
  const byLogNo = new Map<string, string>();
  for (const [id, entry] of Object.entries(status)) {
    const logNo = logNoOf(entry.publishedUrl);
    if (logNo) byLogNo.set(logNo, id);
  }

  const snapshots: PostLinkSnapshot[] = [];
  for (const url of urls) {
    const catalogHit = catalog.find((l) => l.url === url);
    let host = '';
    try {
      host = new URL(url).hostname;
    } catch {
      // 파싱 안 되는 URL은 other로 둔다
    }

    if (catalogHit || AFFILIATE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
      snapshots.push({
        url,
        kind: 'affiliate',
        label: catalogHit?.label,
        program: catalogHit?.program,
        clicks: catalogHit?.clicks,
        conversionRate: catalogHit?.conversionRate,
        lastClickedAt: catalogHit?.lastClickedAt,
        alsoUsedIn: await findLinkUsage(url, status, ideaId),
      });
      continue;
    }

    if (host.endsWith('blog.naver.com') && url.includes(BLOG_ID)) {
      const linkedId = byLogNo.get(logNoOf(url) ?? '');
      snapshots.push({ url, kind: 'internal', ...(linkedId ? { ideaId: linkedId } : {}) });
      continue;
    }

    snapshots.push({ url, kind: 'other' });
  }
  return snapshots;
}

function weeklyViewsFor(
  ideaId: string,
  publishedAt: string | undefined,
  signals: SignalRecord[]
): ImprovementSnapshot['weeklyViews'] {
  // 조회수 순위 파일이 들어온 주 = 어떤 글이든 weeklyViews 신호가 찍힌 observedAt(주 마지막 날). 이 글이 그 주에 없으면 순위 밖.
  // 발행 전에 끝난 주는 "순위 밖"이 아니라 해당 없음이라 뺀다.
  const weeks = [...new Set(signals.filter((s) => s.metric === 'weeklyViews').map((s) => s.observedAt))]
    .filter((week) => !publishedAt || week >= publishedAt)
    .sort();
  return weeks.map((week) => {
    const hit = signals.find((s) => s.metric === 'weeklyViews' && s.entityId === ideaId && s.observedAt === week);
    return { observedAt: week, value: hit ? Number(hit.value) : null };
  });
}

/** 링크별 클릭 추이 — 값이 바뀐 날만 남긴다(매일 같은 값이 쌓여서). */
function clickHistory(link: AffiliateLink, signals: SignalRecord[]): string {
  const rows = signals
    .filter((s) => s.entityId === `3ha-link-${link.id}` && s.metric === 'clicks')
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  const changes: string[] = [];
  let prev: string | null = null;
  for (const row of rows) {
    const value = String(row.value);
    if (value !== prev) changes.push(`${row.observedAt}:${value}`);
    prev = value;
  }
  return changes.join(' → ');
}

/** 최근 1주 블로그 전체 유입 검색어. 유입분석 파일은 같은 검색어를 채널(PC/모바일 등)별로 따로 적어서 검색어 단위로 합치고, 검색어가 아닌 URL 유입(m.naver.com 등)은 뺀다. */
function latestSiteInflowKeywords(signals: SignalRecord[]): { week: string | null; rows: string[] } {
  const keywordSignals = signals.filter((s) => s.entityId === '_site' && s.metric === 'weeklyInflowKeywordShare');
  const week = keywordSignals.map((s) => s.observedAt).sort().pop() ?? null;
  if (!week) return { week: null, rows: [] };
  const shares = new Map<string, number>();
  for (const s of keywordSignals) {
    if (s.observedAt !== week) continue;
    const raw = String(s.value);
    const sep = raw.lastIndexOf(':');
    const keyword = raw.slice(0, sep).trim();
    const share = Number(raw.slice(sep + 1));
    if (!keyword || /^https?:\/\//.test(keyword) || Number.isNaN(share)) continue;
    shares.set(keyword, (shares.get(keyword) ?? 0) + share);
  }
  const rows = [...shares.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([keyword, share]) => `${keyword}:${share.toFixed(2)}`);
  return { week, rows };
}

/** brain 노트의 "빠른 참조" 표에서 파트너명·수수료·쿠키·카테고리만 뽑는다. 원문 전체(160KB+)는 프롬프트에 넣기엔 너무 크다. */
async function readThreeHaProgramsDigest(): Promise<string | null> {
  let raw: string;
  try {
    raw = await fs.readFile(THREE_HA_PROGRAMS_NOTE_PATH, 'utf-8');
  } catch {
    return null;
  }
  const start = raw.indexOf('## 빠른 참조');
  if (start === -1) return null;
  const end = raw.indexOf('\n---', start);
  const section = raw.slice(start, end === -1 ? undefined : end);
  const rows = section
    .split('\n')
    .filter((line) => line.startsWith('| **'))
    .map((line) => {
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      const name = cells[0].replace(/\*\*/g, '').replace('📖', '').trim();
      return `- ${name} | 수수료 ${cells[1]} | 쿠키 ${cells[2]} | ${cells[cells.length - 1] || '-'}`;
    });
  return rows.length ? rows.join('\n') : null;
}

/**
 * 공정위 고지 감지. 2026-09-16 실측: B1·B8은 본문 첫머리 "[공지] 이 포스팅은 … 제휴/수수료" 텍스트,
 * A2·I4는 이미지("2.크리에이터_공정위문구_로고.png", "세시간전_크리에이터_권장_문구_배너.png").
 * 텍스트만 넘기던 09-15 버전은 이미지 고지를 못 봐서 A2에 "공정위 문구 없음"을 제안했다.
 */
const DISCLOSURE_TEXT_RE = /^.*(?:\[공지\]|이 포스팅은).*(?:제휴|수수료|광고|협찬|커넥트).*$/m;
const DISCLOSURE_IMAGE_RE = /공정위|크리에이터|권장.?문구|광고|협찬|제휴|공지/;

function detectDisclosure(text: string, imageNames: string[]): { text: string | null; image: string | null } {
  return {
    text: text.match(DISCLOSURE_TEXT_RE)?.[0].trim() ?? null,
    image: imageNames.find((name) => DISCLOSURE_IMAGE_RE.test(name)) ?? null,
  };
}

function daysBetween(fromDate: string, to: Date): number {
  return Math.floor((to.getTime() - new Date(fromDate).getTime()) / (1000 * 60 * 60 * 24));
}

function formatLinkForPrompt(link: AffiliateLink, usedIn: string[], signals: SignalRecord[]): string {
  const conv = link.conversionRate === null ? '-' : `${(link.conversionRate * 100).toFixed(1)}%`;
  const history = link.source === '3ha' ? clickHistory(link, signals) : '';
  return [
    `- [${link.source}] ${link.label} (${link.program} — ${link.productTitle})`,
    `  url=${link.url} | 클릭 ${link.clicks} | 전환 ${conv} | 최근클릭 ${link.lastClickedAt ?? '없음'}`,
    `  미션보드 발행글 중 사용: ${usedIn.length ? usedIn.join(', ') : '없음'} (미션보드 밖 옛 글에 쓰였을 수 있음 — 클릭이 있으면 그 글에서 난 것)`,
    history ? `  클릭 추이: ${history}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildImprovementTask(args: {
  idea: RawIdea;
  entry: StatusEntry;
  requestTs: string;
  now: Date;
  snapshot: ImprovementSnapshot;
  bodyText: string;
  strategy: Record<string, string> | null;
  performanceChecks: unknown;
  catalogLines: string;
  siteKeywords: { week: string | null; rows: string[] };
  programsDigest: string | null;
  otherPosts: string;
}): string {
  const { idea, entry, requestTs, now, snapshot, bodyText } = args;
  const resultRel = `improvements/${idea.id}/${requestTs}.json`;
  const title = entry.publishedTitle ?? idea.title;

  return `# 개선 제안 요청 — ${title}

_Issued by mission-control (content-pipeline) | ${now.toISOString()}_
_작업 유형: improve | 아이디어 ID: ${idea.id} | 타입: ${idea.type}_

이건 **초안 작성 요청이 아니다.** 이미 네이버에 발행된 글을 읽고 개선 제안을 JSON 파일 하나로 쓰는 작업이다.
초안 파일·status.json·ideas.md·performance.json 등 다른 파일은 **읽기만 하고 절대 수정하지 않는다.**

## 목표 (우선순위 순)
1. 제휴링크 클릭률 높이기 — 이 글에 제휴링크를 넣을 만한지부터 판단한다.
2. 제휴링크를 넣기 어려운 글이면 무엇을 보완해야 넣을 수 있는지, 또는 억지로 넣지 말아야 하는지.
3. 제휴와 무관하게 조회수·검색유입·댓글을 늘릴 방법.

## 발행글 정보
- 소재 ID/타입: ${idea.id} / ${idea.type} (I=정보성, B=방법공유·제휴, A=숙소후기·제휴)
- 소재 표 정보: ${idea.meta}${Object.entries(idea.extra).map(([k, v]) => ` | ${k}: ${v}`).join('')}
- 발행 제목: ${title}
- URL: ${snapshot.url}
- 발행일: ${snapshot.publishedAt ?? '미상'} (요청 시점 기준 ${snapshot.daysSincePublish ?? '?'}일 경과)
- 기록된 제휴 프로그램/링크(status.json): ${entry.affiliateProgram ?? '없음'} / ${entry.affiliateLink ?? '없음'}
- 본문 길이 ${snapshot.textLength}자, 이미지 ${snapshot.imageCount}장

## 요청 시점 데이터 스냅샷 (mission-control이 계산 — 이 값이 사실 기준)
\`\`\`json
${JSON.stringify(snapshot, null, 2)}
\`\`\`
- weeklyViews의 value가 null인 주 = 네이버 "조회수 순위" 표에 이 글이 없었던 주(사실상 0~1회).
- links[].kind: affiliate=제휴링크, internal=내 블로그 다른 글(ideaId 있으면 우리 발행글), other=그 외.
- links[].alsoUsedIn이 비어있지 않으면 같은 링크가 다른 글에도 있어서 클릭 수를 이 글 몫으로 볼 수 없다.

## 라이브 본문 (네이버에서 방금 가져온 텍스트 — 링크 카드 URL은 위 links에만 있음)
\`\`\`
${bodyText}
\`\`\`

## 작성 당시 전략 (strategy.json — 라이브 내용과 다를 수 있음, 충돌하면 라이브가 우선)
\`\`\`json
${JSON.stringify(args.strategy, null, 2)}
\`\`\`

## 이전 성과 진단 이력 (performance.json)
\`\`\`json
${JSON.stringify(args.performanceChecks ?? null, null, 2)}
\`\`\`

## 블로그 전체 유입 검색어 (${args.siteKeywords.week ?? '데이터 없음'}에 끝난 주, ${args.siteKeywords.rows.length}개, "검색어:비율%", 채널 합산)
**글 단위가 아니라 블로그 전체 합계다.** 이 글의 주제와 명백히 겹치는 검색어만 이 글 유입으로 추정하고, 추정이라고 밝혀라.
${args.siteKeywords.rows.map((r) => `- ${r}`).join('\n') || '- (없음)'}

## 내가 이미 가진 제휴링크 (3ha + 네이버 브랜드커넥트)
${args.catalogLines || '- (없음)'}

## 세시간전 파트너 목록 (2026-06-10 스냅샷 — 이후 신규/종료 파트너는 반영 안 됐을 수 있음)
실질 수익률은 ROOKIE 등급 기준 수수료 × 70% (style_guide.md 참고).
${args.programsDigest ?? '- (파트너 목록 파일을 읽지 못함 — style_guide.md의 파트너 표만 참고)'}

## 내 다른 발행글 (내부링크 후보)
${args.otherPosts || '- (없음)'}

## 판단 규칙
- \`style_guide.md\`의 "제휴링크 삽입 방식"(초반·중간·마무리 3곳, 중간은 가격 언급 직후), "정책 필수사항"(공정위 문구), \`workflow.md\` "4단계 — 진단"의 조회수-클릭-판매 매트릭스를 적용한다.
- **조회수가 작다(글당 주 0~23회).** 클릭률 수치로 결론 내리지 말고, 데이터가 부족하면 부족하다고 쓴다. 발행 당일에만 클릭이 몰린 링크(최근클릭일=발행일)는 자기 클릭/테스트일 수 있어 근거로 약하다.
- 제휴가 주제와 안 맞으면 linkFit을 "unfit"으로 두고 링크를 억지로 넣는 제안을 하지 않는다. 대신 보완점·트래픽·댓글 제안을 한다.
- 링크 제안(link_add)은 위 "이미 가진 제휴링크" 중 맞는 상품이 있어도 **클릭 이력이 있거나 다른 발행글에 쓰이는 링크는 돌려 쓰지 말고, 같은 상품으로 이 글 전용 링크를 새로 발급**하라고 제안한다(needsNewLink=true, url에는 참고용 기존 링크) — 링크를 여러 글에 돌려 쓰면 글별 클릭을 구분할 수 없다. 클릭 0회이고 어디에도 안 쓰인 링크만 그대로 써도 된다. 가진 링크가 없으면 파트너 목록에서 고르고 needsNewLink=true, productHint에 어떤 상품/페이지로 발급할지 쓴다.
- 공정위 고지는 스냅샷의 \`disclosure\`로 판단한다. text나 image 중 하나라도 값이 있으면 **고지가 있는 것**이다 — 이미지로 넣은 고지는 본문 텍스트에 안 나오므로 텍스트에 [공지]가 없다는 이유로 "없다"고 하지 않는다. 둘 다 null인데 제휴링크가 있거나 새로 넣자고 제안할 때만 고지 항목을 넣고, 파일명으로 못 알아본 이미지일 수 있으니 "[직접 확인 필요]"를 붙인다. \`imageNames\`는 본문 이미지 원본 파일명이다.
- 제안은 **본문을 근거로 구체적으로**: 어느 문장/섹션 뒤에 무엇을 넣을지 본문을 짧게 인용해서 위치를 지정하고, 넣을 문구 예시를 준다.
- 라이브 본문은 HTML에서 뽑은 텍스트라 이미지·링크 카드·글자 서식은 보이지 않는다. 텍스트만 보고 "깨졌다/없다"고 단정할 수 있는 건 텍스트에 그대로 드러난 것뿐이다(예: 초안의 \`[링크]\` 같은 플레이스홀더가 그대로 노출). 이미지 안에 있을 수 있는 내용(공정위 문구·가격 등)이 텍스트에 없으면 "[직접 확인 필요]"를 붙인다.
- **글쓴이의 경험을 지어내지 않는다.** 본문에 없는 경험을 사실처럼 쓰는 문구를 제안하지 말고, 경험이 필요하면 "[직접 확인 필요]"라고 표시한다.
- 웹검색은 하지 않는다. 위에 준 데이터와 본문만으로 판단한다 — \`improvements/\`의 이전 제안 파일, git 이력, 다른 파일을 열어 비교하지 않는다(텍스트 추출 방식이 바뀌면 글자 수가 달라져 "글이 수정됐다"로 오판한다, 2026-09-15 실제 발생).
- 항목은 3~7개, 효과가 큰 순서로.

## 출력
\`${resultRel}\` 에 아래 스키마의 JSON을 Write 도구로 새로 쓴다(경로는 content-pipeline 폴더 기준 — 이 경로 그대로, 다른 파일명 금지):
\`\`\`json
{
  "ideaId": "${idea.id}",
  "requestTs": "${requestTs}",
  "generatedAt": "<ISO 8601 현재 시각>",
  "linkFit": { "verdict": "fit | weak | unfit", "reason": "한두 문장" },
  "items": [
    {
      "id": "s1",
      "category": "link_add | link_placement | cta | content_gap | title | keyword | internal_link | engagement",
      "priority": "high | medium | low",
      "suggestion": "무엇을 어디에 어떻게 — 본문 인용으로 위치 지정 + 넣을 문구 예시",
      "rationale": "근거 — 스냅샷 수치/본문/규칙 중 무엇에 기반했는지",
      "link": { "url": "기존 링크면 url", "program": "파트너명", "needsNewLink": true, "productHint": "새로 발급할 상품/페이지" }
    }
  ],
  "dataCaveats": ["판단에 쓴 데이터의 한계"]
}
\`\`\`
- \`link\`는 link_add / link_placement 항목에만 넣고, 나머지 항목에는 키 자체를 뺀다.
- id는 s1, s2, ... 순서대로.
- category 뜻: link_add=새 링크 추가, link_placement=기존 링크 위치·개수, cta=링크 앞뒤 클릭 유도 문구, content_gap=넣을 수 있게 보완할 내용, title=제목, keyword=검색 키워드·소제목, internal_link=내 다른 글 연결, engagement=댓글·공감 유도.

## 절차
1. 위 자료로 판단 → 결과 JSON을 위 경로에 Write
2. \`python3 -m json.tool ${resultRel}\` 로 JSON 유효성 확인, 깨졌으면 고쳐서 다시 확인
3. 이 task 파일을 \`tasks/_done/\`으로 mv
`;
}

/**
 * 발행글 1건에 대한 개선 제안 요청을 큐에 넣는다. 라이브 글 수집은 여기서 한다 —
 * claude -p(WebFetch)는 blog.naver.com robots.txt 때문에 이 글을 못 읽는다(content-pipeline.ts fetchNaverPost 주석 참고).
 */
export function queueImprovementRequest(ideaId: string): Promise<ImprovementMeta> {
  // 대기중 확인 → 파일 생성 사이에 같은 소재 요청이 끼어들지 않게 결정 기록과 같은 잠금을 쓴다.
  return withMetaLock(() => queueImprovementRequestUnlocked(ideaId));
}

async function queueImprovementRequestUnlocked(ideaId: string): Promise<ImprovementMeta> {
  const dir = ideaDir(ideaId);
  const [ideas, status] = await Promise.all([readIdeas(), readStatus()]);
  const idea = ideas.find((i) => i.id === ideaId);
  const entry = status[ideaId];
  if (!idea || !entry) throw new ImprovementRequestError(`${ideaId} 소재를 찾을 수 없습니다`, 404);
  if (entry.status !== 'published' || !entry.publishedUrl) {
    throw new ImprovementRequestError(`${ideaId}는 발행완료 상태가 아닙니다`, 400);
  }

  const latest = (await readLatestImprovementRuns([ideaId]))[ideaId];
  if (latest?.state === 'requested') {
    throw new ImprovementRequestError(`${ideaId}는 이미 개선 제안 작성 대기중입니다`, 409);
  }

  const now = new Date();
  const requestTs = timestampSlug(now);
  const [post, signals, affiliateLinks, strategy, performance, programsDigest] = await Promise.all([
    fetchNaverPost(entry.publishedUrl),
    readSignals(),
    readAffiliateLinks(),
    readStrategy(),
    readJson<Record<string, { checks?: unknown }>>(PERFORMANCE_JSON_PATH),
    readThreeHaProgramsDigest(),
  ]);

  const snapshot: ImprovementSnapshot = {
    fetchedAt: now.toISOString(),
    title: post.title,
    url: entry.publishedUrl,
    publishedAt: entry.publishedAt ?? null,
    daysSincePublish: entry.publishedAt ? daysBetween(entry.publishedAt, now) : null,
    textLength: post.text.length,
    imageCount: post.imageCount,
    imageNames: post.imageNames,
    disclosure: detectDisclosure(post.text, post.imageNames),
    links: await classifyLinks(post.links, ideaId, status, affiliateLinks.links),
    weeklyViews: weeklyViewsFor(ideaId, entry.publishedAt, signals),
  };

  const catalogLines = (
    await Promise.all(
      affiliateLinks.links.map(async (link) =>
        formatLinkForPrompt(link, await findLinkUsage(link.url, status, ''), signals)
      )
    )
  ).join('\n');

  const otherPosts = ideas
    .filter((i) => i.id !== ideaId && status[i.id]?.status === 'published')
    .map((i) => `- ${i.id} (${i.type}) ${status[i.id]?.publishedTitle ?? i.title} — ${status[i.id]?.publishedUrl}`)
    .join('\n');

  const taskFileName = `${requestTs}-${ideaId}-improve.md`;
  const meta: ImprovementMeta = {
    ideaId,
    requestTs,
    requestedAt: now.toISOString(),
    taskFile: taskFileName,
    snapshot,
    decisions: {},
  };

  await fs.mkdir(dir, { recursive: true });
  await writeJsonAtomic(metaPath(ideaId, requestTs), meta);
  await fs.mkdir(TASKS_DIR, { recursive: true });
  await fs.writeFile(
    path.join(TASKS_DIR, taskFileName),
    buildImprovementTask({
      idea,
      entry,
      requestTs,
      now,
      snapshot,
      bodyText: post.text,
      strategy: strategy[ideaId] ?? null,
      performanceChecks: performance?.[ideaId]?.checks,
      catalogLines,
      siteKeywords: latestSiteInflowKeywords(signals),
      programsDigest,
      otherPosts,
    })
  );

  return meta;
}

function isValidResult(value: unknown): value is ImprovementResult {
  if (!value || typeof value !== 'object') return false;
  const r = value as ImprovementResult;
  return (
    !!r.linkFit &&
    ['fit', 'weak', 'unfit'].includes(r.linkFit.verdict) &&
    Array.isArray(r.items) &&
    r.items.every((item) => typeof item?.id === 'string' && typeof item?.suggestion === 'string')
  );
}

async function loadRun(ideaId: string, requestTs: string): Promise<ImprovementRun | null> {
  const meta = await readJson<ImprovementMeta>(metaPath(ideaId, requestTs));
  if (!meta) return null;

  let rawResult: string | null = null;
  try {
    rawResult = await fs.readFile(resultPath(ideaId, requestTs), 'utf-8');
  } catch {
    // 아직 안 써짐
  }

  if (rawResult !== null) {
    try {
      const parsed = JSON.parse(rawResult);
      if (isValidResult(parsed)) return { state: 'done', meta, result: parsed };
      return { state: 'failed', meta, result: null, error: '결과 파일 스키마가 예상과 다릅니다' };
    } catch {
      return { state: 'failed', meta, result: null, error: '결과 파일 JSON이 깨졌습니다' };
    }
  }

  const taskPending = await fs
    .access(path.join(TASKS_DIR, meta.taskFile))
    .then(() => true)
    .catch(() => false);
  if (taskPending) return { state: 'requested', meta, result: null };
  return {
    state: 'failed',
    meta,
    result: null,
    error: '요청 파일은 처리됐는데 결과 파일이 없습니다 — automation.log 확인 필요',
  };
}

/** 소재별 가장 최근 요청 1건. ideaIds를 주면 그 소재만, 없으면 improvements/ 아래 전부. */
export async function readLatestImprovementRuns(ideaIds?: string[]): Promise<Record<string, ImprovementRun>> {
  let ids = ideaIds;
  if (!ids) {
    try {
      ids = (await fs.readdir(IMPROVEMENTS_DIR, { withFileTypes: true }))
        .filter((d) => d.isDirectory() && IDEA_ID_RE.test(d.name))
        .map((d) => d.name);
    } catch {
      ids = [];
    }
  }

  const runs: Record<string, ImprovementRun> = {};
  for (const id of ids) {
    let files: string[];
    try {
      files = await fs.readdir(ideaDir(id));
    } catch {
      continue;
    }
    const latestTs = files
      .filter((f) => f.endsWith('.meta.json'))
      .map((f) => f.slice(0, -'.meta.json'.length))
      .filter((ts) => REQUEST_TS_RE.test(ts))
      .sort()
      .pop();
    if (!latestTs) continue;
    const run = await loadRun(id, latestTs);
    if (run) runs[id] = run;
  }
  return runs;
}

/** 제안 항목 하나를 적용/무시로 표시하거나(decision=null이면 표시 해제) — 적용이면 Signal Bus에 남겨 이후 조회수·클릭 전후 비교의 기준일로 쓴다. */
export function setImprovementDecision(
  ideaId: string,
  requestTs: string,
  itemId: string,
  decision: ImprovementDecision['decision'] | null
): Promise<ImprovementMeta> {
  return withMetaLock(async () => {
    const run = await loadRun(ideaId, requestTs);
    if (!run) throw new ImprovementRequestError('해당 개선 제안 요청을 찾을 수 없습니다', 404);
    const item = run.result?.items.find((i) => i.id === itemId);
    if (!item) throw new ImprovementRequestError(`제안 항목 ${itemId}을 찾을 수 없습니다`, 404);

    const meta = run.meta;
    const decisions = { ...meta.decisions };
    const decidedAt = new Date().toISOString();
    if (decision) decisions[itemId] = { decision, decidedAt };
    else delete decisions[itemId];

    const next: ImprovementMeta = { ...meta, decisions };
    await writeJsonAtomic(metaPath(ideaId, requestTs), next);

    // Signal Bus는 append-only라 되돌림도 별도 이벤트로 남긴다. 현재 상태의 기준은 meta.decisions.
    const wasApplied = meta.decisions[itemId]?.decision === 'applied';
    const metric = decision === 'applied' ? 'improvementApplied' : wasApplied ? 'improvementApplyReverted' : null;
    if (metric && !(decision === 'applied' && wasApplied)) {
      await emitSignal({
        source: 'pipeline',
        project: 'content-pipeline',
        entityId: ideaId,
        metric,
        value: `${requestTs}/${itemId}:${item.category}`,
        observedAt: new Date().toLocaleDateString('sv', { timeZone: 'Asia/Seoul' }),
      });
    }
    return next;
  });
}
