import { NextResponse } from "next/server";

/** GET /api/simulation/state — Placeholder; live state is delivered via WebSocket. */
export async function GET() {
  return NextResponse.json({ status: "idle", message: "Use WebSocket for live state" });
}
