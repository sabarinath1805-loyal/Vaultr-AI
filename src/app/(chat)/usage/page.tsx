"use client";

import { useEffect, useState, useCallback } from "react";
import { isSupabaseConfigured } from "@/lib/supabase";

interface UsageMetrics {
  totalThisMonth: number;
  totalToday: number;
  avgResponseTime: string;
  mostUsedModel: string;
  mostQueriedJurisdiction: string;
  documentsUploaded: number;
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-5 shadow-sm">
      <div className="text-[12px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
        {label}
      </div>
      <div className="mt-2 text-[28px] font-semibold tabular-nums text-[var(--text)]">
        {value}
      </div>
    </div>
  );
}

export default function UsagePage() {
  const [metrics, setMetrics] = useState<UsageMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUsage = useCallback(async () => {
    const localPlaceholder: UsageMetrics = {
      totalThisMonth: 0,
      totalToday: 0,
      avgResponseTime: "Local",
      mostUsedModel: "Lex Pro",
      mostQueriedJurisdiction: "SG",
      documentsUploaded: 0,
    };

    if (!isSupabaseConfigured()) {
      setMetrics(localPlaceholder);
      setLoading(false);
      return;
    }

    try {
      const { createBrowserSupabaseClient } = await import("@/lib/supabase");
      const supabase = createBrowserSupabaseClient();
      if (!supabase) throw new Error("Supabase not configured");
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setMetrics(localPlaceholder);
        setLoading(false);
        return;
      }

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      const { count: monthCount } = await supabase
        .from("usage_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", monthStart);

      const { count: todayCount } = await supabase
        .from("usage_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", todayStart);

      const { data: recentLogs } = await supabase
        .from("usage_logs")
        .select("model, response_time_ms, jurisdiction")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      const logs = recentLogs || [];
      const responseTimes = logs
        .map((l) => l.response_time_ms)
        .filter((t): t is number => typeof t === "number" && t > 0);
      const avgMs = responseTimes.length > 0
        ? Math.round(responseTimes.slice(0, 10).reduce((a, b) => a + b, 0) / Math.min(10, responseTimes.length))
        : 0;

      const modelCounts: Record<string, number> = {};
      logs.forEach((l) => {
        if (l.model) modelCounts[l.model] = (modelCounts[l.model] || 0) + 1;
      });
      const topModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

      const jurCounts: Record<string, number> = {};
      logs.forEach((l) => {
        if (l.jurisdiction) jurCounts[l.jurisdiction] = (jurCounts[l.jurisdiction] || 0) + 1;
      });
      const topJur = Object.entries(jurCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

      setMetrics({
        totalThisMonth: monthCount || 0,
        totalToday: todayCount || 0,
        avgResponseTime: avgMs > 0 ? `${(avgMs / 1000).toFixed(1)}s` : "—",
        mostUsedModel: topModel,
        mostQueriedJurisdiction: topJur,
        documentsUploaded: 0,
      });
    } catch (error) {
      console.error("[Usage] Failed to fetch metrics:", error);
      setMetrics({
        totalThisMonth: 0,
        totalToday: 0,
        avgResponseTime: "?",
        mostUsedModel: "?",
        mostQueriedJurisdiction: "?",
        documentsUploaded: 0,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-[24px] font-semibold text-[var(--text)]">Usage</h1>
      <p className="mt-1 text-[13px] text-[var(--text-muted)]">
        Your query statistics and usage metrics.
      </p>

      {loading ? (
        <div className="mt-10 text-center text-[13px] text-[var(--text-muted)]">
          Loading usage data...
        </div>
      ) : metrics ? (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard label="Queries this month" value={metrics.totalThisMonth} />
          <MetricCard label="Queries today" value={metrics.totalToday} />
          <MetricCard label="Avg response time" value={metrics.avgResponseTime} />
          <MetricCard label="Most used model" value={metrics.mostUsedModel} />
          <MetricCard label="Top jurisdiction" value={metrics.mostQueriedJurisdiction} />
          <MetricCard label="Documents uploaded" value={metrics.documentsUploaded} />
        </div>
      ) : (
        <div className="mt-10 text-center text-[13px] text-[var(--text-muted)]">
          No usage data available.
        </div>
      )}
    </div>
  );
}
