"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ConnectedDashboard from "@/components/ConnectedDashboard";
import Icon from "@/components/Icon";
import ManualTransactionForm from "@/components/ManualTransactionForm";
import StartTripModal from "@/components/StartTripModal";
import ShareTripModal from "@/components/ShareTripModal";
import MemberListModal from "@/components/MemberListModal";
import DeleteTripModal from "@/components/DeleteTripModal";
import TransactionEditForm from "@/components/TransactionEditForm";
import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/hooks/useAuth";
import { createTrip } from "@/lib/trips/create";
import { joinTrip } from "@/lib/trips/join";
import { listTrips } from "@/lib/trips/list";
import { useAIParser } from "@/hooks/useAIParser";
import { createTransaction } from "@/lib/transactions/create";
import { TransactionParsed, LineItem } from "@/types/transaction";
import type {
  ExpenseEntryProgress,
  ExpenseEntryResult,
} from "@/lib/transactions/entry";
import { Transaction } from "@/types/transaction";
import { Trip, TripMember } from "@/types/trip";
import { supabase } from "@/lib/supabase/client";
import UndoToast from "@/components/UndoToast";
import { removeMember } from "@/lib/trips/removeMember";
import {
  normalizeInvite,
  rememberInvite,
  pendingInvite,
  forgetInvite,
  preferredTrip,
  rememberTrip,
  writePreference,
} from "@/lib/auth/preferences";

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [entryProgress, setEntryProgress] =
    useState<ExpenseEntryProgress | null>(null);
  const [tripId, setTripId] = useState<string | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [memberNames, setMemberNames] = useState<string[]>([]);
  const [showManualForm, setShowManualForm] = useState(false);
  const [showStartTripModal, setShowStartTripModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTripError, setDeleteTripError] = useState<string | null>(null);
  const [pendingParsed, setPendingParsed] = useState<TransactionParsed | null>(
    null,
  );
  const [pendingReceiptUrl, setPendingReceiptUrl] = useState<string | null>(
    null,
  );
  const [undoState, setUndoState] = useState<{
    type: "transaction" | "member";
    itemId: string;
    message: string;
  } | null>(null);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [dashboardRevision, setDashboardRevision] = useState(0);
  const [isLoadingTrip, setIsLoadingTrip] = useState(true);

  const [tripLoadError, setTripLoadError] = useState<string | null>(null);
  const [activeInvite, setActiveInvite] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const accountId = user.id;
    const displayName =
      user.user_metadata?.display_name ||
      user.email?.split("@")[0] ||
      "Traveler";
    const rawInvite = searchParams.get("code");
    const invite = searchParams.has("code")
      ? normalizeInvite(rawInvite)
      : pendingInvite();
    setActiveInvite(searchParams.has("code") ? rawInvite || "invalid" : invite);
    setIsLoadingTrip(true);
    setTripLoadError(null);

    const restoreTrip = async () => {
      try {
        if (searchParams.has("code") && !invite)
          throw new Error(
            "This invite is incomplete. Ask your friend for a fresh invite link.",
          );
        if (invite) rememberInvite(invite);
        // Invite intent always takes priority over a previously selected trip.
        const joinedId = invite
          ? await joinTrip(invite, displayName, accountId)
          : null;
        const availableTrips = await listTrips(undefined, accountId);
        if (cancelled) return;
        setTrips(availableTrips);
        const storedId = preferredTrip(accountId);
        const selectedId =
          joinedId ||
          availableTrips.find((t) => t.id === storedId)?.id ||
          availableTrips[0]?.id;
        if (selectedId) {
          const loadedMembers = await loadTripData(
            selectedId,
            () => !cancelled,
          );
          if (cancelled) return;
          const memberName =
            loadedMembers.find((m) => m.user_id === accountId)?.display_name ||
            displayName;
          setTripId(selectedId);
          setCurrentUser(memberName);
          rememberTrip(accountId, selectedId, memberName);
        } else {
          setTripId(null);
          setTrip(null);
          setMembers([]);
          setMemberNames([]);
          setCurrentUser(displayName);
          writePreference("tripId", null);
        }
        if (invite) {
          forgetInvite(invite);
          setActiveInvite(null);
          if (searchParams.has("code")) router.replace("/");
        }
      } catch (error) {
        if (!cancelled)
          setTripLoadError(
            error instanceof Error
              ? error.message
              : "We couldn’t open your trip. Please try again.",
          );
      } finally {
        if (!cancelled) setIsLoadingTrip(false);
      }
    };
    void restoreTrip();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.email, searchParams, router, loadAttempt]);

  const loadTrips = async (userName?: string, userId?: string) => {
    try {
      const userTrips = await listTrips(userName, userId);
      setTrips(userTrips);
    } catch (error) {
      console.error("Error loading trips:", error);
    }
  };

  const loadTripData = async (
    selectedId: string,
    shouldApply = () => true,
  ): Promise<TripMember[]> => {
    const [tripResult, membersResult] = await Promise.all([
      supabase.from("trips").select("*").eq("id", selectedId).single(),
      supabase
        .from("trip_members")
        .select("id, display_name, user_id")
        .eq("trip_id", selectedId),
    ]);
    const loadedTrip = tripResult.data as Trip | null;
    if (tripResult.error || !loadedTrip || membersResult.error)
      throw new Error(
        "We couldn’t load your trip. Check your connection and try again.",
      );
    const loadedMembers = (membersResult.data || []) as TripMember[];
    if (shouldApply()) {
      setTrip(loadedTrip);
      setMembers(loadedMembers);
      setMemberNames(loadedMembers.map((m) => m.display_name));
    }
    return loadedMembers;
  };

  const loadMembers = async (tripId: string) => {
    const { data: membersData } = await supabase
      .from("trip_members")
      .select("id, display_name, user_id")
      .eq("trip_id", tripId);

    if (membersData) {
      setMembers(membersData as TripMember[]);
      setMemberNames(
        membersData.map((m: { display_name: string }) => m.display_name),
      );
    }
  };

  const {
    parseText,
    parseReceipt,
    isLoading: aiLoading,
  } = useAIParser({ tripId });

  const saveTransaction = async (
    parsed: TransactionParsed,
    receiptUrl: string | null,
  ): Promise<ExpenseEntryResult> => {
    if (!tripId) throw new Error("Choose a trip before saving this expense.");

    try {
      const result = await createTransaction(
        tripId,
        parsed,
        receiptUrl,
        currentUser,
      );

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }

      // Show undo toast - check if member was added
      if (result.addedMember) {
        setUndoState({
          type: "member",
          itemId: result.addedMember.id,
          message: `${result.addedMember.name} added to trip`,
        });
      } else {
        setUndoState({
          type: "transaction",
          itemId: result.transactionId,
          message: "Transaction added",
        });
      }

      // Refreshing the UI must not turn an already-committed expense into a failed save.
      await loadMembers(tripId).catch(() => undefined);

      // Reset state
      setPendingParsed(null);
      setPendingReceiptUrl(null);
      setShowManualForm(false);
      return {
        status: "saved",
        description: parsed.description,
        amount: result.totalAmount,
      };
    } catch (error) {
      throw error instanceof Error
        ? error
        : new Error("Couldn’t save this expense. Please try again.");
    }
  };

  const handleUndo = async () => {
    if (!undoState) return;

    try {
      if (undoState.type === "transaction") {
        const response = await fetch(`/api/transactions/${undoState.itemId}`, {
          method: "DELETE",
        });

        if (response.ok) {
          setUndoState(null);
          if (navigator.vibrate) {
            navigator.vibrate(50);
          }
        }
      } else if (undoState.type === "member") {
        if (!tripId) return;
        await removeMember(tripId, undoState.itemId);
        await loadMembers(tripId);
        setUndoState(null);
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      }
    } catch (error) {
      console.error("Error undoing:", error);
    }
  };

  const handleStartTrip = async (tripName: string, userName: string) => {
    if (!user) {
      alert("Authentication required");
      return;
    }

    try {
      const { tripId: newTripId, inviteCode } = await createTrip(
        userName,
        tripName,
        user.id,
      );
      rememberTrip(user.id, newTripId, userName);
      setTripId(newTripId);
      setCurrentUser(userName);
      await loadTripData(newTripId);
      await loadTrips(userName, user.id);
      setShowStartTripModal(false);
    } catch (error) {
      console.error("Error creating trip:", error);
      alert(error instanceof Error ? error.message : "Failed to create trip");
    }
  };

  const handleSwitchTrip = async (newTripId: string) => {
    if (!user) return;
    try {
      const loadedMembers = await loadTripData(newTripId);
      const memberName =
        loadedMembers.find((m) => m.user_id === user.id)?.display_name ||
        currentUser ||
        "Traveler";
      rememberTrip(user.id, newTripId, memberName);
      setTripId(newTripId);
      setCurrentUser(memberName);
    } catch {
      setTripLoadError("We couldn’t switch trips. Please try again.");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!tripId) throw new Error("Choose a trip before removing a member.");
    const leaving =
      members.find((member) => member.id === memberId)?.user_id === user?.id;
    await removeMember(tripId, memberId);
    // The server confirmed deletion. Update locally so a failed follow-up read
    // cannot report an already-completed removal as a failure.
    setMembers((current) => current.filter((member) => member.id !== memberId));
    setMemberNames(
      members
        .filter((member) => member.id !== memberId)
        .map((member) => member.display_name),
    );
    setDashboardRevision((value) => value + 1);
    if (leaving) {
      setShowMemberModal(false);
      setTripId(null);
      setTrip(null);
      writePreference("tripId", null);
      if (user) writePreference(`squared:lastTrip:${user.id}`, null);
      setLoadAttempt((value) => value + 1);
    }
  };

  const handleDeleteTrip = async () => {
    if (!tripId || !trip || isDeleting) return;

    setDeleteTripError(null);
    setIsDeleting(true);
    try {
      // Get auth token from Supabase session
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Authentication required");
      }

      const response = await fetch(`/api/trips/${tripId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success !== true) {
        throw new Error(
          result?.error || "Couldn’t delete this trip. Please try again.",
        );
      }

      // Clear trip state and redirect
      writePreference("tripId", null);
      if (user) writePreference(`squared:lastTrip:${user.id}`, null);
      setTripId(null);
      setTrip(null);
      setTrips(trips.filter((t) => t.id !== tripId));
      setShowDeleteModal(false);
    } catch (error) {
      console.error("Error deleting trip:", error);
      setDeleteTripError(
        error instanceof Error
          ? error.message
          : "Couldn’t delete this trip. Please try again.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditTransaction = async (
    data: Partial<Transaction> & {
      lineItems?: LineItem[];
      adjustments?: Array<{ memberId: string; amount: number }>;
    },
  ) => {
    if (!editingTransaction) return;

    try {
      // Get auth token from Supabase session
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Authentication required");
      }

      const response = await fetch(
        `/api/transactions/${editingTransaction.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            description: data.description,
            totalAmount: data.total_amount,
            payerId: data.payer_id,
            splitType: data.split_type,
            category: data.category,
            lineItems: data.lineItems,
            adjustments: data.adjustments,
          }),
        },
      );

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || "Failed to update transaction");
      }

      setEditingTransaction(null);
      setDashboardRevision((v) => v + 1);
    } catch (error) {
      console.error("Error updating transaction:", error);
      throw error;
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    try {
      // Get auth token from Supabase session
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Authentication required");
      }

      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete transaction");
      }
      setEditingTransaction(null);
      setDashboardRevision((v) => v + 1);
    } catch (error) {
      console.error("Error deleting transaction:", error);
      throw error;
    }
  };

  const handleSubmit = async (
    text: string,
    imageFile?: File,
  ): Promise<ExpenseEntryResult> => {
    if (!tripId || !currentUser)
      throw new Error("Choose a trip before adding an expense.");
    setIsProcessing(true);
    setEntryProgress({
      stage: "reading",
      kind: imageFile ? "receipt" : "text",
    });
    setPendingParsed(null);
    setPendingReceiptUrl(null);
    try {
      const result = imageFile
        ? await parseReceipt(imageFile, text)
        : { parsed: await parseText(text), receiptUrl: null };
      const parsed = result.parsed;
      if (!parsed)
        throw new Error("Describe the expense or attach a receipt first.");
      setPendingParsed(parsed);
      setPendingReceiptUrl(result.receiptUrl);
      if (
        imageFile ||
        parsed.review_note ||
        !(parsed.total_amount > 0) ||
        !parsed.description ||
        (parsed.currency && parsed.currency !== "USD")
      ) {
        setShowManualForm(true);
        return { status: "review" };
      }
      setEntryProgress({
        stage: "saving",
        kind: imageFile ? "receipt" : "text",
      });
      return await saveTransaction(parsed, result.receiptUrl);
    } finally {
      setIsProcessing(false);
      setEntryProgress(null);
    }
  };

  const handleManualSubmit = async (data: TransactionParsed) => {
    await saveTransaction(data, pendingReceiptUrl);
  };

  if (showManualForm) {
    return (
      <ManualTransactionForm
        tripId={tripId}
        initialData={pendingParsed || undefined}
        memberNames={memberNames}
        onSubmit={handleManualSubmit}
        onCancel={() => {
          setShowManualForm(false);
          setPendingParsed(null);
          setPendingReceiptUrl(null);
        }}
      />
    );
  }

  if (isLoadingTrip) {
    return (
      <div
        role="status"
        className="min-h-[60vh] flex items-center justify-center gap-3 muted"
      >
        <span className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        {activeInvite
          ? "Opening your invited trip…"
          : "Picking up where you left off…"}
      </div>
    );
  }

  if (tripLoadError)
    return (
      <section className="empty-state" role="alert">
        <span className="icon-tile">
          <Icon name="travel" />
        </span>
        <h1 className="font-serif text-3xl">
          {activeInvite
            ? "Let’s get you into this trip."
            : "We couldn’t open your trips."}
        </h1>
        <p className="muted max-w-md">{tripLoadError}</p>
        <button
          className="btn-primary"
          onClick={() => setLoadAttempt((n) => n + 1)}
        >
          Try again
        </button>
        {activeInvite && (
          <button
            className="btn-secondary"
            onClick={() => {
              forgetInvite();
              window.location.assign("/");
            }}
          >
            Leave this invite
          </button>
        )}
      </section>
    );

  return (
    <div>
      {trip ? (
        <>
          <ConnectedDashboard
            header={{
              trip,
              members,
              trips,
              onShare: () => setShowShareModal(true),
              onSwitchTrip: handleSwitchTrip,
              onCreateTrip: () => setShowStartTripModal(true),
              onViewMembers: () => setShowMemberModal(true),
              onDelete: () => {
                setDeleteTripError(null);
                setShowDeleteModal(true);
              },
              isCreator: user
                ? members.find((m) => m.user_id === user.id)?.display_name ===
                  trip.created_by
                : false,
            }}
            key={`${tripId}:${dashboardRevision}`}
            currentMemberId={
              members.find((m) => m.user_id === user?.id)?.id || null
            }
            tripId={tripId}
            members={members}
            onSubmit={handleSubmit}
            onManual={(draft) => {
              setPendingParsed(
                (current) =>
                  current || {
                    description: draft || "",
                    total_amount: 0,
                    split_type: "equal",
                    payer_name: currentUser || undefined,
                  },
              );
              setShowManualForm(true);
            }}
            progress={entryProgress}
            isProcessing={isProcessing || aiLoading}
            onEdit={setEditingTransaction}
            onDelete={handleDeleteTransaction}
          />
        </>
      ) : (
        <div className="min-h-[70vh] flex flex-col items-center justify-center px-6">
          <div className="text-center mb-8">
            <span className="icon-tile mx-auto mb-6 h-16 w-16">
              <Icon name="travel" width="28" height="28" />
            </span>
            <p className="eyebrow mb-3">A fresh start</p>
            <h1 className="page-title mb-4">Where are we off to?</h1>
            <p className="muted max-w-sm mb-8">
              Create a trip, bring your people, and keep every shared expense in
              one place.
            </p>
            <button
              onClick={() => setShowStartTripModal(true)}
              className="btn-primary"
            >
              <Icon name="plus" width="17" /> Create your first trip
            </button>
            {trips.length > 0 && (
              <div className="mt-8 text-left">
                <p className="eyebrow mb-3">Or pick up where you left off</p>
                {trips.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleSwitchTrip(t.id)}
                    className="btn-secondary mb-2 w-full justify-between"
                  >
                    {t.name}
                    <Icon name="arrow" width="16" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <StartTripModal
        isOpen={showStartTripModal}
        onClose={() => setShowStartTripModal(false)}
        onSubmit={handleStartTrip}
        defaultUserName={currentUser || ""}
      />

      {trip && (
        <>
          <ShareTripModal
            isOpen={showShareModal}
            onClose={() => setShowShareModal(false)}
            inviteCode={trip.invite_code}
            tripName={trip.name}
          />

          <MemberListModal
            key={trip.id}
            isOpen={showMemberModal}
            onClose={() => setShowMemberModal(false)}
            members={members}
            onRemoveMember={handleRemoveMember}
            currentMemberId={
              members.find((member) => member.user_id === user?.id)?.id
            }
            creatorName={trip.created_by}
            canRemove={members.some(
              (member) =>
                member.user_id === user?.id &&
                member.display_name === trip.created_by,
            )}
          />

          <DeleteTripModal
            isOpen={showDeleteModal}
            onClose={() => setShowDeleteModal(false)}
            onConfirm={handleDeleteTrip}
            tripName={trip.name}
            isDeleting={isDeleting}
            error={deleteTripError}
          />
        </>
      )}

      {editingTransaction && (
        <TransactionEditForm
          transaction={editingTransaction as any}
          memberNames={members.map((m) => ({ id: m.id, name: m.display_name }))}
          tripId={tripId}
          onDelete={() => handleDeleteTransaction(editingTransaction.id)}
          onSubmit={handleEditTransaction}
          onCancel={() => setEditingTransaction(null)}
        />
      )}

      {undoState && (
        <UndoToast
          show={true}
          type={undoState.type}
          message={undoState.message}
          onUndo={handleUndo}
          onDismiss={() => setUndoState(null)}
          itemId={undoState.itemId}
        />
      )}
    </div>
  );
}

export default function Home() {
  return (
    <AuthGuard>
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-success border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <HomeContent />
      </Suspense>
    </AuthGuard>
  );
}
