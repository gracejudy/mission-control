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

export interface HermesWorkspace {
  id: string;
  name: string;
  emoji: string;
  path: string;
  agentName?: string;
}

function extractPersonaName(soulPath: string): string | undefined {
  try {
    const content = fs.readFileSync(soulPath, "utf-8");
    const match = content.match(/^#\s+(.+)/m);
    return match ? match[1].trim() : undefined;
  } catch {
    return undefined;
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
      agentName: extractPersonaName(path.join(HERMES_DIR, "SOUL.md")),
    });
  }

  if (fs.existsSync(PROFILES_DIR)) {
    for (const entry of fs.readdirSync(PROFILES_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const profilePath = path.join(PROFILES_DIR, entry.name);
      workspaces.push({
        id: `profiles/${entry.name}`,
        name: entry.name.charAt(0).toUpperCase() + entry.name.slice(1),
        emoji: "🤖",
        path: profilePath,
        agentName: extractPersonaName(path.join(profilePath, "SOUL.md")),
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
 * Resolve a workspace id to its absolute directory path.
 * Only ids returned by listWorkspaces() resolve — anything else (including
 * traversal attempts) returns null.
 */
export function resolveWorkspacePath(workspaceId: string | null | undefined): string | null {
  const id = workspaceId || "default";
  const match = listWorkspaces().find((w) => w.id === id);
  return match ? match.path : null;
}
