"use client";

import { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { RefreshCw, Target, AlertTriangle } from "lucide-react";

export default function MissionPage() {
  const [content, setContent] = useState<string>("");
  const [lastModified, setLastModified] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMission = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mission", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Fetch failed");
      }
      setContent(data.content);
      setLastModified(data.lastModified);
      setFetchedAt(new Date());
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMission();
  }, [fetchMission]);

  const formattedFetchedAt = fetchedAt
    ? fetchedAt.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })
    : null;

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
          onClick={fetchMission}
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

        {content && (
          <div className="mission-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}
      </main>

      {/* Spin keyframes */}
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
