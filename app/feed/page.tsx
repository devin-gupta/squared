"use client";

import { useState, useEffect } from "react";
import AuthGuard from "@/components/AuthGuard";
import LiveFeed from "@/components/LiveFeed";

export default function FeedPage() {
  const [tripId, setTripId] = useState<string | null>(null);

  useEffect(() => {
    const storedTripId = localStorage.getItem("tripId");
    if (storedTripId) {
      setTripId(storedTripId);
    }
  }, []);

  return (
    <AuthGuard>
      <LiveFeed tripId={tripId} />
    </AuthGuard>
  );
}
