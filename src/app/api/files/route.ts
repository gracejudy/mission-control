import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { resolveWorkspacePath } from "@/lib/hermes-workspace";
import { listPersonaFiles, buildPersonaTree } from "@/lib/hermes-persona-files";

// Files to show in the memory browser
// Hermes keeps only SOUL.md at the profile root; MEMORY.md/USER.md live in memories/
// config.yaml holds the profile's permission settings (approvals, command_allowlist) — read-only here
const ROOT_FILES = ["SOUL.md", "config.yaml"];
const READONLY_FILES = ["config.yaml"];
// config.yaml is surfaced only under the default workspace in the UI
const DEFAULT_ONLY_FILES = ["config.yaml"];

function rootFilesFor(workspace: string): string[] {
  return ROOT_FILES.filter((f) => workspace === "default" || !DEFAULT_ONLY_FILES.includes(f));
}
const MEMORY_DIR = "memories";

interface FileNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileNode[];
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function getFileTree(workspacePath: string, workspace: string): Promise<FileNode[]> {
  const tree: FileNode[] = [];

  // Add root markdown files
  for (const file of rootFilesFor(workspace)) {
    const fullPath = path.join(workspacePath, file);
    if (await fileExists(fullPath)) {
      tree.push({
        name: file,
        path: file,
        type: "file",
      });
    }
  }

  // Add memory folder if it exists
  const memoryPath = path.join(workspacePath, MEMORY_DIR);
  if (await fileExists(memoryPath)) {
    const memoryStats = await fs.stat(memoryPath);
    if (memoryStats.isDirectory()) {
      const memoryFiles = await fs.readdir(memoryPath);
      const children: FileNode[] = [];

      for (const file of memoryFiles.sort().reverse()) {
        if (file.endsWith(".md")) {
          children.push({
            name: file,
            path: `${MEMORY_DIR}/${file}`,
            type: "file",
          });
        }
      }

      if (children.length > 0) {
        tree.push({
          name: MEMORY_DIR,
          path: MEMORY_DIR,
          type: "folder",
          children,
        });
      }
    }
  }

  // Character-setting files (config/, skills/roleplay/<persona skills>, ...) for persona profiles
  if (workspace !== "default") {
    tree.push(...buildPersonaTree(await listPersonaFiles(workspacePath)));
  }

  return tree;
}

async function sanitizePath(
  requestedPath: string,
  workspace: string,
  workspacePath: string
): Promise<string | null> {
  // Prevent directory traversal
  const normalized = path.normalize(requestedPath);
  if (normalized.startsWith("..") || path.isAbsolute(normalized)) {
    return null;
  }

  // Root files (SOUL.md, and the read-only config.yaml under default)
  if (rootFilesFor(workspace).includes(normalized)) return normalized;

  // Files in memories/
  if (normalized.endsWith(".md") && normalized.startsWith(`${MEMORY_DIR}/`)) return normalized;

  // Persona character-setting files: only ones that actually exist in the listing
  if (workspace !== "default" && (await listPersonaFiles(workspacePath)).includes(normalized)) {
    return normalized;
  }

  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workspace = searchParams.get("workspace") || "default";
  const filePath = searchParams.get("path");

  try {
    const workspacePath = resolveWorkspacePath(workspace);
    if (!workspacePath) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    if (!filePath) {
      // Return file tree
      const tree = await getFileTree(workspacePath, workspace);
      return NextResponse.json(tree);
    }

    // Read specific file
    const safePath = await sanitizePath(filePath, workspace, workspacePath);
    if (!safePath) {
      return NextResponse.json(
        { error: "Invalid file path" },
        { status: 400 }
      );
    }

    const fullPath = path.join(workspacePath, safePath);
    if (!(await fileExists(fullPath))) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    const content = await fs.readFile(fullPath, "utf-8");
    return NextResponse.json({ path: safePath, content });
  } catch (error) {
    console.error("Error reading file:", error);
    return NextResponse.json(
      { error: "Failed to read file" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace = "default", path: filePath, content } = body;

    if (!filePath || typeof content !== "string") {
      return NextResponse.json(
        { error: "Missing path or content" },
        { status: 400 }
      );
    }

    const workspacePath = resolveWorkspacePath(workspace);
    if (!workspacePath) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    const safePath = await sanitizePath(filePath, workspace, workspacePath);
    if (!safePath) {
      return NextResponse.json(
        { error: "Invalid file path" },
        { status: 400 }
      );
    }

    if (READONLY_FILES.includes(safePath)) {
      return NextResponse.json({ error: "Read-only file" }, { status: 403 });
    }

    // Hooks read config/*.json at runtime — never write something that doesn't parse
    if (safePath.endsWith(".json")) {
      try {
        JSON.parse(content);
      } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
      }
    }

    const fullPath = path.join(workspacePath, safePath);

    // Create memory directory if needed
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(fullPath, content, "utf-8");

    return NextResponse.json({ success: true, path: safePath });
  } catch (error) {
    console.error("Error saving file:", error);
    return NextResponse.json(
      { error: "Failed to save file" },
      { status: 500 }
    );
  }
}
