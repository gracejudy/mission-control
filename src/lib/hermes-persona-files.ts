/**
 * Character-setting files of a non-default Hermes profile, surfaced in the Memory page.
 *
 * Beyond SOUL.md and memories/, a persona profile defines its character through:
 *   config/*.json            — mode triggers, night-mode material, allowed audio tags
 *   state/episodes_README.md — episode unlock rules
 *   skills/roleplay/<skill>/ — persona skills (SKILL.md + references/*.md)
 *
 * Only an explicit allowlist of persona skills is exposed (not the bundled/dev skills
 * that live next to them), and only files that actually exist are listed.
 */
import { promises as fs } from "fs";
import path from "path";

const PERSONA_SKILLS = [
  "songseonwoo-conversation",
  "songseonwoo-gifts",
  "tarot",
  "network-report",
  "say",
  "vedic-astrology",
];

async function walk(dir: string, rel: string, exts: string[], out: string[]): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith(".") || e.name === "__pycache__") continue;
    const childRel = `${rel}/${e.name}`;
    if (e.isDirectory()) await walk(path.join(dir, e.name), childRel, exts, out);
    else if (e.isFile() && exts.some((x) => e.name.endsWith(x))) out.push(childRel);
  }
}

/** Relative paths (posix-style) of the persona files that exist under a profile. */
export async function listPersonaFiles(workspacePath: string): Promise<string[]> {
  const out: string[] = [];
  await walk(path.join(workspacePath, "config"), "config", [".json"], out);
  try {
    await fs.access(path.join(workspacePath, "state", "episodes_README.md"));
    out.push("state/episodes_README.md");
  } catch {}
  for (const skill of PERSONA_SKILLS) {
    const rel = `skills/roleplay/${skill}`;
    await walk(path.join(workspacePath, rel), rel, [".md"], out);
  }
  return out.sort();
}

export interface PersonaNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: PersonaNode[];
}

/** Nest flat relative paths into folder/file nodes. */
export function buildPersonaTree(relPaths: string[]): PersonaNode[] {
  const root: PersonaNode[] = [];
  for (const rel of relPaths) {
    const parts = rel.split("/");
    let level = root;
    parts.forEach((name, i) => {
      const p = parts.slice(0, i + 1).join("/");
      const isFile = i === parts.length - 1;
      let node = level.find((n) => n.path === p);
      if (!node) {
        node = isFile ? { name, path: p, type: "file" } : { name, path: p, type: "folder", children: [] };
        level.push(node);
      }
      if (!isFile) level = node.children!;
    });
  }
  return root;
}
