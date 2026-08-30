"use client";

import { useState, useEffect } from "react";
import SettlementSummary from "./SettlementSummary";
import { SettlementMember } from "@/lib/settlement/transfers";
import { supabase } from "@/lib/supabase/client";
import SpendingStats from "./SpendingStats";

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

        const settlementResponse = await fetch(
          `/api/settlement?tripId=${tripId}`,
          { headers },
        );

        if (!settlementResponse.ok) {
          throw new Error("Failed to compute settlement");
        }

        const { settlements } = await settlementResponse.json();
        setSettlements(settlements);
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
        statistics={
          tripId ? <SpendingStats key={tripId} tripId={tripId} /> : null
        }
      />
    </>
  );
}
