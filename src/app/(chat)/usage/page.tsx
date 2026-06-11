"use client";

import { useEffect, useState, useCallback } from "react";
import { isSupabaseConfigured } from "@/lib/supabase";
import { createBrowserSupabaseClient } from "@/lib/supabase";

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
    const emptyMetrics: UsageMetrics = {
      totalThisMonth: 0,
      totalToday: 0,
      avgResponseTime: "—",
      mostUsedModel: "—",
      mostQueriedJurisdiction: "—",
      documentsUploaded: 0,
    };

    if (!isSupabaseConfigured()) {
      setMetrics(emptyMetrics);
      setLoading(false);
      return;
    }

    try {
      const headers: Record<string, string> = {};
      const supabase = createBrowserSupabaseClient();
      if (supabase) {
        const session = (await supabase.auth.getSession()).data.session;
        if (session?.access_token) {
          headers["Authorization"] = `Bearer ${session.access_token}`;
        }
      }

      const response = await fetch("/api/usage/stats", { headers });
      if (!response.ok) {
        setMetrics(emptyMetrics);
        setLoading(false);
        return;
      }

      const data: UsageMetrics = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error("[Usage] Failed to fetch metrics:", error);
      setMetrics({
        totalThisMonth: 0,
        totalToday: 0,
        avgResponseTime: "—",
        mostUsedModel: "—",
        mostQueriedJurisdiction: "—",
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
