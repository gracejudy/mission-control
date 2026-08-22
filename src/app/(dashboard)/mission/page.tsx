"use client";

import { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { RefreshCw, Target, AlertTriangle } from "lucide-react";
import type { FreedomMetric } from "../../api/mission/freedom/route";

// Strip the "## Freedom 거리계" section from markdown to avoid duplication
function stripFreedomSection(md: string): string {
  return md.replace(/## Freedom 거리계[\s\S]*?(?=\n---|\n## )/m, "");
}

// Strip project-specific status sections (moved to Projects tab)
function stripProjectSections(md: string): string {
  return md
    .replace(/## pipeline-ops 현황[\s\S]*?(?=\n---|\n## )/m, "")
    .replace(/## general-executor 현황[\s\S]*?(?=\n---|\n## )/m, "");
}

const STALE_THRESHOLD_DAYS = 7;

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function StaleDataBanner({ lastModified }: { lastModified: string }) {
  const days = daysSince(lastModified);
  if (days < STALE_THRESHOLD_DAYS) return null;

  const formattedDate = new Date(lastModified).toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        padding: "16px 20px",
        borderRadius: "10px",
        backgroundColor: "rgba(251, 191, 36, 0.12)",
        border: "1px solid rgba(251, 191, 36, 0.3)",
        marginBottom: "24px",
      }}
    >
      <AlertTriangle style={{ width: "18px", height: "18px", color: "#fbbf24", flexShrink: 0, marginTop: "1px" }} />
      <div>
        <p style={{ fontSize: "14px", fontWeight: 600, color: "#fbbf24", marginBottom: "4px" }}>
          {days}일간 업데이트되지 않음
        </p>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
          MISSION-CONTROL.md 마지막 수정: {formattedDate}
        </p>
      </div>
    </div>
  );
}

function barColor(progress: number): string {
  if (progress >= 70) return "#22c55e";
  if (progress >= 30) return "#eab308";
  return "#ef4444";
}

function FreedomCard({ metric }: { metric: FreedomMetric }) {
  const color = barColor(metric.progress);
  const isDown = metric.direction === "down";

  return (
    <div
      style={{
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      {/* Label + status */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            fontFamily: "var(--font-mono)",
          }}
        >
          {metric.label}
        </span>
        <span style={{ fontSize: "16px" }}>{metric.status}</span>
      </div>

      {/* Current value */}
      <div>
        <span
          style={{
            fontSize: "22px",
            fontWeight: 700,
            color: "var(--text-primary)",
            fontFamily: "var(--font-heading)",
            letterSpacing: "-0.5px",
          }}
        >
          {metric.current}
        </span>
        <span
          style={{
            fontSize: "13px",
            color: "var(--text-muted)",
            marginLeft: "8px",
          }}
        >
          목표 {metric.target}
        </span>
      </div>

      {/* Progress bar */}
      <div>
        <div
          style={{
            height: "6px",
            borderRadius: "3px",
            backgroundColor: "rgba(255,255,255,0.07)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${metric.progress}%`,
              backgroundColor: color,
              borderRadius: "3px",
              transition: "width 600ms ease",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "6px",
            fontSize: "11px",
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          <span style={{ color }}>{metric.progress.toFixed(1)}%</span>
          <span>{isDown ? "낮을수록 좋음" : "목표 달성률"}</span>
        </div>
      </div>
    </div>
  );
}

export default function MissionPage() {
  const [content, setContent] = useState<string>("");
  const [freedomMetrics, setFreedomMetrics] = useState<FreedomMetric[]>([]);
  const [lastModified, setLastModified] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [missionRes, freedomRes] = await Promise.all([
        fetch("/api/mission", { cache: "no-store" }),
        fetch("/api/mission/freedom", { cache: "no-store" }),
      ]);

      const missionData = await missionRes.json();
      const freedomData = await freedomRes.json();

      if (!missionRes.ok || missionData.error) throw new Error(missionData.error ?? "mission fetch failed");

      setContent(missionData.content);
      setLastModified(missionData.lastModified);
      setFetchedAt(new Date());

      if (freedomRes.ok && !freedomData.error) {
        setFreedomMetrics(freedomData.metrics ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();

    // 다음 새벽 1시까지 남은 ms 계산
    function msUntil1AM(): number {
      const now = new Date();
      const next = new Date(now);
      next.setHours(1, 0, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      return next.getTime() - now.getTime();
    }

    let daily: ReturnType<typeof setInterval>;
    const initial = setTimeout(() => {
      fetchAll();
      daily = setInterval(fetchAll, 86400000); // 이후 24시간 주기
    }, msUntil1AM());

    return () => {
      clearTimeout(initial);
      clearInterval(daily);
    };
  }, [fetchAll]);

  const formattedFetchedAt = fetchedAt
    ? fetchedAt.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })
    : null;

  const strippedContent = content
    ? stripProjectSections(stripFreedomSection(content))
    : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div
        style={{
          padding: "24px 24px 16px 24px",
          flexShrink: 0,
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "16px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <Target style={{ width: "20px", height: "20px", color: "var(--accent)" }} />
            <h1
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "24px",
                fontWeight: 700,
                letterSpacing: "-1px",
                color: "var(--text-primary)",
              }}
            >
              Mission Control
            </h1>
          </div>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-secondary)" }}>
            {formattedFetchedAt
              ? `마지막 업데이트: ${formattedFetchedAt}`
              : "MISSION-CONTROL.md · judy-brain"}
          </p>
        </div>

        <button
          onClick={fetchAll}
          disabled={loading}
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
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: "13px",
            fontWeight: 500,
            opacity: loading ? 0.6 : 1,
            transition: "all 150ms ease",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { if (!loading) e.currentTarget.style.color = "var(--text-primary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
        >
          <RefreshCw
            style={{
              width: "14px",
              height: "14px",
              animation: loading ? "spin 1s linear infinite" : "none",
            }}
          />
          새로고침
        </button>
      </div>

      {/* Content */}
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "32px 40px",
          maxWidth: "900px",
          width: "100%",
          margin: "0 auto",
        }}
      >
        {loading && !content && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "200px",
              color: "var(--text-muted)",
              gap: "10px",
              fontSize: "14px",
            }}
          >
            <RefreshCw style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }} />
            로드 중...
          </div>
        )}

        {error && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              padding: "16px 20px",
              borderRadius: "10px",
              backgroundColor: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              marginBottom: "24px",
            }}
          >
            <AlertTriangle style={{ width: "18px", height: "18px", color: "#ef4444", flexShrink: 0, marginTop: "1px" }} />
            <div>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "#ef4444", marginBottom: "4px" }}>
                MISSION-CONTROL.md 로드 실패
              </p>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{error}</p>
            </div>
          </div>
        )}

        {lastModified && <StaleDataBanner lastModified={lastModified} />}

        {/* Freedom 거리계 Cards */}
        {freedomMetrics.length > 0 && (
          <div style={{ marginBottom: "40px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "16px",
              }}
            >
              <span style={{ fontSize: "16px" }}>🚀</span>
              <h2
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "var(--accent)",
                  letterSpacing: "-0.3px",
                }}
              >
                Freedom 거리계
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "12px",
              }}
            >
              {freedomMetrics.map((metric) => (
                <FreedomCard key={metric.label} metric={metric} />
              ))}
            </div>
            <hr
              style={{
                border: "none",
                borderTop: "1px solid var(--border)",
                margin: "32px 0 0 0",
              }}
            />
          </div>
        )}

        {/* Remaining markdown (Freedom section stripped) */}
        {strippedContent && (
          <div className="mission-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{strippedContent}</ReactMarkdown>
          </div>
        )}
      </main>

      {/* Styles */}
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
        .mission-markdown h1 {
          font-family: var(--font-heading);
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.5px;
          color: var(--text-primary);
          margin: 0 0 20px 0;
          padding-bottom: 10px;
          border-bottom: 1px solid var(--border);
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
        .mission-markdown blockquote {
          border-left: 3px solid var(--accent);
          margin: 16px 0;
          padding: 10px 16px;
          background: rgba(var(--accent-rgb, 168 85 247) / 0.06);
          border-radius: 0 6px 6px 0;
          color: var(--text-secondary);
          font-style: italic;
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
        .mission-markdown pre {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 16px;
          overflow-x: auto;
          margin: 12px 0;
        }
        .mission-markdown pre code {
          background: none;
          padding: 0;
          color: var(--text-primary);
          font-size: 13px;
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
