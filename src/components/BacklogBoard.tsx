"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ChevronDown, ChevronUp, ListTodo } from "lucide-react";
import type { BacklogData, BacklogItem, BacklogProject } from "@/lib/backlog";

// ── 표시 규칙 (backlog.md 운영 컨벤션 매핑) ─────────────────────────────────
// 우선순위 이모지 자체가 "긴급/보안·운영영향·정리성"을 뜻하므로 그대로 재사용.
const PRIO_META: Record<string, { label: string; badgeClass: string; color: string }> = {
  "🔴": { label: "긴급/보안", badgeClass: "badge-error", color: "var(--negative)" },
  "🟡": { label: "운영영향", badgeClass: "badge-warning", color: "var(--warning)" },
  "🟢": { label: "정리성", badgeClass: "badge-success", color: "var(--positive)" },
};
const PRIO_ORDER: Record<string, number> = { "🔴": 0, "🟡": 1, "🟢": 2 };

function categoryIcon(name: string): string {
  if (name === "기타") return "📦";
  if (name === "실험/미승격") return "🧪";
  return "📁";
}

function statusMeta(status: string | null): { icon: string; badgeClass: string } | null {
  if (!status) return null;
  if (status.includes("운영")) return { icon: "🟢", badgeClass: "badge-success" };
  if (status.includes("유지보수")) return { icon: "🔧", badgeClass: "badge-info" };
  if (status.includes("완료")) return { icon: "✅", badgeClass: "badge-success" };
  if (status.includes("철수")) return { icon: "🚪", badgeClass: "badge-error" };
  return { icon: "•", badgeClass: "badge" };
}

function staleTier(days: number | null): "high" | "mid" | "low" {
  if (days === null || days === undefined) return "low";
  if (days >= 21) return "high";
  if (days >= 14) return "mid";
  return "low";
}

const STALE_COLOR: Record<string, string> = {
  high: "var(--negative)",
  mid: "var(--warning)",
  low: "var(--text-muted)",
};

function sortItems(items: BacklogItem[]): BacklogItem[] {
  return [...items].sort((a, b) => {
    const pa = PRIO_ORDER[a.prio] ?? 3;
    const pb = PRIO_ORDER[b.prio] ?? 3;
    if (pa !== pb) return pa - pb;
    return (b.stale_days ?? 0) - (a.stale_days ?? 0);
  });
}

// ── 작은 표시 요소 ────────────────────────────────────────────────────────

function PrioPill({ prio }: { prio: string }) {
  const meta = PRIO_META[prio] ?? PRIO_META["🟢"];
  return (
    <span className={`badge ${meta.badgeClass}`} title={meta.label} style={{ flexShrink: 0 }}>
      {prio} {meta.label}
    </span>
  );
}

function StaleBadge({ days, label }: { days: number | null; label: string }) {
  const tier = staleTier(days);
  return (
    <span
      title="긴급도 — 마지막으로 손댄 지 얼마나 지났는지"
      style={{
        fontSize: "11px",
        fontWeight: tier === "high" ? 700 : 500,
        color: STALE_COLOR[tier],
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
      }}
    >
      ⏱ {days === null ? "미상" : `${label} ${days}일`}
    </span>
  );
}

// ── 항목 한 줄 ────────────────────────────────────────────────────────────

function BacklogItemRow({ item }: { item: BacklogItem }) {
  return (
    <div
      style={{
        padding: "10px 0",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", flexWrap: "wrap" }}>
        <PrioPill prio={item.prio} />
        <span title={item.in_progress ? "진행중" : "미착수"} style={{ fontSize: "13px", flexShrink: 0 }}>
          {item.in_progress ? "🔄" : "☐"}
        </span>
        <span
          style={{
            fontSize: "13px",
            color: "var(--text-primary)",
            lineHeight: 1.6,
            wordBreak: "keep-all",
            flex: 1,
            minWidth: "200px",
          }}
        >
          {item.raw}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", paddingLeft: "2px" }}>
        {item.target && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--accent)",
              backgroundColor: "var(--card-elevated, rgba(255,255,255,0.06))",
              padding: "2px 6px",
              borderRadius: "4px",
              wordBreak: "break-all",
            }}
          >
            → {item.target}
          </span>
        )}
        <StaleBadge days={item.stale_days} label="방치" />
        {item.first_seen && (
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            최초 {item.age_days ?? "?"}일 전({item.first_seen}
            {item.age_floor ? "+" : ""})
          </span>
        )}
      </div>
    </div>
  );
}

// ── 프로젝트 카드 ─────────────────────────────────────────────────────────

function BacklogProjectCard({ project, items }: { project: BacklogProject; items: BacklogItem[] }) {
  const [showAuto, setShowAuto] = useState(false);
  const status = statusMeta(project.status);
  const mainItems = sortItems(items.filter((i) => !i.auto));
  const autoItems = sortItems(items.filter((i) => i.auto));
  const total = project.red + project.yellow + project.green || 1;

  return (
    <div
      style={{
        borderRadius: "10px",
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
          <span style={{ fontSize: "15px" }}>{categoryIcon(project.name)}</span>
          <h3
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "var(--text-primary)",
              flex: 1,
              wordBreak: "keep-all",
            }}
          >
            {project.name}
          </h3>
          {status && (
            <span className={`badge ${status.badgeClass}`} title={project.status ?? undefined}>
              {status.icon} {project.status}
            </span>
          )}
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--text-secondary)",
              backgroundColor: "var(--surface-hover)",
              padding: "3px 9px",
              borderRadius: "10px",
              flexShrink: 0,
            }}
          >
            {project.open}건
          </span>
        </div>

        {/* 우선순위 비율 막대 */}
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "5px",
            borderRadius: "3px",
            overflow: "hidden",
            backgroundColor: "var(--border)",
            marginBottom: "10px",
          }}
        >
          {project.red > 0 && (
            <div style={{ flex: project.red / total, backgroundColor: "var(--negative)" }} />
          )}
          {project.yellow > 0 && (
            <div style={{ flex: project.yellow / total, backgroundColor: "var(--warning)" }} />
          )}
          {project.green > 0 && (
            <div style={{ flex: project.green / total, backgroundColor: "var(--positive)" }} />
          )}
        </div>

        {/* 배지 행 */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {project.red > 0 && (
            <span style={{ fontSize: "11px", color: "var(--negative)" }}>🔴 {project.red}</span>
          )}
          {project.yellow > 0 && (
            <span style={{ fontSize: "11px", color: "var(--warning)" }}>🟡 {project.yellow}</span>
          )}
          {project.green > 0 && (
            <span style={{ fontSize: "11px", color: "var(--positive)" }}>🟢 {project.green}</span>
          )}
          <StaleBadge days={project.stalest_days} label="최장" />
          {!!project.dirty && (
            <span style={{ fontSize: "11px", color: "var(--info)" }} title="git status 기준 미커밋 파일 있음">
              💾 미커밋 {project.dirty}건
            </span>
          )}
          {project.last_commit && (
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              마지막 커밋 {project.last_commit_days}일 전
            </span>
          )}
        </div>
      </div>

      {/* 항목 리스트 — redaction 없이 전체 표시 */}
      <div style={{ padding: "4px 18px 6px 18px", flex: 1 }}>
        {mainItems.length === 0 && autoItems.length === 0 && (
          <p style={{ padding: "12px 0", fontSize: "12px", color: "var(--text-muted)" }}>항목 없음</p>
        )}
        {mainItems.map((item, i) => (
          <BacklogItemRow key={i} item={item} />
        ))}

        {autoItems.length > 0 && (
          <div>
            <button
              onClick={() => setShowAuto((v) => !v)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                padding: "10px 0",
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                fontSize: "12px",
                cursor: "pointer",
                width: "100%",
              }}
            >
              {showAuto ? <ChevronUp style={{ width: "13px", height: "13px" }} /> : <ChevronDown style={{ width: "13px", height: "13px" }} />}
              🤖 자동 로그 {autoItems.length}건 {showAuto ? "접기" : "펼치기"}
            </button>
            {showAuto && autoItems.map((item, i) => <BacklogItemRow key={i} item={item} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 최상단 요약 칩 ────────────────────────────────────────────────────────

function TotalsStrip({ totals }: { totals: BacklogData["summary"]["totals"] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
      <span
        style={{
          fontSize: "12px",
          fontWeight: 600,
          color: "var(--text-secondary)",
          backgroundColor: "var(--surface-hover)",
          padding: "5px 12px",
          borderRadius: "999px",
        }}
      >
        전체 {totals.open}건
      </span>
      <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--negative)", backgroundColor: "var(--negative-soft)", padding: "5px 12px", borderRadius: "999px" }}>
        🔴 {totals.red} 긴급/보안
      </span>
      <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--warning)", backgroundColor: "var(--warning-soft)", padding: "5px 12px", borderRadius: "999px" }}>
        🟡 {totals.yellow} 운영영향
      </span>
      <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--positive)", backgroundColor: "var(--positive-soft)", padding: "5px 12px", borderRadius: "999px" }}>
        🟢 {totals.green} 정리성
      </span>
      {totals.auto > 0 && (
        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>🤖 자동 로그 {totals.auto}건 포함</span>
      )}
    </div>
  );
}

// ── 메인 ─────────────────────────────────────────────────────────────────

export function BacklogBoard() {
  const [data, setData] = useState<BacklogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBacklog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/backlog", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Fetch failed");
      setData(json as BacklogData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBacklog();
  }, [fetchBacklog]);

  return (
    <div
      style={{
        borderRadius: "10px",
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
        overflow: "hidden",
        marginBottom: "24px",
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
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <ListTodo style={{ width: "16px", height: "16px", color: "var(--accent)" }} />
          <h2 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>백로그</h2>
          {data && (
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              backlog.md 갱신 {data.summary.backlog_mtime}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {data && <TotalsStrip totals={data.summary.totals} />}
          <button
            onClick={fetchBacklog}
            disabled={loading}
            title="새로고침"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "6px",
              backgroundColor: "var(--surface-elevated)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "12px",
              fontWeight: 500,
              opacity: loading ? 0.5 : 1,
            }}
          >
            <RefreshCw style={{ width: "12px", height: "12px", animation: loading ? "spin 1s linear infinite" : "none" }} />
            새로고침
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "18px 20px" }}>
        {loading && !data && (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)" }}>
            <RefreshCw style={{ width: "14px", height: "14px", animation: "spin 1s linear infinite", display: "inline-block", marginRight: "6px" }} />
            로딩 중...
          </div>
        )}
        {error && (
          <div
            style={{
              padding: "14px 18px",
              borderRadius: "8px",
              backgroundColor: "var(--negative-soft)",
              border: "1px solid var(--negative)",
              fontSize: "13px",
              color: "var(--negative)",
            }}
          >
            로드 실패: {error}
          </div>
        )}
        {data && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))",
              gap: "16px",
              alignItems: "start",
            }}
          >
            {data.summary.projects.map((project) => (
              <BacklogProjectCard
                key={project.name}
                project={project}
                items={data.detail.items.filter((item) => item.project === project.name)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
