"use client";

import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import type { ParamType } from "@/lib/project-scripts";

interface ProjectScriptModalProps {
  isOpen: boolean;
  projectId: string;
  onClose: () => void;
  onCreated: () => void;
}

interface ParamRow {
  key: string;
  label: string;
  flag: string;
  type: ParamType;
  defaultValue: string;
  options: string; // comma-separated, only used when type === "select"
}

const PARAM_TYPES: Array<{ id: ParamType; label: string }> = [
  { id: "text", label: "텍스트" },
  { id: "number", label: "숫자" },
  { id: "date", label: "날짜" },
  { id: "select", label: "선택지" },
  { id: "flag", label: "체크박스(플래그)" },
];

function emptyParam(): ParamRow {
  return { key: "", label: "", flag: "", type: "text", defaultValue: "", options: "" };
}

export function ProjectScriptModal({ isOpen, projectId, onClose, onCreated }: ProjectScriptModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [command, setCommand] = useState("node");
  const [baseArgsText, setBaseArgsText] = useState("");
  const [confirmBeforeRun, setConfirmBeforeRun] = useState(false);
  const [params, setParams] = useState<ParamRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const reset = () => {
    setName("");
    setDescription("");
    setCommand("node");
    setBaseArgsText("");
    setConfirmBeforeRun(false);
    setParams([]);
    setError(null);
  };

  const updateParam = (idx: number, patch: Partial<ParamRow>) => {
    setParams((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const removeParam = (idx: number) => setParams((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError("스크립트 이름은 필수입니다");
    if (!baseArgsText.trim()) return setError("실행 파일 경로가 필요합니다 (예: scripts/check_orders.js)");
    const invalidParam = params.find((p) => !p.key.trim() || !p.flag.trim());
    if (invalidParam) return setError("모든 파라미터에는 key와 flag가 필요합니다");

    setIsSaving(true);
    try {
      const res = await fetch(`/api/project-scripts/${projectId}/scripts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          command: command.trim() || "node",
          baseArgs: baseArgsText.trim().split(/\s+/),
          confirmBeforeRun,
          params: params.map((p) => ({
            key: p.key.trim(),
            label: p.label.trim() || p.key.trim(),
            flag: p.flag.trim(),
            type: p.type,
            default: p.defaultValue.trim() || undefined,
            options: p.type === "select" ? p.options.split(",").map((o) => o.trim()).filter(Boolean) : undefined,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "생성 실패");
      reset();
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "생성 실패");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => {
          onClose();
        }}
      />
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl mx-4"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div
          className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between"
          style={{ backgroundColor: "var(--card)", borderBottom: "1px solid var(--border)" }}
        >
          <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            ➕ 스크립트 등록
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg"
            style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              카드 이름 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 신규 주문 확인"
              style={{
                width: "100%", padding: "0.65rem 0.9rem",
                backgroundColor: "var(--card-elevated)", border: "1px solid var(--border)",
                borderRadius: "0.5rem", color: "var(--text-primary)", outline: "none", fontSize: "0.9rem",
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              설명
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="이 스크립트가 무엇을 하는지"
              style={{
                width: "100%", padding: "0.65rem 0.9rem",
                backgroundColor: "var(--card-elevated)", border: "1px solid var(--border)",
                borderRadius: "0.5rem", color: "var(--text-primary)", outline: "none", fontSize: "0.85rem", resize: "none",
              }}
            />
          </div>

          <div className="flex gap-3">
            <div style={{ width: "6rem" }}>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                커맨드
              </label>
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                style={{
                  width: "100%", padding: "0.65rem 0.7rem",
                  backgroundColor: "var(--card-elevated)", border: "1px solid var(--border)",
                  borderRadius: "0.5rem", color: "var(--text-primary)", outline: "none",
                  fontSize: "0.85rem", fontFamily: "var(--font-mono)",
                }}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                실행 파일 경로 + 고정 인자 *
              </label>
              <input
                type="text"
                value={baseArgsText}
                onChange={(e) => setBaseArgsText(e.target.value)}
                placeholder="scripts/check_orders.js"
                style={{
                  width: "100%", padding: "0.65rem 0.9rem",
                  backgroundColor: "var(--card-elevated)", border: "1px solid var(--border)",
                  borderRadius: "0.5rem", color: "var(--text-primary)", outline: "none",
                  fontSize: "0.85rem", fontFamily: "var(--font-mono)",
                }}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            <input
              type="checkbox"
              checked={confirmBeforeRun}
              onChange={(e) => setConfirmBeforeRun(e.target.checked)}
              style={{ width: "1rem", height: "1rem", accentColor: "var(--accent)", cursor: "pointer" }}
            />
            비가역/주의 작업 — 실행 전 확인 버튼 한 번 더 요구
          </label>

          {/* Params builder */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                파라미터
              </label>
              <button
                type="button"
                onClick={() => setParams((prev) => [...prev, emptyParam()])}
                className="flex items-center gap-1 text-xs"
                style={{
                  padding: "0.3rem 0.6rem", borderRadius: "0.4rem",
                  backgroundColor: "var(--card-elevated)", color: "var(--accent)",
                  border: "1px solid var(--border)", cursor: "pointer",
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                파라미터 추가
              </button>
            </div>

            {params.length === 0 && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                파라미터 없이 고정 커맨드로만 실행하려면 비워두세요.
              </p>
            )}

            <div className="flex flex-col gap-3">
              {params.map((p, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "0.75rem", borderRadius: "0.5rem",
                    backgroundColor: "var(--card-elevated)", border: "1px solid var(--border)",
                  }}
                >
                  <div className="flex flex-wrap gap-2 mb-2">
                    <input
                      type="text"
                      value={p.key}
                      onChange={(e) => updateParam(idx, { key: e.target.value })}
                      placeholder="key (예: days)"
                      style={{ flex: "1 1 100px", padding: "0.4rem 0.6rem", borderRadius: "0.4rem", border: "1px solid var(--border)", backgroundColor: "var(--card)", color: "var(--text-primary)", fontSize: "0.75rem", outline: "none" }}
                    />
                    <input
                      type="text"
                      value={p.label}
                      onChange={(e) => updateParam(idx, { label: e.target.value })}
                      placeholder="라벨 (예: 조회 기간)"
                      style={{ flex: "1 1 120px", padding: "0.4rem 0.6rem", borderRadius: "0.4rem", border: "1px solid var(--border)", backgroundColor: "var(--card)", color: "var(--text-primary)", fontSize: "0.75rem", outline: "none" }}
                    />
                    <input
                      type="text"
                      value={p.flag}
                      onChange={(e) => updateParam(idx, { flag: e.target.value })}
                      placeholder="flag (예: --days)"
                      style={{ flex: "1 1 100px", padding: "0.4rem 0.6rem", borderRadius: "0.4rem", border: "1px solid var(--border)", backgroundColor: "var(--card)", color: "var(--text-primary)", fontSize: "0.75rem", outline: "none", fontFamily: "var(--font-mono)" }}
                    />
                    <select
                      value={p.type}
                      onChange={(e) => updateParam(idx, { type: e.target.value as ParamType })}
                      style={{ padding: "0.4rem 0.6rem", borderRadius: "0.4rem", border: "1px solid var(--border)", backgroundColor: "var(--card)", color: "var(--text-primary)", fontSize: "0.75rem", outline: "none" }}
                    >
                      {PARAM_TYPES.map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeParam(idx)}
                      style={{ padding: "0.4rem", border: "none", background: "none", color: "var(--error)", cursor: "pointer" }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {p.type !== "flag" && (
                      <input
                        type="text"
                        value={p.defaultValue}
                        onChange={(e) => updateParam(idx, { defaultValue: e.target.value })}
                        placeholder="기본값 (선택)"
                        style={{ flex: "1 1 120px", padding: "0.4rem 0.6rem", borderRadius: "0.4rem", border: "1px solid var(--border)", backgroundColor: "var(--card)", color: "var(--text-secondary)", fontSize: "0.7rem", outline: "none" }}
                      />
                    )}
                    {p.type === "select" && (
                      <input
                        type="text"
                        value={p.options}
                        onChange={(e) => updateParam(idx, { options: e.target.value })}
                        placeholder="선택지 (콤마구분: ALL,ANSWERED,NOANSWER)"
                        style={{ flex: "2 1 200px", padding: "0.4rem 0.6rem", borderRadius: "0.4rem", border: "1px solid var(--border)", backgroundColor: "var(--card)", color: "var(--text-secondary)", fontSize: "0.7rem", outline: "none" }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm" style={{ color: "var(--error)" }}>
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: "0.5rem 1.25rem", borderRadius: "0.5rem", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSaving}
              style={{
                padding: "0.625rem 1.5rem", backgroundColor: "var(--accent)", color: "#000",
                borderRadius: "0.5rem", border: "none", cursor: isSaving ? "not-allowed" : "pointer",
                fontWeight: 700, fontSize: "0.9rem", opacity: isSaving ? 0.7 : 1,
              }}
            >
              {isSaving ? "저장 중…" : "카드 만들기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
