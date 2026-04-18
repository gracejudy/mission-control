"use client";

import { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { RefreshCw, Layers, TrendingUp, Sprout, Monitor } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface Seed {
  id: string;
  title: string;
  episode: string;
  pillar: string;
  angle: string;
  source: string;
  status: string;
}

interface SeedsData {
  seeds: Seed[];
  total: number;
  unprocessed: number;
}

interface ProjectGoalData {
  finalGoal: string;
  stepsMarkdown: string;
  tasksMarkdown: string;
}

interface GoalsData {
  [projectId: string]: ProjectGoalData;
}

interface ProjectInfo {
  id: string;
}

interface CrawlerStatus {
  active_products: number;
  target: number;
  progress_pct: number;
  deadline: string | null;
}

interface PersonalBrandStatus {
  milestone: string;
  seeds_unprocessed: number;
}

interface ProjectsStatus {
  "crawler-pipeline": CrawlerStatus;
  "personal-brand": PersonalBrandStatus;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "8px",
        backgroundColor: "var(--border)",
        borderRadius: "4px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${Math.min(pct, 100)}%`,
          height: "100%",
          backgroundColor: "var(--accent)",
          borderRadius: "4px",
          transition: "width 600ms ease",
        }}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div
      style={{
        padding: "16px 20px",
        borderRadius: "10px",
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
        minWidth: "140px",
      }}
    >
      <p
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: "6px",
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: "24px",
          fontWeight: 700,
          color: "var(--text-primary)",
          fontFamily: "var(--font-heading)",
          letterSpacing: "-0.5px",
        }}
      >
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ── Markdown Section Block ─────────────────────────────────────────────────

function MissionSection({ content }: { content: string }) {
  if (!content) return null;
  return (
    <div className="mission-markdown" style={{ marginTop: "24px" }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

// ── Goal Template ──────────────────────────────────────────────────────────

function GoalTemplate({ goal }: { goal: ProjectGoalData | null }) {
  if (!goal) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "8px" }}>
      {/* Section 1: 목표 */}
      <div
        style={{
          borderRadius: "10px",
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "12px 18px",
            borderBottom: "1px solid var(--border)",
            fontSize: "12px",
            fontWeight: 700,
            color: "var(--accent)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          목표
        </div>
        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* 최종목표 */}
          <div>
            <p
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "6px",
              }}
            >
              최종목표
            </p>
            {goal.finalGoal ? (
              <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                {goal.finalGoal}
              </p>
            ) : (
              <p style={{ fontSize: "13px", color: "var(--text-muted)", fontStyle: "italic" }}>
                —
              </p>
            )}
          </div>
          {/* 단계별 목표 */}
          <div>
            <p
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "8px",
              }}
            >
              단계별 목표 &amp; 달성기한
            </p>
            {goal.stepsMarkdown ? (
              <div className="mission-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{goal.stepsMarkdown}</ReactMarkdown>
              </div>
            ) : (
              <p style={{ fontSize: "13px", color: "var(--text-muted)", fontStyle: "italic" }}>
                —
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: 현재 작업 예정 */}
      <div
        style={{
          borderRadius: "10px",
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "12px 18px",
            borderBottom: "1px solid var(--border)",
            fontSize: "12px",
            fontWeight: 700,
            color: "var(--accent)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          현재 작업 예정
        </div>
        <div style={{ padding: "16px 18px" }}>
          {goal.tasksMarkdown ? (
            <div className="mission-markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{goal.tasksMarkdown}</ReactMarkdown>
            </div>
          ) : (
            <p style={{ fontSize: "13px", color: "var(--text-muted)", fontStyle: "italic" }}>
              —
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Extra: crawler-pipeline ────────────────────────────────────────────────

function CrawlerPipelineExtra({ status, sections }: { status: CrawlerStatus | null; sections: Record<string, string> | null }) {
  if (!status) {
    return (
      <div style={{ color: "var(--text-muted)", padding: "40px", textAlign: "center" }}>
        <RefreshCw
          style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite", display: "inline-block" }}
        />
        <p style={{ marginTop: "8px" }}>로딩 중...</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Stats */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <StatCard label="활성 상품" value={status.active_products} sub={`목표 ${status.target}개`} />
        <StatCard label="달성률" value={`${status.progress_pct}%`} sub="LIVE + REGISTERED" />
        {status.deadline && (
          <StatCard label="예상 완료일" value={status.deadline} sub="현재 속도 기준" />
        )}
      </div>

      {/* Progress bar */}
      <div
        style={{
          padding: "20px",
          borderRadius: "10px",
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <span
            style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}
          >
            500개 달성률
          </span>
          <span style={{ fontSize: "13px", color: "var(--accent)", fontWeight: 700 }}>
            {status.active_products} / {status.target}
          </span>
        </div>
        <ProgressBar pct={status.progress_pct} />
        <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>
          남은 수량: {status.target - status.active_products}개
        </p>
      </div>

      {/* Note */}
      <div
        style={{
          padding: "14px 18px",
          borderRadius: "8px",
          backgroundColor: "rgba(168, 85, 247, 0.06)",
          border: "1px solid rgba(168, 85, 247, 0.2)",
          fontSize: "13px",
          color: "var(--text-secondary)",
        }}
      >
        병목: collect 단계 (43.5초/개 sleep — 쿠팡 차단 방지용). 현재 MAX_COLLECT_PER_DAY: 10개.
      </div>

      {/* pipeline-ops 현황 (from MISSION-CONTROL.md) */}
      <MissionSection content={sections?.["pipeline-ops"] ?? ""} />
    </div>
  );
}

// ── Extra: judy-ops ────────────────────────────────────────────────────────

function JudyOpsExtra({ status, sections }: { status: CrawlerStatus | null; sections: Record<string, string> | null }) {
  if (!status) {
    return (
      <div style={{ color: "var(--text-muted)", padding: "40px", textAlign: "center" }}>
        로딩 중...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1차 목표 */}
      <div
        style={{
          padding: "20px",
          borderRadius: "10px",
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        <h3
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: "16px",
          }}
        >
          1차 목표 — 파이프라인 규모화
        </h3>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
          <StatCard label="현재" value={status.active_products} sub="활성 상품 (LIVE+REG)" />
          <StatCard label="목표" value="500개" />
          <StatCard label="달성률" value={`${status.progress_pct}%`} />
        </div>
        <ProgressBar pct={status.progress_pct} />
        {status.deadline && (
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>
            예상 완료: {status.deadline}
          </p>
        )}
      </div>

      {/* 2차 목표 */}
      <div
        style={{
          padding: "20px",
          borderRadius: "10px",
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
          opacity: 0.6,
        }}
      >
        <h3
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: "var(--text-secondary)",
            marginBottom: "8px",
          }}
        >
          2차 목표 — 수익화
        </h3>
        <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
          목표: 월 순이익 500만원 — 1차 달성 후 전환
        </p>
      </div>

      {/* KPI + judy-ops 현황 (from MISSION-CONTROL.md) */}
      <MissionSection content={sections?.["general-executor-kpi"] ?? ""} />
      <MissionSection content={sections?.["judyops-status"] ?? ""} />
    </div>
  );
}

// ── Extra: personal-brand ──────────────────────────────────────────────────

const MILESTONE_LABELS: Record<string, string> = {
  M0: "준비 — 인프라 완성",
  M1: "첫 판매 — 1건 (10만원)",
  M2: "검증 — 누적 5건 (50만원)",
  M3: "가속 — 누적 15건 (150만원)",
  M4: "목표 — 누적 30건 (300만원)",
};

const MILESTONE_ORDER = ["M0", "M1", "M2", "M3", "M4"];

const PILLAR_COLORS: Record<string, string> = {
  P1: "#a855f7",
  P2: "#3b82f6",
  P3: "#10b981",
  P4: "#f59e0b",
  P5: "#ef4444",
  P6: "#ec4899",
};

function PersonalBrandExtra({
  status,
  seedsData,
  seedsLoading,
  seedsError,
  sections,
}: {
  status: PersonalBrandStatus | null;
  seedsData: SeedsData | null;
  seedsLoading: boolean;
  seedsError: string | null;
  sections: Record<string, string> | null;
}) {
  const currentIdx = status ? MILESTONE_ORDER.indexOf(status.milestone) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Milestones */}
      <div
        style={{
          padding: "20px",
          borderRadius: "10px",
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        <h3
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <TrendingUp style={{ width: "16px", height: "16px", color: "var(--accent)" }} />
          마일스톤
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {MILESTONE_ORDER.map((m, idx) => {
            const isActive = idx === currentIdx;
            const isDone = idx < currentIdx;
            return (
              <div
                key={m}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  backgroundColor: isActive
                    ? "rgba(168, 85, 247, 0.08)"
                    : "transparent",
                  border: isActive
                    ? "1px solid rgba(168, 85, 247, 0.3)"
                    : "1px solid transparent",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: isDone
                      ? "var(--text-muted)"
                      : isActive
                      ? "var(--accent)"
                      : "var(--text-muted)",
                    minWidth: "24px",
                  }}
                >
                  {isDone ? "✓" : m}
                </span>
                <span
                  style={{
                    fontSize: "13px",
                    color: isDone
                      ? "var(--text-muted)"
                      : isActive
                      ? "var(--text-primary)"
                      : "var(--text-muted)",
                    fontWeight: isActive ? 600 : 400,
                    textDecoration: isDone ? "line-through" : "none",
                  }}
                >
                  {MILESTONE_LABELS[m]}
                </span>
                {isActive && (
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "var(--accent)",
                      backgroundColor: "rgba(168, 85, 247, 0.15)",
                      padding: "2px 8px",
                      borderRadius: "12px",
                    }}
                  >
                    진행 중
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content Seeds */}
      <div
        style={{
          borderRadius: "10px",
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h3
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "var(--text-primary)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Sprout style={{ width: "16px", height: "16px", color: "#10b981" }} />
            콘텐츠 씨앗
          </h3>
          {seedsData && (
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              총 {seedsData.total}개 · 미가공 {seedsData.unprocessed}개
            </span>
          )}
        </div>

        {seedsLoading && !seedsData && (
          <div
            style={{
              padding: "32px",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: "13px",
            }}
          >
            <RefreshCw
              style={{ width: "14px", height: "14px", animation: "spin 1s linear infinite", display: "inline-block", marginRight: "6px" }}
            />
            씨앗 로딩 중...
          </div>
        )}

        {seedsError && (
          <div style={{ padding: "20px", color: "#ef4444", fontSize: "13px" }}>
            {seedsError}
          </div>
        )}

        {seedsData && (
          <div className="seeds-list" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px", padding: "16px 20px" }}>
            {seedsData.seeds.map((seed) => {
              const pillars = seed.pillar.match(/P\d/g) ?? [];
              const angles = seed.angle.split(/\s*\/\s*/).filter(Boolean);
              return (
                <div
                  key={seed.id}
                  className="seeds-card"
                  style={{
                    padding: "18px 20px",
                    borderRadius: "10px",
                    backgroundColor: "var(--bg)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {/* Top row: ID + status */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "var(--accent)",
                        backgroundColor: "rgba(168, 85, 247, 0.1)",
                        padding: "3px 9px",
                        borderRadius: "10px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {seed.id}
                    </span>
                    {pillars.map((p) => (
                      <span
                        key={p}
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          color: PILLAR_COLORS[p] ?? "var(--text-muted)",
                          backgroundColor: `${PILLAR_COLORS[p] ?? "#888"}1a`,
                          padding: "3px 7px",
                          borderRadius: "8px",
                        }}
                      >
                        {p}
                      </span>
                    ))}
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: "10px",
                        fontWeight: 600,
                        color:
                          seed.status === "미가공"
                            ? "#f59e0b"
                            : seed.status === "발행완료"
                            ? "#10b981"
                            : "var(--text-muted)",
                        backgroundColor:
                          seed.status === "미가공"
                            ? "rgba(245, 158, 11, 0.1)"
                            : seed.status === "발행완료"
                            ? "rgba(16, 185, 129, 0.1)"
                            : "rgba(255,255,255,0.04)",
                        padding: "3px 9px",
                        borderRadius: "10px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {seed.status}
                    </span>
                  </div>

                  {/* Title */}
                  <p
                    style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "var(--text-primary)",
                      lineHeight: 1.5,
                      marginBottom: "12px",
                    }}
                  >
                    {seed.title}
                  </p>

                  {/* Episode */}
                  {seed.episode && (
                    <div
                      className="seeds-episode"
                      style={{
                        padding: "12px 14px",
                        borderRadius: "8px",
                        backgroundColor: "rgba(255,255,255,0.03)",
                        border: "1px solid var(--border)",
                        marginBottom: "12px",
                      }}
                    >
                      <p
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "var(--text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          marginBottom: "6px",
                        }}
                      >
                        에피소드
                      </p>
                      <p
                        style={{
                          fontSize: "13px",
                          color: "var(--text-secondary)",
                          lineHeight: 1.7,
                          whiteSpace: "pre-wrap",
                          wordBreak: "keep-all",
                        }}
                      >
                        {seed.episode}
                      </p>
                    </div>
                  )}

                  {/* Angles */}
                  {angles.length > 0 && (
                    <div style={{ marginBottom: "10px" }}>
                      <p
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "var(--text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          marginBottom: "6px",
                        }}
                      >
                        각도 (훅 아이디어)
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                        {angles.map((angle, i) => (
                          <p
                            key={i}
                            style={{
                              fontSize: "12px",
                              color: "var(--text-secondary)",
                              paddingLeft: "10px",
                              borderLeft: "2px solid rgba(168, 85, 247, 0.4)",
                              lineHeight: 1.6,
                              wordBreak: "keep-all",
                            }}
                          >
                            {angle.replace(/^[""]|[""]$/g, "").trim()}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Source */}
                  <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                    출처: {seed.source}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* personal-brand 마일스톤 (from MISSION-CONTROL.md) */}
      <MissionSection content={sections?.["personal-brand-milestone"] ?? ""} />
    </div>
  );
}

/// ── Extra: mission-board ───────────────────────────────────────────────────

function MissionBoardExtra() {
  const [logs, setLogs] = useState<string[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    setLogsError(null);
    try {
      const res = await fetch("/api/logs/recent?service=mission-control&lines=5", { cache: "no-store" });
      const data = await res.json();
      if (data.error && data.lines?.length === 0) throw new Error(data.error);
      setLogs(data.lines ?? []);
    } catch (err) {
      setLogsError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div
        style={{
          borderRadius: "10px",
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h3
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "var(--text-primary)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Monitor style={{ width: "16px", height: "16px", color: "var(--accent)" }} />
            서버 로그 (최신 5개)
          </h3>
          <button
            onClick={fetchLogs}
            disabled={logsLoading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              padding: "6px 12px",
              borderRadius: "6px",
              backgroundColor: "var(--surface-elevated)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
              cursor: logsLoading ? "not-allowed" : "pointer",
              fontSize: "12px",
              fontWeight: 500,
              opacity: logsLoading ? 0.5 : 1,
            }}
          >
            <RefreshCw style={{ width: "12px", height: "12px", animation: logsLoading ? "spin 1s linear infinite" : "none" }} />
            새로고침
          </button>
        </div>

        {/* Log lines */}
        <div
          style={{
            padding: "12px 0",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
          }}
        >
          {logsLoading && logs.length === 0 && (
            <p style={{ padding: "20px", color: "var(--text-muted)", textAlign: "center" }}>로딩 중...</p>
          )}
          {logsError && (
            <p style={{ padding: "16px 20px", color: "var(--negative)", fontSize: "13px" }}>{logsError}</p>
          )}
          {!logsLoading && !logsError && logs.length === 0 && (
            <p style={{ padding: "20px", color: "var(--text-muted)", textAlign: "center" }}>로그 없음</p>
          )}
          {logs.map((line, i) => (
            <div
              key={i}
              style={{
                padding: "8px 20px",
                borderBottom: i < logs.length - 1 ? "1px solid var(--border)" : "none",
                color: line.toLowerCase().includes("error") || line.toLowerCase().includes("err")
                  ? "var(--negative)"
                  : line.toLowerCase().includes("warn")
                  ? "var(--warning)"
                  : "var(--text-secondary)",
                lineHeight: 1.6,
                wordBreak: "break-all",
              }}
            >
              {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ProjectTab dispatcher ──────────────────────────────────────────────────

function ProjectTab({
  projectId,
  goal,
  crawlerStatus,
  pbStatus,
  seedsData,
  seedsLoading,
  seedsError,
  sections,
}: {
  projectId: string;
  goal: ProjectGoalData | null;
  crawlerStatus: CrawlerStatus | null;
  pbStatus: PersonalBrandStatus | null;
  seedsData: SeedsData | null;
  seedsLoading: boolean;
  seedsError: string | null;
  sections: Record<string, string> | null;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <GoalTemplate goal={goal} />
      {projectId === "crawler-pipeline" && (
        <CrawlerPipelineExtra status={crawlerStatus} sections={sections} />
      )}
      {projectId === "judy-ops" && (
        <JudyOpsExtra status={crawlerStatus} sections={sections} />
      )}
      {projectId === "personal-brand" && (
        <PersonalBrandExtra
          status={pbStatus}
          seedsData={seedsData}
          seedsLoading={seedsLoading}
          seedsError={seedsError}
          sections={sections}
        />
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [activeTab, setActiveTab] = useState<string>("");
  const [status, setStatus] = useState<ProjectsStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [seedsData, setSeedsData] = useState<SeedsData | null>(null);
  const [seedsLoading, setSeedsLoading] = useState(false);
  const [seedsError, setSeedsError] = useState<string | null>(null);
  const [sectionsData, setSectionsData] = useState<Record<string, string> | null>(null);
  const [goalsData, setGoalsData] = useState<GoalsData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/projects/status", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Fetch failed");
      setStatus(data);
      setStatusError(null);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Unknown error");
    }
  }, []);

  const fetchSeeds = useCallback(async () => {
    setSeedsLoading(true);
    setSeedsError(null);
    try {
      const res = await fetch("/api/projects/personal-brand/seeds", {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Fetch failed");
      setSeedsData(data);
    } catch (err) {
      setSeedsError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSeedsLoading(false);
    }
  }, []);

  const fetchSections = useCallback(async () => {
    try {
      const res = await fetch("/api/mission/sections", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || data.error) return;
      setSectionsData(data);
    } catch {
      // silently ignore — sections are supplementary
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects/list", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || data.error) return;
      setProjects(data.projects ?? []);
      setActiveTab((prev) => prev || data.projects?.[0]?.id || "");
    } catch {
      // silently ignore
    }
  }, []);

  const fetchGoals = useCallback(async () => {
    try {
      const res = await fetch("/api/projects/goals", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || data.error) return;
      setGoalsData(data);
    } catch {
      // silently ignore — goals are supplementary
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchProjects(), fetchStatus(), fetchSeeds(), fetchSections(), fetchGoals()]);
    setRefreshing(false);
  }, [fetchProjects, fetchStatus, fetchSeeds, fetchSections, fetchGoals]);

  useEffect(() => {
    fetchProjects();
    fetchStatus();
    fetchSeeds();
    fetchSections();
    fetchGoals();
  }, [fetchProjects, fetchStatus, fetchSeeds, fetchSections, fetchGoals]);

  const crawlerStatus = status?.["crawler-pipeline"] ?? null;
  const pbStatus = status?.["personal-brand"] ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div
        className="page-header"
        style={{
          padding: "24px 32px 0 32px",
          flexShrink: 0,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Layers style={{ width: "20px", height: "20px", color: "var(--accent)" }} />
            <h1
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "24px",
                fontWeight: 700,
                letterSpacing: "-1px",
                color: "var(--text-primary)",
              }}
            >
              Projects
            </h1>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="새로고침"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "8px",
              backgroundColor: "var(--card-elevated, var(--card))",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
              cursor: refreshing ? "not-allowed" : "pointer",
              fontSize: "13px",
              fontWeight: 500,
              opacity: refreshing ? 0.6 : 1,
              transition: "all 150ms ease",
            }}
          >
            <RefreshCw
              style={{
                width: "14px",
                height: "14px",
                animation: refreshing ? "spin 1s linear infinite" : "none",
              }}
            />
            새로고침
          </button>
        </div>

        {/* Paper-tab row — dynamic from /api/projects/list + mission-board */}
        <div style={{ display: "flex", gap: "0", alignItems: "flex-end" }}>
          {projects.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "10px 20px",
                  fontSize: "13px",
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                  backgroundColor: isActive ? "var(--bg)" : "var(--card)",
                  border: "1px solid var(--border)",
                  borderBottom: isActive ? "1px solid var(--bg)" : "1px solid var(--border)",
                  borderRadius: "8px 8px 0 0",
                  cursor: "pointer",
                  position: "relative",
                  bottom: "-1px",
                  transition: "all 150ms ease",
                  marginRight: "4px",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {tab.id}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <main
        className="page-content"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "28px 32px",
          maxWidth: "1400px",
          width: "100%",
          margin: "0 auto",
        }}
      >
        {statusError && (
          <div
            style={{
              padding: "14px 18px",
              borderRadius: "8px",
              backgroundColor: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              fontSize: "13px",
              color: "#ef4444",
              marginBottom: "20px",
            }}
          >
            상태 로드 실패: {statusError}
          </div>
        )}

        {activeTab ? (
          <ProjectTab
            projectId={activeTab}
            goal={goalsData?.[activeTab] ?? null}
            crawlerStatus={crawlerStatus}
            pbStatus={pbStatus}
            seedsData={seedsData}
            seedsLoading={seedsLoading}
            seedsError={seedsError}
            sections={sectionsData}
          />
        ) : null}
      </main>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .mission-markdown {
          color: var(--text-primary);
          font-family: var(--font-body);
          font-size: 14px;
          line-height: 1.75;
        }
        .mission-markdown h2 {
          font-family: var(--font-heading);
          font-size: 17px;
          font-weight: 700;
          color: var(--accent);
          margin: 32px 0 12px 0;
          letter-spacing: -0.3px;
        }
        .mission-markdown h3 {
          font-family: var(--font-heading);
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 20px 0 8px 0;
        }
        .mission-markdown p {
          color: var(--text-secondary);
          margin: 0 0 12px 0;
        }
        .mission-markdown table {
          width: 100%;
          border-collapse: collapse;
          margin: 16px 0;
          font-size: 13px;
        }
        .mission-markdown th {
          text-align: left;
          padding: 8px 12px;
          background: var(--card-elevated, var(--card));
          color: var(--text-muted);
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          border-bottom: 1px solid var(--border);
        }
        .mission-markdown td {
          padding: 9px 12px;
          border-bottom: 1px solid var(--border);
          color: var(--text-secondary);
        }
        .mission-markdown tr:last-child td {
          border-bottom: none;
        }
        .mission-markdown tr:hover td {
          background: rgba(255,255,255,0.02);
        }
        .mission-markdown code {
          font-family: var(--font-mono);
          font-size: 12px;
          background: var(--card-elevated, rgba(255,255,255,0.06));
          padding: 2px 6px;
          border-radius: 4px;
          color: var(--accent);
        }
        .mission-markdown ul, .mission-markdown ol {
          padding-left: 20px;
          margin: 8px 0 12px;
          color: var(--text-secondary);
        }
        .mission-markdown li {
          margin-bottom: 4px;
        }
        .mission-markdown hr {
          border: none;
          border-top: 1px solid var(--border);
          margin: 28px 0;
        }
        .mission-markdown a {
          color: var(--accent);
          text-decoration: none;
        }
        .mission-markdown a:hover {
          text-decoration: underline;
        }
        .mission-markdown strong {
          color: var(--text-primary);
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
