"use client";

import { useEffect, useState } from "react";
import StatCard from "./StatCard";
import CategoryPieChart from "./CategoryPieChart";
import { supabase } from "@/lib/supabase/client";
import type { TripStatistics } from "@/lib/statistics/calculate";

interface SpendingStatsProps {
  tripId: string | null;
  onPersonalTotals?: (totals: { paid: number; spent: number } | null) => void;
}

export default function SpendingStats({
  tripId,
  onPersonalTotals,
}: SpendingStatsProps) {
  const [stats, setStats] = useState<TripStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setStats(null);
    setError(null);
    onPersonalTotals?.(null);
    if (!tripId) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);

    const fetchStats = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (controller.signal.aborted) return;
        if (!session) throw new Error("Sign in to view statistics.");
        const response = await fetch(`/api/trips/${tripId}/statistics`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(
            body?.error || "Couldn’t load statistics. Please try again.",
          );
        }
        const { statistics } = await response.json();
        if (!controller.signal.aborted) {
          setStats(statistics);
          onPersonalTotals?.({
            paid: statistics.userPaid,
            spent: statistics.userSpent,
          });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(
            error instanceof Error
              ? error.message
              : "Couldn’t load statistics. Please try again.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchStats();
    return () => controller.abort();
  }, [tripId, attempt, onPersonalTotals]);

  if (!tripId) return null;

  return (
    <div className="space-y-6">
      <section
        className="panel min-h-[252px] min-w-0 p-5"
        aria-label="Statistics"
      >
        <h2 className="mb-4 text-[1rem] font-semibold text-accent">
          Statistics
        </h2>
        {loading ? (
          <div
            className="flex min-h-40 items-center justify-center"
            role="status"
            aria-label="Loading statistics"
          >
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-success border-t-transparent" />
          </div>
        ) : error ? (
          <div>
            <p role="alert" className="muted">
              {error}
            </p>
            <button
              type="button"
              className="mt-4 min-h-11 underline"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Try again
            </button>
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total Spent" value={stats.totalSpent} isCurrency />
            <StatCard label="Transactions" value={stats.transactionCount} />
            <StatCard
              label="Average"
              value={stats.averagePerTransaction}
              isCurrency
            />
            <StatCard
              label="You’ve paid for"
              value={stats.userPaid}
              isCurrency
            />
          </div>
        ) : null}
      </section>
      {!loading && !error && stats && stats.categoryBreakdown.length > 0 && (
        <CategoryPieChart data={stats.categoryBreakdown} />
      )}
    </div>
  );
}
