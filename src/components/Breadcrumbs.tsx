"use client";

import { Home, ChevronRight } from "lucide-react";

interface BreadcrumbsProps {
  path: string;
  onNavigate: (path: string) => void;
  prefix?: string;
  /** Absolute filesystem path of this workspace's root, shown next to the root button. */
  rootPath?: string;
}

export function Breadcrumbs({ path, onNavigate, prefix = "workspace", rootPath }: BreadcrumbsProps) {
  const segments = path.split("/").filter(Boolean);

  const handleClick = (index: number) => {
    const newPath = segments.slice(0, index + 1).join("/");
    onNavigate(newPath);
  };

  return (
    <div>
      <nav className="flex items-center gap-1 text-sm overflow-x-auto pb-1">
        <button
          onClick={() => onNavigate("")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "4px 8px",
            borderRadius: "4px",
            color: "var(--text-secondary)",
            transition: "all 150ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--surface-hover)";
            e.currentTarget.style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "var(--text-secondary)";
          }}
          title={rootPath ? `루트로 이동 (${rootPath})` : "루트로 이동"}
        >
          <Home className="w-4 h-4" />
          <span>{prefix}</span>
        </button>

        {segments.map((segment, index) => (
          <div key={index} className="flex items-center gap-1 shrink-0">
            <ChevronRight className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
            <button
              onClick={() => handleClick(index)}
              style={{
                padding: "4px 8px",
                borderRadius: "4px",
                color: index === segments.length - 1 ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: index === segments.length - 1 ? 600 : 400,
                transition: "all 150ms ease",
              }}
              onMouseEnter={(e) => {
                if (index !== segments.length - 1) {
                  e.currentTarget.style.backgroundColor = "var(--surface-hover)";
                  e.currentTarget.style.color = "var(--text-primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (index !== segments.length - 1) {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }
              }}
            >
              {segment}
            </button>
          </div>
        ))}
      </nav>

      {rootPath && (
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "var(--text-muted)",
            paddingLeft: "8px",
            margin: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {rootPath}
        </p>
      )}
    </div>
  );
}
