"use client";

import { useState } from "react";
import {
  Terminal,
  Trash2,
  Zap,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import type { RegisteredScript, ScriptParam, RunResult } from "@/lib/project-scripts";

interface ProjectScriptCardProps {
  projectId: string;
  script: RegisteredScript;
  onDelete: (scriptId: string) => void;
}

function initialValues(script: RegisteredScript): Record<string, string | boolean> {
  const values: Record<string, string | boolean> = {};
  for (const p of script.params) {
    if (p.type === "flag") {
      values[p.key] = p.default === true;
    } else {
      values[p.key] = p.default !== undefined ? String(p.default) : "";
    }
  }
  return values;
}

/** 서버(lib/project-scripts.ts validateValues)와 동일한 규칙을 입력 즉시 보여준다. */
function validateParam(p: ScriptParam, value: string | boolean | undefined): string | null {
  if (p.type === "flag") return null;
  const raw = typeof value === "string" ? value : "";
  if (p.required && raw === "") return "필수 항목입니다";
  if (raw === "") return null;
  if (p.type === "number") {
    const n = Number(raw);
    if (Number.isNaN(n)) return "숫자를 입력하세요";
    if (p.min !== undefined && n < p.min) return `최소 ${p.min} 이상이어야 합니다`;
    if (p.max !== undefined && n > p.max) return `최대 ${p.max}까지 가능합니다`;
  }
  if (p.type === "text" && p.pattern) {
    if (!new RegExp(p.pattern).test(raw)) return p.patternMessage ?? "형식이 올바르지 않습니다";
  }
  return null;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function ProjectScriptCard({ projectId, script, onDelete }: ProjectScriptCardProps) {
  const [values, setValues] = useState<Record<string, string | boolean>>(() => initialValues(script));
  const [isRunning, setIsRunning] = useState(false);
  const [confirmRun, setConfirmRun] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lastResult, setLastResult] = useState<RunResult | null>(null);
  const [outputExpanded, setOutputExpanded] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectedNotice, setReconnectedNotice] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  const setValue = (key: string, v: string | boolean) => setValues((prev) => ({ ...prev, [key]: v }));
  const touch = (key: string) => setTouched((prev) => ({ ...prev, [key]: true }));

  const fieldErrors = Object.fromEntries(
    script.params.map((p) => [p.key, validateParam(p, values[p.key])])
  ) as Record<string, string | null>;
  const hasErrors = Object.values(fieldErrors).some(Boolean);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    try {
      const res = await fetch(`/api/project-scripts/${projectId}/scripts/${script.id}/reconnect`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("재연결 실패");
      setLastResult(null);
      setReconnectedNotice(true);
      setTimeout(() => setReconnectedNotice(false), 4000);
    } catch {
      // lastResult(stale 배너)를 그대로 유지 — 사용자가 다시 시도할 수 있게
    } finally {
      setIsReconnecting(false);
    }
  };

  const doRun = async () => {
    setIsRunning(true);
    setConfirmRun(false);
    try {
      const res = await fetch("/api/project-scripts/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, scriptId: script.id, values }),
      });
      const data = (await res.json()) as RunResult;
      setLastResult(data);
      setOutputExpanded(true);
    } catch (err) {
      setLastResult({
        success: false,
        stdout: "",
        stderr: "",
        durationMs: 0,
        ranAt: new Date().toISOString(),
        command: "",
        error: err instanceof Error ? err.message : "네트워크 오류",
      });
      setOutputExpanded(true);
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunClick = () => {
    if (isRunning) return;
    if (hasErrors) {
      setSubmitted(true);
      return;
    }
    if (script.confirmBeforeRun && !confirmRun) {
      setConfirmRun(true);
      return;
    }
    doRun();
  };

  const commandPreview = [script.command, ...script.baseArgs].join(" ");

  return (
    <div
      className="rounded-xl"
      style={{
        border: "1px solid var(--border)",
        backgroundColor: "color-mix(in srgb, var(--card) 50%, transparent)",
        position: "relative",
      }}
    >
      <div className="p-3 md:p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-2 gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Terminal className="w-4 h-4 flex-shrink-0" style={{ color: "var(--info)" }} />
              <h3
                className="text-sm md:text-base font-semibold"
                style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}
              >
                {script.name}
              </h3>
              {script.confirmBeforeRun && (
                <span
                  className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--warning) 15%, transparent)",
                    color: "var(--warning)",
                  }}
                  title="실행 전 확인이 필요한 스크립트"
                >
                  <AlertTriangle className="w-3 h-3" />
                  확인 필요
                </span>
              )}
            </div>
            {script.description && (
              <p className="text-xs md:text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                {script.description}
              </p>
            )}
          </div>

          <button
            onClick={() => setConfirmDelete(true)}
            title="스크립트 삭제"
            className="p-1.5 rounded-lg flex-shrink-0"
            style={{ border: "none", background: "none", color: "var(--text-muted)", cursor: "pointer" }}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Command preview */}
        <code
          className="block text-[11px] px-2.5 py-1.5 rounded mb-3 overflow-x-auto whitespace-nowrap"
          style={{
            backgroundColor: "rgba(42, 42, 42, 0.5)",
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {commandPreview}
        </code>

        {/* Params */}
        {script.params.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {script.params.map((p) => {
              const showError = (touched[p.key] || submitted) && fieldErrors[p.key];
              const borderColor = showError
                ? "var(--error)"
                : p.required
                  ? "color-mix(in srgb, var(--warning) 55%, var(--border))"
                  : "var(--border)";
              return (
                <label
                  key={p.key}
                  className="flex flex-col gap-1"
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-secondary)",
                    padding: p.required ? "0.35rem 0.5rem 0.4rem" : 0,
                    borderRadius: p.required ? "0.4rem" : 0,
                    backgroundColor: p.required ? "color-mix(in srgb, var(--warning) 6%, transparent)" : "transparent",
                  }}
                >
                  <span className="flex items-center gap-1">
                    {p.label}
                    {p.required && (
                      <span
                        style={{
                          fontSize: "0.6rem",
                          fontWeight: 700,
                          color: "var(--warning)",
                          backgroundColor: "color-mix(in srgb, var(--warning) 18%, transparent)",
                          padding: "1px 5px",
                          borderRadius: "8px",
                          letterSpacing: "0.02em",
                        }}
                      >
                        필수
                      </span>
                    )}
                    {(p.min !== undefined || p.max !== undefined) && (
                      <span style={{ color: "var(--text-muted)" }}>
                        ({p.min ?? "…"}–{p.max ?? "…"})
                      </span>
                    )}
                  </span>
                  {p.type === "flag" ? (
                    <div style={{ display: "flex", alignItems: "center", height: "2rem" }}>
                      <input
                        type="checkbox"
                        checked={values[p.key] === true}
                        onChange={(e) => setValue(p.key, e.target.checked)}
                        style={{ width: "1rem", height: "1rem", accentColor: "var(--accent)", cursor: "pointer" }}
                      />
                    </div>
                  ) : p.type === "select" ? (
                    <select
                      value={String(values[p.key] ?? "")}
                      onChange={(e) => setValue(p.key, e.target.value)}
                      onBlur={() => touch(p.key)}
                      style={{
                        padding: "0.4rem 0.5rem",
                        borderRadius: "0.4rem",
                        border: `1px solid ${borderColor}`,
                        backgroundColor: "var(--card-elevated)",
                        color: "var(--text-primary)",
                        fontSize: "0.75rem",
                        outline: "none",
                      }}
                    >
                      {(p.options ?? []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={p.type === "date" ? "date" : p.type === "number" ? "number" : "text"}
                      value={String(values[p.key] ?? "")}
                      placeholder={p.placeholder}
                      onChange={(e) => setValue(p.key, e.target.value)}
                      onBlur={() => touch(p.key)}
                      style={{
                        padding: "0.4rem 0.5rem",
                        borderRadius: "0.4rem",
                        border: `1px solid ${borderColor}`,
                        backgroundColor: "var(--card-elevated)",
                        color: "var(--text-primary)",
                        fontSize: "0.75rem",
                        outline: "none",
                        width: p.type === "number" ? "5rem" : "9rem",
                      }}
                    />
                  )}
                  {showError && (
                    <span style={{ color: "var(--error)", fontSize: "0.68rem" }}>{fieldErrors[p.key]}</span>
                  )}
                </label>
              );
            })}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
          {lastResult && !lastResult.stale && (
            <button
              onClick={() => setOutputExpanded(!outputExpanded)}
              className="flex items-center gap-1 text-xs"
              style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
            >
              {outputExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              최근 실행 결과
            </button>
          )}
          {reconnectedNotice && (
            <span className="text-xs" style={{ color: "var(--success)" }}>
              재연결 완료 — 다시 실행하세요
            </span>
          )}

          <div className="flex-1" />

          <button
            onClick={handleRunClick}
            disabled={isRunning}
            title={script.confirmBeforeRun ? "비가역/주의 작업 — 실행 전 확인 필요" : "실행"}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs md:text-sm rounded-lg"
            style={{
              backgroundColor: confirmRun || lastResult?.stale
                ? "color-mix(in srgb, var(--warning) 18%, transparent)"
                : lastResult?.success === true
                  ? "color-mix(in srgb, var(--success) 15%, transparent)"
                  : lastResult?.success === false
                    ? "color-mix(in srgb, var(--error) 15%, transparent)"
                    : "color-mix(in srgb, var(--accent) 15%, transparent)",
              color: confirmRun || lastResult?.stale
                ? "var(--warning)"
                : lastResult?.success === true
                  ? "var(--success)"
                  : lastResult?.success === false
                    ? "var(--error)"
                    : "var(--accent)",
              border: "1px solid",
              borderColor: confirmRun || lastResult?.stale
                ? "color-mix(in srgb, var(--warning) 40%, transparent)"
                : "color-mix(in srgb, var(--accent) 30%, transparent)",
              cursor: isRunning ? "not-allowed" : "pointer",
              opacity: isRunning ? 0.7 : 1,
              fontWeight: 600,
            }}
          >
            {isRunning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : confirmRun || lastResult?.stale ? (
              <AlertTriangle className="w-3.5 h-3.5" />
            ) : lastResult?.success === true ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : lastResult?.success === false ? (
              <XCircle className="w-3.5 h-3.5" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            {isRunning ? "실행 중…" : confirmRun ? "다시 눌러서 확인" : lastResult?.stale ? "변경 감지됨" : "실행"}
          </button>
        </div>

        {/* Stale banner — 실행 파일이 등록 당시와 달라졌을 때 (해시 불일치) */}
        {lastResult?.stale && (
          <div
            style={{
              marginTop: "0.75rem",
              padding: "0.75rem 0.9rem",
              borderRadius: "0.5rem",
              backgroundColor: "color-mix(in srgb, var(--warning) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--warning) 35%, transparent)",
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              flexWrap: "wrap",
            }}
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "var(--warning)" }} />
            <span className="text-xs" style={{ color: "var(--text-primary)", flex: 1 }}>
              스크립트가 변경되었습니다. 재연결이 필요합니다.
            </span>
            <button
              onClick={handleReconnect}
              disabled={isReconnecting}
              className="flex items-center gap-1.5 text-xs"
              style={{
                padding: "0.35rem 0.7rem",
                borderRadius: "0.4rem",
                backgroundColor: "var(--warning)",
                color: "#000",
                border: "none",
                cursor: isReconnecting ? "not-allowed" : "pointer",
                fontWeight: 700,
                opacity: isReconnecting ? 0.7 : 1,
              }}
            >
              {isReconnecting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              재연결
            </button>
          </div>
        )}

        {/* Output panel */}
        {lastResult && !lastResult.stale && outputExpanded && (
          <div
            style={{
              marginTop: "0.75rem",
              backgroundColor: "var(--card-elevated)",
              borderRadius: "0.5rem",
              border: "1px solid var(--border)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "0.5rem 0.75rem",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.75rem",
                color: "var(--text-secondary)",
              }}
            >
              {lastResult.success ? (
                <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "var(--success)" }} />
              ) : (
                <XCircle className="w-3.5 h-3.5" style={{ color: "var(--error)" }} />
              )}
              <span>{new Date(lastResult.ranAt).toLocaleString("ko-KR", { hour12: false })}</span>
              <span style={{ color: "var(--text-muted)" }}>· {formatDuration(lastResult.durationMs)}</span>
            </div>
            <div
              style={{
                maxHeight: "220px",
                overflowY: "auto",
                padding: "0.5rem 0.75rem",
                fontFamily: "var(--font-mono)",
                fontSize: "0.7rem",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              {lastResult.error && (
                <div style={{ color: "var(--error)", marginBottom: "0.4rem" }}>{lastResult.error}</div>
              )}
              {lastResult.stdout && <div style={{ color: "var(--text-secondary)" }}>{lastResult.stdout}</div>}
              {lastResult.stderr && <div style={{ color: "var(--warning)" }}>{lastResult.stderr}</div>}
              {!lastResult.stdout && !lastResult.stderr && !lastResult.error && (
                <div style={{ color: "var(--text-muted)" }}>출력 없음</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete confirm overlay */}
      {confirmDelete && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(12, 12, 12, 0.9)",
            borderRadius: "0.75rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(4px)",
            zIndex: 10,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <p style={{ color: "var(--text-primary)", marginBottom: "1rem" }}>
              &quot;{script.name}&quot; 카드를 삭제할까요?
            </p>
            <div className="flex items-center gap-3 justify-center">
              <button
                onClick={() => setConfirmDelete(false)}
                style={{ padding: "0.5rem 1rem", color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer" }}
              >
                취소
              </button>
              <button
                onClick={() => onDelete(script.id)}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "var(--error)",
                  color: "var(--text-primary)",
                  border: "none",
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                }}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
