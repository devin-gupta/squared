"use client";

import { useRealtimeTransactions } from "@/hooks/useRealtimeTransactions";
import TripHeader, { TripHeaderProps } from "./TripHeader";
import { personalSpending } from "@/lib/statistics/personal";
import TripDashboard, { DashboardProps } from "./TripDashboard";

export default function ConnectedDashboard({
  tripId,
  header,
  ...props
}: Omit<DashboardProps, "transactions" | "loading" | "error" | "onRetry"> & {
  tripId: string | null;
  header?: Omit<TripHeaderProps, "mobileSummary">;
}) {
  const { transactions, loading, error, refetch } =
    useRealtimeTransactions(tripId);
  const personal = personalSpending(
    transactions,
    props.members,
    props.currentMemberId || null,
  );
  return (
    <>
      {header && (
        <TripHeader
          {...header}
          mobileSummary={{
            total:
              loading || error
                ? null
                : transactions.reduce(
                    (sum, tx) => sum + Number(tx.total_amount),
                    0,
                  ),
            balance: loading || error ? null : (personal?.balance ?? null),
          }}
        />
      )}
      <TripDashboard
        {...props}
        onSubmit={async (text, image) => {
          const result = await props.onSubmit(text, image);
          // Refresh after a confirmed save even when realtime is delayed.
          if (result?.status === "saved") void refetch();
          return result;
        }}
        transactions={transactions}
        loading={loading}
        error={error}
        onRetry={refetch}
      />
    </>
  );
}
