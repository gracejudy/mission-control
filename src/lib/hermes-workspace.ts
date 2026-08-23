/**
 * Hermes workspace discovery and resolution.
 *
 * Hermes lays out agent state under $HERMES_DIR:
 *   $HERMES_DIR/                        ← "default" profile (root itself)
 *   $HERMES_DIR/SOUL.md                 ← persona system prompt
 *   $HERMES_DIR/memories/{MEMORY.md,USER.md}
 *   $HERMES_DIR/profiles/<name>/        ← named profile, same shape as above
 *   $HERMES_DIR/profiles/<name>/SOUL.md
 *   $HERMES_DIR/profiles/<name>/memories/{MEMORY.md,USER.md}
 *
 * This mirrors OpenClaw's workspace/workspace-<id> convention closely enough
 * to reuse the same tree-browser and memory-viewer UI — only the discovery
 * and path-resolution logic differs.
 */
import fs from "fs";
import path from "path";
import os from "os";

export const HERMES_DIR = process.env.HERMES_DIR || path.join(os.homedir(), ".hermes");
const PROFILES_DIR = path.join(HERMES_DIR, "profiles");
const BRAIN_DIR = process.env.BRAIN_DIR || path.join(os.homedir(), "brain");
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");

export interface HermesWorkspace {
  id: string;
  name: string;
  emoji: string;
  path: string;
  agentName?: string;
  /** Optional brand icon (e.g. Claude's mark) to render instead of `emoji`. */
  iconUrl?: string;
}

/** Reads the first markdown heading of a SOUL.md and splits it into a short
 * display name and the full heading (e.g. "송선우 (宋善祐)" → short "송선우"). */
function extractPersonaName(soulPath: string): { short?: string; full?: string } {
  try {
    const content = fs.readFileSync(soulPath, "utf-8");
    const match = content.match(/^#\s+(.+)/m);
    if (!match) return {};
    const full = match[1].trim();
    const short = full.replace(/\s*\([^)]*\)\s*$/, "").trim() || full;
    return { short, full: full !== short ? full : undefined };
  } catch {
    return {};
  }
}

/** Discover the default profile (HERMES_DIR itself) plus every named profile under profiles/. */
export function listWorkspaces(): HermesWorkspace[] {
  const workspaces: HermesWorkspace[] = [];

  if (fs.existsSync(HERMES_DIR)) {
    workspaces.push({
      id: "default",
      name: "Default",
      emoji: "🪽",
      path: HERMES_DIR,
      agentName: extractPersonaName(path.join(HERMES_DIR, "SOUL.md")).full,
    });
  }

  if (fs.existsSync(PROFILES_DIR)) {
    for (const entry of fs.readdirSync(PROFILES_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const profilePath = path.join(PROFILES_DIR, entry.name);
      const persona = extractPersonaName(path.join(profilePath, "SOUL.md"));
      workspaces.push({
        id: `profiles/${entry.name}`,
        name: persona.short || entry.name.charAt(0).toUpperCase() + entry.name.slice(1),
        emoji: "🤖",
        path: profilePath,
        agentName: persona.full,
      });
    }
  }

  workspaces.sort((a, b) => {
    if (a.id === "default") return -1;
    if (b.id === "default") return 1;
    return a.name.localeCompare(b.name);
  });

  return workspaces;
}

/**
 * Workspaces for the general file browser: every Hermes profile plus ~/brain
 * and ~/.claude (separate, non-Hermes stores — not memory profiles, so
 * they're excluded from the Memory page's workspace list).
 */
export function listBrowseWorkspaces(): HermesWorkspace[] {
  const workspaces = listWorkspaces();
  if (fs.existsSync(BRAIN_DIR)) {
    workspaces.push({ id: "brain", name: "brain", emoji: "🧠", path: BRAIN_DIR });
  }
  if (fs.existsSync(CLAUDE_DIR)) {
    workspaces.push({ id: "claude", name: "claude", emoji: "📁", path: CLAUDE_DIR, iconUrl: "/claude.svg" });
  }
  return workspaces;
}

/**
 * Resolve a workspace id to its absolute directory path.
 * Only ids returned by listBrowseWorkspaces() resolve — anything else
 * (including traversal attempts) returns null.
 */
export function resolveWorkspacePath(workspaceId: string | null | undefined): string | null {
  const id = workspaceId || "default";
  const match = listBrowseWorkspaces().find((w) => w.id === id);
  return match ? match.path : null;
}
