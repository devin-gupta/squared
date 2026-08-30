"use client";

import { useState, useEffect, useRef, Suspense } from "react";
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
import { joinTrip, getInviteContext, InviteContext } from "@/lib/trips/join";
import JoinTripChoice from "./JoinTripChoice";
import { addTripNames } from "@/lib/trips/addMember";
import { listTrips } from "@/lib/trips/list";
import { useAIParser } from "@/hooks/useAIParser";
import {
  ExpenseSaveError,
  prepareExpense,
  commitPreparedExpense,
} from "@/lib/transactions/create";
import { useExpenseDraft } from "@/hooks/useExpenseDraft";
import { ExpenseDraftContext } from "./ExpenseDraftContext";
import ExpenseHistory from "./ExpenseHistory";
import { undoExpense } from "@/lib/transactions/history";
import {
  getExpenseDefaults,
  rememberExpenseDefaults,
} from "@/lib/drafts/defaults";
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
  readPreference,
} from "@/lib/auth/preferences";

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [entryProgress, setEntryProgress] =
    useState<ExpenseEntryProgress | null>(null);
  const [tripId, setTripId] = useState<string | null>(null);
  const draftControl = useExpenseDraft(user?.id, tripId);
  const undoRequests = useRef<Record<string, string>>({});
  const deleteRequests = useRef<Record<string, string>>({});
  const [nextTripNames, setNextTripNames] = useState<string[]>([]);
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
  useEffect(() => {
    if (
      draftControl.ready &&
      draftControl.draft?.parsed &&
      (draftControl.draft.parsed.description.trim() ||
        draftControl.draft.parsed.total_amount > 0) &&
      !searchParams.has("code") &&
      !searchParams.has("newTripFrom") &&
      !pendingInvite()
    ) {
      setPendingParsed(draftControl.draft.parsed);
      setPendingReceiptUrl(draftControl.draft.receiptUrl || null);
      if (draftControl.draft.mode === "manual") setShowManualForm(true);
    }
  }, [draftControl.ready, tripId]);
  const [isLoadingTrip, setIsLoadingTrip] = useState(true);

  const [tripLoadError, setTripLoadError] = useState<string | null>(null);
  const [joinContext, setJoinContext] = useState<InviteContext | null>(null);
  const [activeInvite, setActiveInvite] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const accountId = user.id;
    const displayName =
      user.user_metadata?.display_name ||
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "Traveler";
    const rawInvite = searchParams.get("code");
    const invite = searchParams.has("code")
      ? normalizeInvite(rawInvite)
      : pendingInvite();
    setActiveInvite(searchParams.has("code") ? rawInvite || "invalid" : invite);
    setIsLoadingTrip(true);
    setTripLoadError(null);
    setJoinContext(null);

    const restoreTrip = async () => {
      try {
        if (searchParams.has("code") && !invite)
          throw new Error(
            "This invite is incomplete. Ask your friend for a fresh invite link.",
          );
        if (invite) rememberInvite(invite);
        // Invite intent always takes priority over a previously selected trip.
        let joinedId: string | null = null;
        if (invite) {
          const context = await getInviteContext(invite);
          if (cancelled) return;
          if (!context.memberId) {
            setJoinContext(context);
            return;
          }
          joinedId = context.tripId;
        }
        const availableTrips = await listTrips(undefined, accountId);
        if (cancelled) return;
        setTrips(availableTrips);
        const storedId = preferredTrip(accountId);
        const selectedId =
          joinedId ||
          availableTrips.find((t) => t.id === searchParams.get("newTripFrom"))
            ?.id ||
          availableTrips.find((t) => t.id === searchParams.get("trip"))?.id ||
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
          if (searchParams.get("newTripFrom") === selectedId) {
            setNextTripNames(
              loadedMembers
                .filter((m) => m.user_id !== accountId)
                .map((m) => m.display_name),
            );
            setShowStartTripModal(true);
            router.replace("/");
          }
        } else {
          setTripId(null);
          setTrip(null);
          setMembers([]);
          setMemberNames([]);
          setCurrentUser(displayName);
          writePreference("tripId", null);
        }
        if (!invite && searchParams.has("trip")) router.replace("/");
        if (invite) {
          forgetInvite(invite);
          setActiveInvite(null);
          if (searchParams.has("code")) router.replace("/");
        }
      } catch (error) {
        if (!cancelled && !invite && !navigator.onLine) {
          try {
            const id = preferredTrip(accountId);
            const cached = JSON.parse(
              readPreference(`squared:trip-context:${accountId}:${id}`) ||
                "null",
            );
            if (
              cached?.trip?.id === id &&
              Array.isArray(cached.members) &&
              cached.members.some((m: TripMember) => m.user_id === accountId)
            ) {
              setTrip(cached.trip);
              setTripId(id);
              setMembers(cached.members);
              setMemberNames(
                cached.members.map((m: TripMember) => m.display_name),
              );
              setCurrentUser(
                cached.members.find((m: TripMember) => m.user_id === accountId)
                  .display_name,
              );
              return;
            }
          } catch {}
        }
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
      if (user)
        writePreference(
          `squared:trip-context:${user.id}:${selectedId}`,
          JSON.stringify({ trip: loadedTrip, members: loadedMembers }),
        );
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

    if (!user || !draftControl.draft)
      throw new Error("Wait for your draft to load.");
    if (!navigator.onLine) {
      await draftControl.update({ parsed, receiptUrl, mode: "manual" });
      return { status: "draft" };
    }
    const frozen =
      draftControl.draft.submission ||
      (await prepareExpense(tripId, parsed, receiptUrl, currentUser));
    const originalParsed = draftControl.draft.submission
      ? draftControl.draft.parsed || parsed
      : parsed;
    const requestId = draftControl.draft.id;
    // Persist the exact converted request before sending it. A retry uses this
    // same payload, exchange rate and operation ID even after a reload.
    await draftControl.update({
      submission: frozen,
      parsed: originalParsed,
      receiptUrl,
      mode: "manual",
    });
    let result;
    try {
      result = await commitPreparedExpense(frozen, requestId);
    } catch (error) {
      if (error instanceof ExpenseSaveError && error.safeToEdit)
        await draftControl.update({ submission: undefined }).catch(() => {});
      throw error;
    }
    rememberExpenseDefaults(user.id, tripId, originalParsed, memberNames);
    await draftControl.clear().catch(() => undefined);
    setUndoState({
      type: "transaction",
      itemId: result.changeId,
      message: "Expense added",
    });
    setPendingParsed(null);
    setPendingReceiptUrl(null);
    setShowManualForm(false);
    if (navigator.vibrate) navigator.vibrate(50);
    return {
      status: "saved",
      description: result.description,
      amount: result.totalAmount,
    };
  };

  const handleUndo = async () => {
    if (!undoState || !tripId) return;
    await undoExpense(
      tripId,
      undoState.itemId,
      (undoRequests.current[undoState.itemId] ||= crypto.randomUUID()),
    );
    setUndoState(null);
    setDashboardRevision((n) => n + 1);
  };

  const handleStartTrip = async (
    tripName: string,
    userName: string,
    names: string[] = [],
    requestId?: string,
  ) => {
    if (!user) {
      alert("Authentication required");
      return;
    }

    try {
      const { tripId: newTripId, inviteCode } = await createTrip(
        userName,
        tripName,
        user.id,
        names,
        requestId,
      );
      rememberTrip(user.id, newTripId, userName);
      setTripId(newTripId);
      setCurrentUser(userName);
      await loadTripData(newTripId);
      await loadTrips(userName, user.id);
      setShowStartTripModal(false);
      setShowShareModal(true);
    } catch (error) {
      console.error("Error creating trip:", error);
      throw error;
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
      operationId?: string;
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
            "Idempotency-Key": data.operationId || crypto.randomUUID(),
          },
          body: JSON.stringify({
            expectedVersion: editingTransaction.version || 1,
            tripId,
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

      const result = await response.json();
      setUndoState({
        type: "transaction",
        itemId: result.changeId,
        message: "Expense updated",
      });
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
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          "Idempotency-Key": (deleteRequests.current[transactionId] ||=
            crypto.randomUUID()),
        },
        body: JSON.stringify({
          expectedVersion: editingTransaction?.version || 1,
          tripId,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result?.error || "Failed to delete transaction");
      delete deleteRequests.current[transactionId];
      setUndoState({
        type: "transaction",
        itemId: result.changeId,
        message: "Expense deleted",
      });
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
    if (draftControl.draft?.submission)
      return saveTransaction(
        draftControl.draft.parsed!,
        draftControl.draft.receiptUrl || null,
      );
    if (!navigator.onLine) {
      await draftControl.update({ text, mode: "quick" });
      return { status: "draft" };
    }
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
        : {
            parsed: await parseText(
              text,
              user
                ? getExpenseDefaults(user.id, tripId, memberNames)
                : undefined,
            ),
            receiptUrl: null,
          };
      const parsed = result.parsed;
      if (!parsed)
        throw new Error("Describe the expense or attach a receipt first.");
      const defaults = user
        ? getExpenseDefaults(user.id, tripId, memberNames)
        : null;
      if (!parsed.payer_name)
        parsed.payer_name = defaults?.payerName || currentUser;
      await draftControl.update({
        parsed,
        receiptUrl: result.receiptUrl,
        mode: "manual",
      });
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
      <ExpenseDraftContext.Provider value={draftControl}>
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
      </ExpenseDraftContext.Provider>
    );
  }

  if (joinContext && activeInvite && user)
    return (
      <JoinTripChoice
        context={joinContext}
        defaultName={
          user.user_metadata?.display_name ||
          user.user_metadata?.full_name ||
          user.email?.split("@")[0] ||
          ""
        }
        onJoin={async (memberId, name) => {
          await joinTrip(activeInvite, name, user.id, memberId);
          setJoinContext(null);
          setLoadAttempt((n) => n + 1);
        }}
        onLeave={() => {
          forgetInvite();
          setJoinContext(null);
          setActiveInvite(null);
          router.replace("/");
          setLoadAttempt((n) => n + 1);
        }}
      />
    );

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
    <ExpenseDraftContext.Provider value={draftControl}>
      <div>
        {draftControl.offline && (
          <p role="status" className="mb-4 rounded-xl bg-[#fff4d8] p-4 text-sm">
            You’re offline. Trip details may be out of date; drafts can still be
            saved on this device.
          </p>
        )}
        {trip && draftControl.draft?.parsed && !showManualForm && (
          <div className="mb-4 rounded-xl bg-[#edf1e9] p-4 text-sm">
            <p>You have an unfinished expense for {trip.name}.</p>
            <button
              className="mt-2 min-h-10 underline"
              onClick={() => {
                setPendingParsed(draftControl.draft?.parsed || null);
                setPendingReceiptUrl(draftControl.draft?.receiptUrl || null);
                setShowManualForm(true);
              }}
            >
              Continue draft
            </button>
          </div>
        )}
        {trip ? (
          <>
            <ConnectedDashboard
              header={{
                trip,
                members,
                trips,
                onShare: () => setShowShareModal(true),
                onSwitchTrip: handleSwitchTrip,
                onCreateTrip: () => {
                  setNextTripNames([]);
                  setShowStartTripModal(true);
                },
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
              onManual={(text) => {
                const defaults =
                  user && tripId
                    ? getExpenseDefaults(user.id, tripId, memberNames)
                    : {
                        currency: "USD",
                        participants: [],
                        payerName: undefined,
                      };
                setPendingParsed(
                  draftControl.draft?.parsed || {
                    description: text || "",
                    total_amount: 0,
                    split_type: "equal",
                    currency: defaults.currency,
                    payer_name: defaults.payerName || currentUser || undefined,
                    participants: defaults.participants.length
                      ? defaults.participants
                      : undefined,
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
                Create a trip, bring your people, and keep every shared expense
                in one place.
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

        {trip && (
          <ExpenseHistory
            tripId={tripId}
            refreshKey={`${draftControl.draft?.id}:${dashboardRevision}`}
            onChange={() => setDashboardRevision((n) => n + 1)}
          />
        )}
        <StartTripModal
          isOpen={showStartTripModal}
          onClose={() => setShowStartTripModal(false)}
          onSubmit={handleStartTrip}
          defaultUserName={currentUser || ""}
          defaultNames={nextTripNames}
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
              onAddNames={async (names) => {
                if (!tripId) return;
                await addTripNames(tripId, names);
                await loadMembers(tripId);
                setDashboardRevision((n) => n + 1);
              }}
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
            memberNames={members.map((m) => ({
              id: m.id,
              name: m.display_name,
            }))}
            tripId={tripId}
            onDelete={() => handleDeleteTransaction(editingTransaction.id)}
            onSubmit={handleEditTransaction}
            onCancel={() => {
              setEditingTransaction(null);
              setDashboardRevision((n) => n + 1);
            }}
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
    </ExpenseDraftContext.Provider>
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
