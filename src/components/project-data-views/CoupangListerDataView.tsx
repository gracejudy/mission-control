"use client";

import type { CSSProperties } from "react";
import { AlertTriangle, CheckCircle2, HelpCircle, XCircle } from "lucide-react";
import type { CoupangDemandData, FreshnessEntry } from "@/lib/coupang-demand-data";

function statusMeta(status: FreshnessEntry["status"]) {
  switch (status) {
    case "ok":
      return { color: "var(--success)", bg: "var(--success-bg)", icon: CheckCircle2, label: "정상" };
    case "warning":
      return { color: "var(--warning)", bg: "var(--warning-soft)", icon: AlertTriangle, label: "지연" };
    case "critical":
      return { color: "var(--error)", bg: "var(--error-bg)", icon: XCircle, label: "심각" };
    default:
      return { color: "var(--text-muted)", bg: "transparent", icon: HelpCircle, label: "없음" };
  }
}

function FreshnessCard({ entry }: { entry: FreshnessEntry }) {
  const meta = statusMeta(entry.status);
  const Icon = meta.icon;
  return (
    <div
      style={{
        flex: "1 1 200px", minWidth: "200px", borderRadius: "0.6rem",
        border: "1px solid var(--border)", backgroundColor: "var(--card-elevated)", padding: "0.75rem 0.9rem",
      }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: 600 }}>{entry.label}</span>
        <span
          className="flex items-center gap-1"
          style={{
            fontSize: "0.65rem", fontWeight: 700, color: meta.color, backgroundColor: meta.bg,
            padding: "2px 7px", borderRadius: "999px",
          }}
        >
          <Icon style={{ width: "11px", height: "11px" }} />
          {meta.label}
        </span>
      </div>
      {entry.date ? (
        <>
          <div style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
            {entry.date} <span style={{ color: "var(--text-muted)" }}>· {entry.ageDays}일 전</span>
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "2px" }}>
            {entry.rowCount?.toLocaleString()}행 · 기대주기 {entry.expectedCadenceDays}일
          </div>
        </>
      ) : (
        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>파일 없음</div>
      )}
    </div>
  );
}

const thStyle: CSSProperties = {
  textAlign: "left", padding: "6px 10px", fontSize: "0.68rem", fontWeight: 700,
  color: "var(--text-muted)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
};
const tdStyle: CSSProperties = {
  padding: "6px 10px", fontSize: "0.75rem", color: "var(--text-primary)",
  borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
};

export function CoupangListerDataView({ data }: { data: CoupangDemandData }) {
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-5">
        {data.freshness.map((f) => (
          <FreshnessCard key={f.type} entry={f} />
        ))}
      </div>

      <div className="mb-5">
        <h4 style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
          카테고리 수요 상위 {data.topDemandCategories.length}개 (demand_*.csv · demandScore 순)
        </h4>
        {data.topDemandCategories.length === 0 ? (
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>데이터 없음</p>
        ) : (
          <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "0.5rem" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={thStyle}>카테고리</th>
                  <th style={thStyle}>월 검색량</th>
                  <th style={thStyle}>평균가</th>
                  <th style={thStyle}>대표 키워드</th>
                  <th style={thStyle}>경쟁</th>
                  <th style={thStyle}>demandScore</th>
                </tr>
              </thead>
              <tbody>
                {data.topDemandCategories.map((r, i) => (
                  <tr key={i}>
                    <td style={tdStyle}>{r.categoryName}</td>
                    <td style={{ ...tdStyle, fontFamily: "var(--font-mono)" }}>{r.totalVolume.toLocaleString()}</td>
                    <td style={{ ...tdStyle, fontFamily: "var(--font-mono)" }}>{r.avgPrice.toLocaleString()}원</td>
                    <td style={tdStyle}>{r.topKeyword}</td>
                    <td style={tdStyle}>{r.competitionIdx || "-"}</td>
                    <td style={{ ...tdStyle, fontFamily: "var(--font-mono)" }}>{r.demandScore.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h4 style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
          소싱 후보 키워드 상위 {data.topGapScoreKeywords.length}개 (keyword_demand_*.csv · 소싱/브랜드/물류 통과 + 미보유 + gapScore 순)
        </h4>
        {data.topGapScoreKeywords.length === 0 ? (
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>데이터 없음</p>
        ) : (
          <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "0.5rem" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={thStyle}>키워드</th>
                  <th style={thStyle}>월 검색량</th>
                  <th style={thStyle}>최저 평균가</th>
                  <th style={thStyle}>경쟁</th>
                  <th style={thStyle}>gapScore</th>
                </tr>
              </thead>
              <tbody>
                {data.topGapScoreKeywords.map((r, i) => (
                  <tr key={i}>
                    <td style={tdStyle}>{r.keyword}</td>
                    <td style={{ ...tdStyle, fontFamily: "var(--font-mono)" }}>{r.searchVolume.toLocaleString()}</td>
                    <td style={{ ...tdStyle, fontFamily: "var(--font-mono)" }}>{r.minAvgPrice.toLocaleString()}원</td>
                    <td style={tdStyle}>{r.competitionIdx || "-"}</td>
                    <td style={{ ...tdStyle, fontFamily: "var(--font-mono)" }}>{r.gapScore.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
