"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  /** 최초 렌더 시 펼침 여부. 이후엔 사용자 토글이 우선한다 — 부모가 이 값을
   *  다시 바꿔 초기화하고 싶으면 key prop을 바꿔 리마운트시킬 것. */
  defaultOpen: boolean;
  /** 제목 옆에 붙는 배지(예: 상태 요약, 개수). */
  badge?: ReactNode;
  /** 헤더 오른쪽 끝, 토글과 무관하게 동작하는 버튼 등(예: "스크립트 추가"). */
  action?: ReactNode;
  children: ReactNode;
}

export function CollapsibleSection({ title, defaultOpen, badge, action, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className="rounded-xl mb-4"
      style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}
    >
      <div
        className="flex items-center justify-between gap-2"
        style={{ padding: "12px 16px" }}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 flex-1 min-w-0"
          style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
        >
          {open ? (
            <ChevronUp style={{ width: "16px", height: "16px", color: "var(--text-muted)", flexShrink: 0 }} />
          ) : (
            <ChevronDown style={{ width: "16px", height: "16px", color: "var(--text-muted)", flexShrink: 0 }} />
          )}
          <span
            style={{
              fontSize: "14px", fontWeight: 700, color: "var(--text-primary)",
              fontFamily: "var(--font-heading)", letterSpacing: "-0.3px",
            }}
          >
            {title}
          </span>
          {badge}
        </button>
        {action && (
          <div onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}>
            {action}
          </div>
        )}
      </div>
      {open && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "16px" }}>
          {children}
        </div>
      )}
    </div>
  );
}
