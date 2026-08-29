"use client";

import { useState, useEffect } from "react";
import SettlementSummary from "./SettlementSummary";
import { SettlementMember } from "@/lib/settlement/transfers";
import { supabase } from "@/lib/supabase/client";
import SpendingStats from "./SpendingStats";
import CategoryPieChart from "./CategoryPieChart";

interface SettlementViewProps {
  tripId: string | null;
  currentUserName?: string;
}

interface Settlement {
  from: string;
  fromId?: string;
  to: string;
  toId?: string;
  amount: number;
}

export default function SettlementView({
  tripId,
  currentUserName,
}: SettlementViewProps) {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [currentMember, setCurrentMember] = useState<SettlementMember | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryData, setCategoryData] = useState<
    Array<{ category: string; amount: number; percentage: number }>
  >([]);

  useEffect(() => {
    if (!tripId) {
      setLoading(false);
      return;
    }

    const computeSettlement = async () => {
      setLoading(true);
      setError(null);
      setCurrentMember(null);
      try {
        // Get the current session token to pass to the API
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const authToken = session?.access_token || null;
        if (session?.user) {
          const { data: member } = await supabase
            .from("trip_members")
            .select("id, display_name")
            .eq("trip_id", tripId)
            .eq("user_id", session.user.id)
            .maybeSingle();
          const typedMember = member as {
            id: string;
            display_name: string;
          } | null;
          if (typedMember)
            setCurrentMember({
              id: typedMember.id,
              name: typedMember.display_name,
            });
        }

        const headers: HeadersInit = {};
        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`;
        }

        const [settlementResponse, statsResponse] = await Promise.all([
          fetch(`/api/settlement?tripId=${tripId}`, { headers }),
          fetch(
            `/api/trips/${tripId}/statistics${currentUserName ? `?userName=${encodeURIComponent(currentUserName)}` : ""}`,
          ),
        ]);

        if (!settlementResponse.ok) {
          throw new Error("Failed to compute settlement");
        }

        const { settlements } = await settlementResponse.json();
        setSettlements(settlements);

        // Load category data for chart
        if (statsResponse.ok) {
          const { statistics } = await statsResponse.json();
          if (statistics?.categoryBreakdown) {
            setCategoryData(statistics.categoryBreakdown);
          }
        }
      } catch (error) {
        console.error("Error computing settlement:", error);
        setError("Check your connection and try opening this page again.");
      } finally {
        setLoading(false);
      }
    };

    computeSettlement();
  }, [tripId, currentUserName]);

  return (
    <>
      <SettlementSummary
        settlements={settlements}
        currentMember={currentMember}
        tripId={tripId}
        loading={loading}
        error={error}
        hasTrip={!!tripId}
      />
      {!loading && !error && tripId && settlements.length > 0 && (
        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <SpendingStats tripId={tripId} currentUserName={currentUserName} />
          {categoryData.length > 0 && <CategoryPieChart data={categoryData} />}
        </div>
      )}
    </>
  );
}
