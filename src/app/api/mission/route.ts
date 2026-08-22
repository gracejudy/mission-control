import { NextResponse } from "next/server";
import { readMissionFile } from "@/lib/mission-file";

export async function GET() {
  try {
    const { content, lastModified } = await readMissionFile();
    return NextResponse.json({ content, lastModified });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
