import { NextResponse } from "next/server";

const MISSION_CONTROL_URL =
  "https://raw.githubusercontent.com/gracejudy/judy-brain/main/MISSION-CONTROL.md";

export async function GET() {
  try {
    const res = await fetch(MISSION_CONTROL_URL, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `GitHub fetch failed: ${res.status} ${res.statusText}` },
        { status: 502 }
      );
    }

    const content = await res.text();
    const lastModified = res.headers.get("last-modified") ?? null;

    return NextResponse.json({ content, lastModified });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
