"use client";

import { useState, useEffect } from "react";
import { Database, Loader2 } from "lucide-react";
import { CollapsibleSection } from "./CollapsibleSection";
import { PROJECT_DATA_VIEWS } from "@/lib/project-data-views";

interface ProjectDataSectionProps {
  projectId: string;
}

/** 프로젝트별 "데이터" 섹션 — 등록된 뷰가 있으면 fetch해서 보여주고,
 *  없으면 빈 상태로 접힌 채 표시한다("기본은 데이터 있는 섹션이 펼쳐져있고 없는 곳은 접힘"). */
export function ProjectDataSection({ projectId }: ProjectDataSectionProps) {
  const View = PROJECT_DATA_VIEWS[projectId];
  const [loaded, setLoaded] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [payload, setPayload] = useState<any>(null);

  useEffect(() => {
    if (!View) return;
    setLoaded(false);
    setPayload(null);
    fetch(`/api/project-data/${projectId}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => { setPayload(data); setLoaded(true); })
      .catch(() => { setPayload({ available: false, hasContent: false }); setLoaded(true); });
  }, [projectId, View]);

  if (!View) {
    return (
      <CollapsibleSection key={`data-${projectId}-empty`} title="데이터" defaultOpen={false}>
        <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
          이 프로젝트에는 아직 등록된 데이터 뷰가 없습니다.
        </p>
      </CollapsibleSection>
    );
  }

  if (!loaded) {
    return (
      <div
        className="rounded-xl mb-4 flex items-center gap-2"
        style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)", padding: "12px 16px" }}
      >
        <Loader2 className="animate-spin" style={{ width: "14px", height: "14px", color: "var(--text-muted)" }} />
        <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>데이터 불러오는 중…</span>
      </div>
    );
  }

  return (
    <CollapsibleSection
      key={`data-${projectId}-loaded`}
      title="데이터"
      defaultOpen={Boolean(payload?.hasContent)}
      badge={
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          <Database style={{ width: "11px", height: "11px", display: "inline", marginRight: "3px" }} />
          {payload?.hasContent ? "수집됨" : "데이터 없음"}
        </span>
      }
    >
      <View data={payload} />
    </CollapsibleSection>
  );
}
