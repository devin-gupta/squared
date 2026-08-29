"use client";

import { useState, useEffect } from "react";
import AuthGuard from "@/components/AuthGuard";
import SettlementView from "@/components/SettlementView";

export default function SettlePage() {
  const [tripId, setTripId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  useEffect(() => {
    const storedTripId = localStorage.getItem("tripId");
    const storedUser = localStorage.getItem("currentUser");
    if (storedTripId) {
      setTripId(storedTripId);
    }
    if (storedUser) {
      setCurrentUser(storedUser);
    }
  }, []);

  return (
    <AuthGuard>
      <SettlementView
        tripId={tripId}
        currentUserName={currentUser || undefined}
      />
    </AuthGuard>
  );
}
