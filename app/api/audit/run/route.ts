import { type NextRequest, NextResponse } from "next/server";
import { runAudit } from "@/lib/audit/run";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // seconds

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const rsid = searchParams.get("rsid");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!rsid) {
    return NextResponse.json({ error: "rsid is required" }, { status: 400 });
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const dateRange = {
    startDate: startDate ?? thirtyDaysAgo.toISOString().slice(0, 10),
    endDate: endDate ?? now.toISOString().slice(0, 10),
  };

  try {
    const scoreboard = await runAudit(rsid, dateRange);
    return NextResponse.json(scoreboard);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
