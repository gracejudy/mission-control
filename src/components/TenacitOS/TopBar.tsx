"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Bell, User, Command, ExternalLink } from "lucide-react";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationDropdown } from "@/components/NotificationDropdown";
export function TopBar() {
  const [showSearch, setShowSearch] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch(true);
      }
      if (e.key === "Escape" && showSearch) {
        setShowSearch(false);
      }
      if (e.key === "Escape" && showUserMenu) {
        setShowUserMenu(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSearch, showUserMenu]);

  // Close user menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    if (showUserMenu) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showUserMenu]);

  return (
    <>
      <div
        className="top-bar"
        style={{
          position: "fixed",
          top: 0,
          left: "68px", // Width of dock
          right: 0,
          height: "48px",
          backgroundColor: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          zIndex: 45,
        }}
      >
        {/* Left: Logo & Title */}
        <div className="flex items-center gap-3">
          <span style={{ fontSize: "20px" }}>🦞</span>
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "16px",
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-0.5px",
            }}
          >
            TenacitOS
          </h1>
          {/* Version Badge */}
          <div
            style={{
              backgroundColor: "var(--accent-soft)",
              borderRadius: "4px",
              padding: "2px 8px",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "9px",
                fontWeight: 700,
                color: "var(--accent)",
                letterSpacing: "1px",
              }}
            >
              v1.0
            </span>
          </div>
        </div>

        {/* Right: Search + Notifications + User */}
        <div className="flex items-center gap-3">
          {/* Search Box */}
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-2 transition-all"
            style={{
              width: "240px",
              height: "32px",
              backgroundColor: "var(--surface-elevated)",
              borderRadius: "6px",
              padding: "0 12px",
            }}
          >
            <Search
              className="flex-shrink-0"
              style={{
                width: "16px",
                height: "16px",
                color: "var(--text-muted)",
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "12px",
                color: "var(--text-muted)",
              }}
            >
              Search... ⌘K
            </span>
          </button>

          {/* Notifications Dropdown */}
          <NotificationDropdown />

          {/* User Area */}
          <div ref={userMenuRef} style={{ position: "relative" }}>
            <button
              onClick={() => setShowUserMenu((v) => !v)}
              className="flex items-center gap-2"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px 6px",
                borderRadius: "8px",
                transition: "background 150ms",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--surface-elevated)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "14px",
                  backgroundColor: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "#000",
                  }}
                >
                  J
                </span>
              </div>
              {/* Name */}
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                }}
              >
                주연
              </span>
            </button>

            {/* Dropdown */}
            {showUserMenu && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  width: "180px",
                  backgroundColor: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                  overflow: "hidden",
                  zIndex: 100,
                }}
              >
                {/* 주연 */}
                <button
                  onClick={() => {
                    window.open("/about/kim_juyeon.html", "_blank");
                    setShowUserMenu(false);
                  }}
                  className="flex items-center justify-between w-full px-4 py-3 text-left"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    borderBottom: "1px solid var(--border)",
                    transition: "background 120ms",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--surface-elevated)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>주연</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px" }}>김주연 소개</div>
                  </div>
                  <ExternalLink style={{ width: "13px", height: "13px", color: "var(--text-muted)", flexShrink: 0 }} />
                </button>

                {/* Judy */}
                <button
                  onClick={() => {
                    window.open("/about/about_judy.html", "_blank");
                    setShowUserMenu(false);
                  }}
                  className="flex items-center justify-between w-full px-4 py-3 text-left"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    transition: "background 120ms",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--surface-elevated)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Judy 🦞</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px" }}>에이전트 소개</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Global Search Modal */}
      {showSearch && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.8)",
          }}
          onClick={() => setShowSearch(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "90%",
              maxWidth: "42rem",
            }}
          >
            <GlobalSearch />
          </div>
        </div>
      )}
    </>
  );
}
