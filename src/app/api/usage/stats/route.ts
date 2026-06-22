/**
 * /api/usage/stats — Server-side usage metrics endpoint.
 * Queries Supabase usage_logs + document_chunks with the service role key.
 */

import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  getSessionUser,
  isSupabaseConfigured,
} from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  "claude-haiku-4-5-20251001": "Lex Core",
  "claude-sonnet-4-6": "Lex Pro",
  "claude-opus-4-8": "Lex Ultra",
  "claude-fable-5": "Lex Max",
};

function formatResponseTime(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

export async function GET(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      totalThisMonth: 0,
      totalToday: 0,
      avgResponseTime: "—",
      mostUsedModel: "—",
      mostQueriedJurisdiction: "—",
      documentsUploaded: 0,
    });
  }

  // Authenticate
  let userId: string | null = null;
  const authHeader = req.headers.get("authorization");

  const user = await getSessionUser(authHeader);
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  userId = user.id;

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({
      totalThisMonth: 0,
      totalToday: 0,
      avgResponseTime: "—",
      mostUsedModel: "—",
      mostQueriedJurisdiction: "—",
      documentsUploaded: 0,
    });
  }

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    // Run queries in parallel
    const [monthResult, todayResult, logsResult, docsResult] = await Promise.all([
      // Queries this month
      supabase
        .from("usage_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", monthStart),

      // Queries today
      supabase
        .from("usage_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", todayStart),

      // Recent logs for model/jurisdiction/response time aggregation
      supabase
        .from("usage_logs")
        .select("model, response_time_ms, jurisdiction")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100),

      // Documents uploaded — count distinct document names
      supabase
        .from("document_chunks")
        .select("document_name")
        .eq("user_id", userId),
    ]);

    const logs = logsResult.data || [];

    // Avg response time
    const responseTimes = logs
      .map((l) => l.response_time_ms)
      .filter((t): t is number => typeof t === "number" && t > 0);
    const avgMs =
      responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0;

    // Most used model
    const modelCounts: Record<string, number> = {};
    for (const l of logs) {
      if (l.model) modelCounts[l.model] = (modelCounts[l.model] || 0) + 1;
    }
    const topModelId =
      Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    const topModel = MODEL_DISPLAY_NAMES[topModelId] || topModelId || "—";

    // Top jurisdiction
    const jurCounts: Record<string, number> = {};
    for (const l of logs) {
      if (l.jurisdiction) jurCounts[l.jurisdiction] = (jurCounts[l.jurisdiction] || 0) + 1;
    }
    const topJur =
      Object.entries(jurCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

    // Documents uploaded (distinct names)
    const docNames = new Set(
      (docsResult.data || []).map((d) => d.document_name).filter(Boolean)
    );

    return NextResponse.json({
      totalThisMonth: monthResult.count || 0,
      totalToday: todayResult.count || 0,
      avgResponseTime: avgMs > 0 ? formatResponseTime(avgMs) : "—",
      mostUsedModel: topModel,
      mostQueriedJurisdiction: topJur,
      documentsUploaded: docNames.size,
    });
  } catch (error) {
    console.error("[Usage Stats] Error:", error);
    return NextResponse.json({
      totalThisMonth: 0,
      totalToday: 0,
      avgResponseTime: "—",
      mostUsedModel: "—",
      mostQueriedJurisdiction: "—",
      documentsUploaded: 0,
    });
  }
}
