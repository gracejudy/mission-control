"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Newspaper,
  Loader2,
  ExternalLink,
  Send,
  Save,
  CheckCircle2,
  Lightbulb,
  Handshake,
  BedDouble,
  Hourglass,
  PenLine,
  Sparkles,
  Power,
  PowerOff,
  RotateCw,
  Search,
  Plus,
  X,
} from "lucide-react";

interface AutomationState {
  enabled: boolean;
  pid: number | null;
  startedAt: string | null;
  expiresAt: string | null;
  stoppedReason: string | null;
  alive: boolean;
  remainingSeconds: number | null;
}

interface Idea {
  id: string;
  type: "I" | "B" | "A";
  title: string;
  meta: string;
  extra: Record<string, string>;
  status: "idle" | "requested" | "draft" | "published";
  requestedAt?: string;
  draftFile?: string;
  publishedFile?: string;
  publishedUrl?: string;
  publishedAt?: string;
}

const TYPE_META: Record<
  Idea["type"],
  { label: string; sub: string; icon: typeof Lightbulb; color: string }
> = {
  I: { label: "정보성", sub: "제휴링크 없음 · 케이던스용", icon: Lightbulb, color: "var(--info)" },
  B: { label: "방법/핵 공유", sub: "제휴링크 포함", icon: Handshake, color: "var(--accent)" },
  A: { label: "숙소 후기", sub: "직접 경험 필요", icon: BedDouble, color: "var(--warning)" },
};

// 소재 추가 폼의 타입별 입력 필드. key 는 ideas.md 표의 컬럼명(서버 COLUMNS)과 1:1 대응 —
// "title"/"meta" 는 최상위 필드로, 나머지는 extra 로 전송된다.
const FORM_FIELDS: Record<
  Idea["type"],
  { key: string; label: string; placeholder: string; kind?: "keyword" | "competition" }[]
> = {
  I: [
    { key: "title", label: "제목 아이디어", placeholder: "유심 vs 이심, 일본 여행 뭐가 더 낫나요" },
    { key: "meta", label: "키워드", placeholder: "일본여행이심", kind: "keyword" },
    { key: "volume", label: "검색량", placeholder: "2,520" },
    { key: "competition", label: "경쟁", placeholder: "중간", kind: "competition" },
  ],
  B: [
    { key: "title", label: "제목 아이디어", placeholder: "태국 여행 유심 싸게 사는 법" },
    { key: "meta", label: "파트너", placeholder: "유심사" },
    { key: "linkNeeded", label: "링크 필요", placeholder: "세시간전 유심사 링크" },
  ],
  A: [
    { key: "title", label: "소재", placeholder: "다낭 OO호텔 숙박 후기" },
    { key: "meta", label: "파트너", placeholder: "아고다" },
    { key: "memo", label: "메모", placeholder: "2026-05 방문, 사진 있음" },
  ],
};

const COMPETITION_OPTIONS = ["낮음", "중간", "높음"];

const STATUS_META: Record<Idea["status"], { label: string; color: string }> = {
  idle: { label: "대기", color: "var(--text-muted)" },
  requested: { label: "요청됨", color: "var(--warning)" },
  draft: { label: "초안 있음", color: "var(--info)" },
  published: { label: "발행완료", color: "var(--success)" },
};

function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div
      className="px-5 py-4 rounded-xl"
      style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", minWidth: 140 }}
    >
      <p
        className="mb-1.5"
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--font-heading)", color: "var(--text-primary)", letterSpacing: "-0.5px" }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

function IconBadge({ icon: Icon, color, size = 18 }: { icon: typeof Lightbulb; color: string; size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg flex-shrink-0"
      style={{
        width: size + 16,
        height: size + 16,
        backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
      }}
    >
      <Icon style={{ width: size, height: size, color }} />
    </div>
  );
}

function PrimaryButton({
  onClick,
  disabled,
  color,
  icon: Icon,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  color: string;
  icon?: typeof Lightbulb;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-xs font-semibold px-3.5 py-2 rounded-lg inline-flex items-center gap-1.5 transition-opacity disabled:opacity-50"
      style={{ backgroundColor: color, color: "#fff" }}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
    </button>
  );
}

export default function ContentPipelinePage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestingId, setRequestingId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [evaluation, setEvaluation] = useState<{ filename: string; content: string } | null>(null);

  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishUrl, setPublishUrl] = useState("");
  const [publishText, setPublishText] = useState("");
  const [publishSubmitting, setPublishSubmitting] = useState(false);

  const [automation, setAutomation] = useState<AutomationState | null>(null);
  const [automationBusy, setAutomationBusy] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState<Idea["type"]>("I");
  const [newFields, setNewFields] = useState<Record<string, string>>({});
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupNote, setLookupNote] = useState<string | null>(null);

  const fetchIdeas = useCallback(async () => {
    try {
      const res = await fetch("/api/content-pipeline/ideas");
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setIdeas(data.ideas ?? []);
      setError(null);
    } catch {
      setError("소재 목록을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAutomation = useCallback(async () => {
    try {
      const res = await fetch("/api/content-pipeline/automation/status");
      if (res.ok) setAutomation(await res.json());
    } catch {
      // 상태 조회 실패는 조용히 무시 — 다음 폴링에서 재시도
    }
  }, []);

  useEffect(() => {
    fetchIdeas();
    const interval = setInterval(fetchIdeas, 60000);
    return () => clearInterval(interval);
  }, [fetchIdeas]);

  useEffect(() => {
    fetchAutomation();
    const interval = setInterval(fetchAutomation, 10000);
    return () => clearInterval(interval);
  }, [fetchAutomation]);

  // 서버 폴링은 10초 간격이라 그 사이는 클라이언트에서 매초 직접 카운트다운
  useEffect(() => {
    const tick = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [fetchAutomation]);

  const toggleAutomation = async () => {
    setAutomationBusy(true);
    try {
      const endpoint = automation?.enabled
        ? "/api/content-pipeline/automation/stop"
        : "/api/content-pipeline/automation/start";
      const res = await fetch(endpoint, { method: "POST" });
      if (res.ok) setAutomation(await res.json());
    } finally {
      setAutomationBusy(false);
    }
  };

  const openAddModal = () => {
    setNewType("I");
    setNewFields({});
    setAddError(null);
    setLookupNote(null);
    setAdding(true);
  };

  const changeNewType = (type: Idea["type"]) => {
    setNewType(type);
    // 타입마다 컬럼이 달라서 이전 입력을 옮길 수 없다 — 제목만 유지하고 나머지는 비운다.
    setNewFields((prev) => ({ title: prev.title ?? "" }));
    setAddError(null);
    setLookupNote(null);
  };

  const lookupKeyword = async () => {
    const keyword = (newFields.meta ?? "").trim();
    if (!keyword) return;
    setLookupBusy(true);
    setLookupNote(null);
    try {
      const res = await fetch("/api/content-pipeline/keyword-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLookupNote(data.error ?? "조회에 실패했습니다");
        return;
      }
      if (!data.exact) {
        setLookupNote(`"${data.keyword}" 정확 일치 결과가 없습니다 — 직접 입력해주세요`);
        return;
      }
      setNewFields((prev) => ({
        ...prev,
        volume: data.exact.total.toLocaleString(),
        competition: data.exact.comp || prev.competition || "",
      }));
      setLookupNote(
        `조회됨 · PC ${data.exact.pc.toLocaleString()} / 모바일 ${data.exact.mobile.toLocaleString()}${
          data.exact.sweet ? " · 스위트스팟 ★" : ""
        }`
      );
    } catch {
      setLookupNote("조회에 실패했습니다");
    } finally {
      setLookupBusy(false);
    }
  };

  const submitNewIdea = async () => {
    const title = (newFields.title ?? "").trim();
    if (!title) {
      setAddError("제목을 입력해주세요");
      return;
    }
    const extra: Record<string, string> = {};
    for (const field of FORM_FIELDS[newType]) {
      if (field.key === "title" || field.key === "meta") continue;
      extra[field.key] = (newFields[field.key] ?? "").trim();
    }

    setAddSubmitting(true);
    setAddError(null);
    try {
      const res = await fetch("/api/content-pipeline/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: newType, title, meta: (newFields.meta ?? "").trim(), extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error ?? "소재 등록에 실패했습니다");
        return;
      }
      setAdding(false);
      await fetchIdeas();
    } catch {
      setAddError("소재 등록에 실패했습니다");
    } finally {
      setAddSubmitting(false);
    }
  };

  const requestDraft = async (id: string) => {
    setRequestingId(id);
    try {
      const res = await fetch("/api/content-pipeline/request-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaId: id }),
      });
      if (res.ok) await fetchIdeas();
    } finally {
      setRequestingId(null);
    }
  };

  const redraft = async (id: string) => {
    setRequestingId(id);
    try {
      const res = await fetch("/api/content-pipeline/redraft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaId: id }),
      });
      if (res.ok) await fetchIdeas();
    } finally {
      setRequestingId(null);
    }
  };

  const openEditor = async (idea: Idea) => {
    setEditingId(idea.id);
    setPublishingId(null);
    setDraftLoading(true);
    setEvaluation(null);
    try {
      const res = await fetch(`/api/content-pipeline/draft/${idea.id}`);
      if (res.ok) {
        const data = await res.json();
        setDraftContent(data.content ?? "");
        setEvaluation(data.evaluation ?? null);
      }
    } finally {
      setDraftLoading(false);
    }
  };

  const saveDraft = async (id: string) => {
    setSavingDraft(true);
    try {
      await fetch(`/api/content-pipeline/draft/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draftContent }),
      });
    } finally {
      setSavingDraft(false);
    }
  };

  const openPublishForm = (idea: Idea) => {
    setPublishingId(idea.id);
    setPublishText(draftContent);
    setPublishUrl("");
  };

  const submitPublish = async (id: string) => {
    if (!publishUrl || !publishText) return;
    setPublishSubmitting(true);
    try {
      const res = await fetch(`/api/content-pipeline/publish/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publishedText: publishText, url: publishUrl }),
      });
      if (res.ok) {
        setPublishingId(null);
        setEditingId(null);
        await fetchIdeas();
      }
    } finally {
      setPublishSubmitting(false);
    }
  };

  const grouped = (["I", "B", "A"] as const).map((type) => ({
    type,
    items: ideas.filter((i) => i.type === type),
  }));

  const stats = useMemo(() => {
    const published = ideas.filter((i) => i.status === "published");
    const inProgress = ideas.filter((i) => i.status === "requested" || i.status === "draft");
    const affiliatePublished = published.filter((i) => i.type === "B").length;
    const infoPublished = published.filter((i) => i.type === "I").length;
    // 2026-08-21: 케이던스 1:2 → 1:1로 변경(webinar-gap-analysis.md 결정)
    const infoNeeded = Math.max(affiliatePublished - infoPublished, 0);
    return {
      total: ideas.length,
      published: published.length,
      inProgress: inProgress.length,
      cadenceSub:
        infoNeeded === 0
          ? "케이던스 충족 — 제휴글 준비 가능"
          : `정보성 글 ${infoNeeded}편 더 필요`,
    };
  }, [ideas]);

  const editingIdea = ideas.find((i) => i.id === editingId) ?? null;

  const remainingMs =
    automation?.enabled && automation.expiresAt
      ? new Date(automation.expiresAt).getTime() - nowTick
      : null;
  const remainingClamped = remainingMs !== null ? Math.max(remainingMs, 0) : null;
  const remainingLabel =
    remainingClamped !== null
      ? `${Math.floor(remainingClamped / 60000)}:${String(Math.floor((remainingClamped / 1000) % 60)).padStart(2, "0")}`
      : null;
  const expiresAtLabel = automation?.expiresAt
    ? new Date(automation.expiresAt).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    : null;

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <IconBadge icon={Newspaper} color="var(--accent)" size={22} />
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}
            >
              콘텐츠 파이프라인
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              세시간전 제휴 포스팅 — 소재 선택 → 초안 요청 → 편집 → 발행 기록
            </p>
          </div>
        </div>

        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          <button
            onClick={toggleAutomation}
            disabled={automationBusy || automation === null}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 disabled:opacity-50"
            style={{
              backgroundColor: automation?.enabled ? "var(--success)" : "var(--surface)",
              color: automation?.enabled ? "#fff" : "var(--text-secondary)",
              border: automation?.enabled ? "none" : "1px solid var(--border)",
            }}
          >
            {automation?.enabled ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
            자동처리 {automation?.enabled ? "켜짐" : "꺼짐"}
          </button>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            {automation?.enabled ? (
              <>
                PID {automation.pid ?? "?"} · {automation.alive ? "정상 동작" : "⚠️ 프로세스 없음"} ·{" "}
                <span
                  className="font-mono font-semibold"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {remainingLabel}
                </span>{" "}
                후 종료 ({expiresAtLabel} 예정)
              </>
            ) : (
              <>업무시간(9-16시)에 1분마다 큐 확인 · 켜면 1시간 후 자동종료</>
            )}
          </div>
        </div>
      </div>

      {!loading && !error && (
        <div className="flex flex-wrap items-center gap-3 mb-8">
          <StatTile label="전체 소재" value={stats.total} />
          <StatTile label="발행완료" value={stats.published} />
          <StatTile label="진행중" value={stats.inProgress} sub="요청됨 + 초안" />
          <StatTile label="케이던스" value={stats.cadenceSub.includes("충족") ? "OK" : "확인 필요"} sub={stats.cadenceSub} />
          <div className="ml-auto">
            <PrimaryButton onClick={openAddModal} color="var(--accent)" icon={Plus}>
              소재 추가
            </PrimaryButton>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
          <Loader2 className="w-4 h-4 animate-spin" /> 불러오는 중...
        </div>
      )}
      {error && <div style={{ color: "var(--error)" }}>{error}</div>}

      {!loading &&
        !error &&
        grouped.map(({ type, items }) => {
          const meta = TYPE_META[type];
          return (
            <div key={type} className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <meta.icon className="w-4 h-4" style={{ color: meta.color }} />
                <h2
                  className="text-base font-semibold"
                  style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}
                >
                  {meta.label}
                </h2>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {meta.sub} · {items.length}건
                </span>
              </div>
              {items.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  소재 없음
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((idea) => {
                    const statusMeta = STATUS_META[idea.status];
                    return (
                      <div
                        key={idea.id}
                        className="rounded-xl overflow-hidden flex flex-col"
                        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
                      >
                        <div style={{ height: 3, backgroundColor: meta.color }} />
                        <div className="p-4 flex flex-col flex-1">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h3
                              className="font-semibold text-sm leading-snug"
                              style={{ color: "var(--text-primary)" }}
                            >
                              <span
                                className="font-mono text-[11px] font-medium px-1.5 py-0.5 rounded mr-1.5"
                                style={{ backgroundColor: "var(--surface)", color: "var(--text-muted)" }}
                              >
                                {idea.id}
                              </span>
                              {idea.title}
                            </h3>
                            <span
                              className="text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap"
                              style={{
                                color: statusMeta.color,
                                backgroundColor: `color-mix(in srgb, ${statusMeta.color} 15%, transparent)`,
                              }}
                            >
                              {statusMeta.label}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1.5 mb-4">
                            <span
                              className="text-[11px] px-2 py-0.5 rounded-md"
                              style={{ backgroundColor: "var(--surface)", color: "var(--text-secondary)" }}
                            >
                              {idea.meta}
                            </span>
                            {Object.entries(idea.extra).map(([k, v]) => (
                              <span
                                key={k}
                                className="text-[11px] px-2 py-0.5 rounded-md"
                                style={{ backgroundColor: "var(--surface)", color: "var(--text-muted)" }}
                              >
                                {v}
                              </span>
                            ))}
                          </div>

                          <div className="mt-auto pt-1">
                            {idea.status === "idle" && (
                              <PrimaryButton
                                onClick={() => requestDraft(idea.id)}
                                disabled={requestingId === idea.id}
                                color="var(--accent)"
                                icon={Sparkles}
                              >
                                {requestingId === idea.id ? "요청 중..." : "초안 요청"}
                              </PrimaryButton>
                            )}
                            {idea.status === "requested" && (
                              <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--warning)" }}>
                                <Hourglass className="w-3.5 h-3.5" />
                                초안 작성 대기중
                              </div>
                            )}
                            {idea.status === "draft" && (
                              <div className="flex items-center gap-2">
                                <PrimaryButton onClick={() => openEditor(idea)} color="var(--info)" icon={PenLine}>
                                  편집
                                </PrimaryButton>
                                <PrimaryButton
                                  onClick={() => redraft(idea.id)}
                                  disabled={requestingId === idea.id}
                                  color="var(--text-muted)"
                                  icon={RotateCw}
                                >
                                  {requestingId === idea.id ? "요청 중..." : "재발행"}
                                </PrimaryButton>
                              </div>
                            )}
                            {idea.status === "published" && idea.publishedUrl && (
                              <a
                                href={idea.publishedUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs inline-flex items-center gap-1 font-medium"
                                style={{ color: "var(--success)" }}
                              >
                                <ExternalLink className="w-3 h-3" /> 발행글 보기 ({idea.publishedAt})
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

      {adding && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.7)", backdropFilter: "blur(4px)" }}
          onClick={() => setAdding(false)}
        >
          <div
            className="rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-5"
            style={{ backgroundColor: "var(--card-elevated)", border: "1px solid var(--border-strong)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>
                소재 추가
              </h3>
              <button onClick={() => setAdding(false)} style={{ color: "var(--text-muted)" }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              {(["I", "B", "A"] as Idea["type"][]).map((type) => {
                const meta = TYPE_META[type];
                const active = newType === type;
                const Icon = meta.icon;
                return (
                  <button
                    key={type}
                    onClick={() => changeNewType(type)}
                    className="flex-1 px-3 py-2.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                    style={{
                      backgroundColor: active ? meta.color : "var(--surface)",
                      color: active ? "#fff" : "var(--text-secondary)",
                      border: active ? "none" : "1px solid var(--border)",
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {type} · {meta.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
              {TYPE_META[newType].sub}
            </p>

            {FORM_FIELDS[newType].map((field) => (
              <div key={field.key} className="mb-3">
                <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>
                  {field.label}
                  {field.key === "title" && <span style={{ color: "var(--accent)" }}> *</span>}
                </label>

                {field.kind === "competition" ? (
                  <select
                    value={newFields[field.key] ?? ""}
                    onChange={(e) => setNewFields((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    className="w-full p-2 rounded-lg text-sm"
                    style={{
                      backgroundColor: "var(--surface)",
                      border: "1px solid var(--border)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <option value="">선택 안 함</option>
                    {COMPETITION_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input
                      value={newFields[field.key] ?? ""}
                      onChange={(e) => setNewFields((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full p-2 rounded-lg text-sm"
                      style={{
                        backgroundColor: "var(--surface)",
                        border: "1px solid var(--border)",
                        color: "var(--text-primary)",
                      }}
                    />
                    {field.kind === "keyword" && (
                      <button
                        onClick={lookupKeyword}
                        disabled={lookupBusy || !(newFields.meta ?? "").trim()}
                        className="text-xs font-semibold px-3 rounded-lg inline-flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                        style={{
                          backgroundColor: "var(--surface)",
                          border: "1px solid var(--border)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {lookupBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Search className="w-3.5 h-3.5" />
                        )}
                        검색량 조회
                      </button>
                    )}
                  </div>
                )}

                {field.kind === "keyword" && lookupNote && (
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    {lookupNote}
                  </p>
                )}
              </div>
            ))}

            <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
              비워둔 항목은 <span className="font-mono">-</span> 로 기록됩니다. ID는 타입별로 자동
              부여됩니다.
            </p>

            {addError && (
              <p className="text-xs mb-3" style={{ color: "var(--error)" }}>
                {addError}
              </p>
            )}

            <PrimaryButton
              onClick={submitNewIdea}
              disabled={addSubmitting || !(newFields.title ?? "").trim()}
              color="var(--accent)"
              icon={Plus}
            >
              {addSubmitting ? "등록 중..." : "등록"}
            </PrimaryButton>
          </div>
        </div>
      )}

      {editingIdea && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.7)", backdropFilter: "blur(4px)" }}
          onClick={() => setEditingId(null)}
        >
        <div
          className="rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-5"
          style={{ backgroundColor: "var(--card-elevated)", border: "1px solid var(--border-strong)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>
              초안 편집 — [{editingIdea.id}] {editingIdea.title}
            </h3>
            <button
              onClick={() => setEditingId(null)}
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              닫기
            </button>
          </div>

          {draftLoading ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              <Loader2 className="w-4 h-4 animate-spin" /> 불러오는 중...
            </div>
          ) : (
            <>
              <textarea
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                rows={16}
                className="w-full p-3 rounded-lg text-sm font-mono leading-relaxed"
                style={{
                  backgroundColor: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
              <div className="flex items-center gap-2 mt-3">
                <PrimaryButton onClick={() => saveDraft(editingIdea.id)} disabled={savingDraft} color="var(--info)" icon={Save}>
                  {savingDraft ? "저장 중..." : "저장"}
                </PrimaryButton>
                <PrimaryButton onClick={() => openPublishForm(editingIdea)} color="var(--success)" icon={CheckCircle2}>
                  발행 완료로 표시
                </PrimaryButton>
              </div>

              {evaluation && (
                <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Search className="w-3.5 h-3.5" style={{ color: "var(--info)" }} />
                    <h4 className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                      조사 방식 평가 (AI가 직접 밝힌 조사 과정·한계 — 편집 대상 아님)
                    </h4>
                  </div>
                  <pre
                    className="w-full p-3 rounded-lg text-xs leading-relaxed whitespace-pre-wrap"
                    style={{
                      backgroundColor: "var(--surface)",
                      border: "1px solid var(--border)",
                      color: "var(--text-secondary)",
                      fontFamily: "var(--font-body)",
                      maxHeight: 240,
                      overflowY: "auto",
                    }}
                  >
                    {evaluation.content}
                  </pre>
                </div>
              )}
            </>
          )}

          {publishingId === editingIdea.id && (
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
              <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>
                네이버 발행 URL<span style={{ color: "var(--error)" }}> * 필수 (성과 추적용)</span>
              </label>
              <input
                value={publishUrl}
                onChange={(e) => setPublishUrl(e.target.value)}
                placeholder="https://blog.naver.com/mesure/... (필수)"
                required
                type="url"
                className="w-full p-2 rounded-lg text-sm mb-3"
                style={{
                  backgroundColor: "var(--surface)",
                  border: publishUrl ? "1px solid var(--border)" : "1px solid var(--error)",
                  color: "var(--text-primary)",
                }}
              />
              <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>
                최종 발행 텍스트 (네이버 에디터에서 복사한 전체 텍스트)
              </label>
              <textarea
                value={publishText}
                onChange={(e) => setPublishText(e.target.value)}
                rows={10}
                className="w-full p-3 rounded-lg text-sm font-mono mb-3 leading-relaxed"
                style={{
                  backgroundColor: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
              <PrimaryButton
                onClick={() => submitPublish(editingIdea.id)}
                disabled={publishSubmitting || !publishUrl || !publishText}
                color="var(--accent)"
                icon={Send}
              >
                {publishSubmitting ? "저장 중..." : "발행 완료 확정"}
              </PrimaryButton>
            </div>
          )}
        </div>
        </div>
      )}
    </div>
  );
}
