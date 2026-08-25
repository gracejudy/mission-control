"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface AddProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function AddProjectModal({ isOpen, onClose, onCreated }: AddProjectModalProps) {
  const [label, setLabel] = useState("");
  const [id, setId] = useState("");
  const [idTouched, setIdTouched] = useState(false);
  const [cwd, setCwd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleLabelChange = (v: string) => {
    setLabel(v);
    if (!idTouched) setId(slugify(v));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!label.trim() || !id.trim() || !cwd.trim()) {
      setError("모든 필드를 입력하세요");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch("/api/project-scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id.trim(), label: label.trim(), cwd: cwd.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "생성 실패");
      setLabel("");
      setId("");
      setIdTouched(false);
      setCwd("");
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-2xl shadow-2xl mx-4"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            ➕ 새 프로젝트 탭
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg"
            style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              프로젝트 이름 *
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => handleLabelChange(e.target.value)}
              placeholder="예: coupang-lister"
              style={{
                width: "100%",
                padding: "0.65rem 0.9rem",
                backgroundColor: "var(--card-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                color: "var(--text-primary)",
                outline: "none",
                fontSize: "0.9rem",
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              탭 id (영문 소문자/숫자/하이픈)
            </label>
            <input
              type="text"
              value={id}
              onChange={(e) => {
                setIdTouched(true);
                setId(e.target.value);
              }}
              placeholder="coupang-lister"
              style={{
                width: "100%",
                padding: "0.65rem 0.9rem",
                backgroundColor: "var(--card-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                color: "var(--text-primary)",
                outline: "none",
                fontSize: "0.85rem",
                fontFamily: "var(--font-mono)",
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              작업 디렉토리 (절대경로) *
            </label>
            <input
              type="text"
              value={cwd}
              onChange={(e) => setCwd(e.target.value)}
              placeholder="/Users/judy/dev/coupang-lister"
              style={{
                width: "100%",
                padding: "0.65rem 0.9rem",
                backgroundColor: "var(--card-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                color: "var(--text-primary)",
                outline: "none",
                fontSize: "0.85rem",
                fontFamily: "var(--font-mono)",
              }}
            />
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              이 프로젝트에 등록하는 스크립트는 이 디렉토리를 기준(cwd)으로 실행됩니다.
            </p>
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
                padding: "0.625rem 1.5rem",
                backgroundColor: "var(--accent)",
                color: "#000",
                borderRadius: "0.5rem",
                border: "none",
                cursor: isSaving ? "not-allowed" : "pointer",
                fontWeight: 700,
                fontSize: "0.9rem",
                opacity: isSaving ? 0.7 : 1,
              }}
            >
              {isSaving ? "생성 중…" : "만들기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
