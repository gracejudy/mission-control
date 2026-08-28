"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Layers, Plus, Terminal, Trash2 } from "lucide-react";
import { BacklogBoard } from "@/components/BacklogBoard";
import { ProjectScriptCard } from "@/components/ProjectScriptCard";
import { ProjectScriptModal } from "@/components/ProjectScriptModal";
import { AddProjectModal } from "@/components/AddProjectModal";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { ProjectDataSection } from "@/components/ProjectDataSection";
import type { ProjectScriptsRegistry } from "@/lib/project-scripts";

const BACKLOG_TAB = "__backlog__";

export default function ProjectsPage() {
  const [registry, setRegistry] = useState<ProjectScriptsRegistry>({ projects: [], scripts: {} });
  const [activeTab, setActiveTab] = useState<string>(BACKLOG_TAB);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [addScriptOpen, setAddScriptOpen] = useState(false);
  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState(false);

  const fetchRegistry = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/project-scripts", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "불러오기 실패");
      setRegistry(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRegistry();
  }, [fetchRegistry]);

  const handleDeleteScript = async (projectId: string, scriptId: string) => {
    try {
      const res = await fetch(`/api/project-scripts/${projectId}/scripts/${scriptId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      await fetchRegistry();
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제 실패");
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      const res = await fetch(`/api/project-scripts/${projectId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      setActiveTab(BACKLOG_TAB);
      setDeleteProjectConfirm(false);
      await fetchRegistry();
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제 실패");
    }
  };

  const activeProject = registry.projects.find((p) => p.id === activeTab) ?? null;
  const activeScripts = activeProject ? (registry.scripts[activeProject.id] ?? []) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div
        className="page-header"
        style={{ padding: "24px 32px 0 32px", flexShrink: 0, borderBottom: "1px solid var(--border)" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Layers style={{ width: "20px", height: "20px", color: "var(--accent)" }} />
            <h1
              style={{
                fontFamily: "var(--font-heading)", fontSize: "24px", fontWeight: 700,
                letterSpacing: "-1px", color: "var(--text-primary)",
              }}
            >
              Projects
            </h1>
          </div>
          <button
            onClick={() => { setLoading(true); fetchRegistry(); }}
            disabled={loading}
            title="새로고침"
            style={{
              display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px",
              borderRadius: "8px", backgroundColor: "var(--card-elevated, var(--card))",
              border: "1px solid var(--border)", color: "var(--text-secondary)",
              cursor: loading ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 500,
              opacity: loading ? 0.6 : 1,
            }}
          >
            <RefreshCw style={{ width: "14px", height: "14px", animation: loading ? "spin 1s linear infinite" : "none" }} />
            새로고침
          </button>
        </div>

        {/* Paper-tab row */}
        <div style={{ display: "flex", gap: "0", alignItems: "flex-end", flexWrap: "wrap" }}>
          <TabButton
            label="백로그"
            active={activeTab === BACKLOG_TAB}
            onClick={() => setActiveTab(BACKLOG_TAB)}
          />
          {registry.projects.map((p) => (
            <TabButton
              key={p.id}
              label={p.label}
              active={activeTab === p.id}
              onClick={() => setActiveTab(p.id)}
            />
          ))}
          <button
            onClick={() => setAddProjectOpen(true)}
            title="새 프로젝트 등록"
            style={{
              padding: "10px 16px", fontSize: "13px", fontWeight: 500, color: "var(--text-muted)",
              backgroundColor: "transparent", border: "1px dashed var(--border)", borderRadius: "8px 8px 0 0",
              cursor: "pointer", position: "relative", bottom: "-1px", marginRight: "4px",
              display: "flex", alignItems: "center", gap: "4px",
            }}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tab content */}
      <main
        className="page-content"
        style={{ flex: 1, overflowY: "auto", padding: "28px 32px", maxWidth: "1400px", width: "100%", margin: "0 auto" }}
      >
        {error && (
          <div
            style={{
              padding: "14px 18px", borderRadius: "8px", backgroundColor: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.3)", fontSize: "13px", color: "#ef4444", marginBottom: "20px",
            }}
          >
            {error}
          </div>
        )}

        {activeTab === BACKLOG_TAB && <BacklogBoard />}

        {activeProject && (
          <div>
            {/* Project header */}
            <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Terminal className="w-4 h-4" style={{ color: "var(--accent)" }} />
                  <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>
                    {activeProject.label}
                  </h2>
                </div>
                <code style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  {activeProject.cwd}
                </code>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDeleteProjectConfirm(true)}
                  title="이 프로젝트 탭 삭제"
                  className="flex items-center gap-1.5 text-xs"
                  style={{
                    padding: "0.5rem 0.75rem", borderRadius: "0.5rem", backgroundColor: "transparent",
                    color: "var(--text-muted)", border: "1px solid var(--border)", cursor: "pointer",
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {deleteProjectConfirm && (
              <div
                style={{
                  padding: "14px 18px", borderRadius: "8px", backgroundColor: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.3)", fontSize: "13px", color: "var(--text-primary)",
                  marginBottom: "20px", display: "flex", alignItems: "center", gap: "12px",
                }}
              >
                <span>&quot;{activeProject.label}&quot; 탭과 등록된 스크립트 {activeScripts.length}개를 모두 삭제할까요?</span>
                <button
                  onClick={() => setDeleteProjectConfirm(false)}
                  style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                >
                  취소
                </button>
                <button
                  onClick={() => handleDeleteProject(activeProject.id)}
                  style={{ background: "none", border: "none", color: "var(--error)", fontWeight: 700, cursor: "pointer" }}
                >
                  삭제
                </button>
              </div>
            )}

            {/* 상단: 프로젝트별 데이터 뷰 */}
            <ProjectDataSection projectId={activeProject.id} />

            {/* 하단: 스크립트 실행 카드 (모든 프로젝트 공통 구조) */}
            <CollapsibleSection
              key={`scripts-${activeProject.id}`}
              title="스크립트"
              defaultOpen={activeScripts.length > 0}
              badge={
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{activeScripts.length}개</span>
              }
              action={
                <button
                  onClick={() => setAddScriptOpen(true)}
                  className="flex items-center gap-1.5 text-xs md:text-sm"
                  style={{
                    padding: "0.4rem 0.8rem", borderRadius: "0.5rem", backgroundColor: "var(--accent)",
                    color: "#000", border: "none", cursor: "pointer", fontWeight: 600,
                  }}
                >
                  <Plus className="w-4 h-4" />
                  스크립트 추가
                </button>
              }
            >
              {activeScripts.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem 0" }}>
                  <Terminal className="w-8 h-8 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 500, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
                    등록된 스크립트가 없습니다
                  </h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                    &quot;스크립트 추가&quot;로 이 프로젝트에서 실행 가능한 스크립트를 카드로 등록하세요
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
                  {activeScripts.map((script) => (
                    <ProjectScriptCard
                      key={script.id}
                      projectId={activeProject.id}
                      script={script}
                      onDelete={(scriptId) => handleDeleteScript(activeProject.id, scriptId)}
                    />
                  ))}
                </div>
              )}
            </CollapsibleSection>
          </div>
        )}
      </main>

      <AddProjectModal
        isOpen={addProjectOpen}
        onClose={() => setAddProjectOpen(false)}
        onCreated={fetchRegistry}
      />
      {activeProject && (
        <ProjectScriptModal
          isOpen={addScriptOpen}
          projectId={activeProject.id}
          onClose={() => setAddScriptOpen(false)}
          onCreated={fetchRegistry}
        />
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 20px", fontSize: "13px", fontWeight: active ? 700 : 500,
        color: active ? "var(--text-primary)" : "var(--text-muted)",
        backgroundColor: active ? "var(--bg)" : "var(--card)",
        border: "1px solid var(--border)",
        borderBottom: active ? "1px solid var(--bg)" : "1px solid var(--border)",
        borderRadius: "8px 8px 0 0", cursor: "pointer", position: "relative", bottom: "-1px",
        transition: "all 150ms ease", marginRight: "4px", fontFamily: "var(--font-mono)",
      }}
    >
      {label}
    </button>
  );
}
