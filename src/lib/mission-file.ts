import { readFile, stat } from "fs/promises";
import os from "os";
import path from "path";

export const MISSION_FILE =
  process.env.MISSION_FILE_PATH ||
  path.join(os.homedir(), "dev/judy-brain/MISSION-CONTROL.md");

export interface MissionFileData {
  content: string;
  lastModified: string; // mtime, ISO 8601
}

export async function readMissionFile(): Promise<MissionFileData> {
  const [content, fileStat] = await Promise.all([
    readFile(MISSION_FILE, "utf-8"),
    stat(MISSION_FILE),
  ]);
  return { content, lastModified: fileStat.mtime.toISOString() };
}
