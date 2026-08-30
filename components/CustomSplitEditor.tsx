"use client";

import { useId, useState } from "react";
import { aiRequestHeaders } from "@/lib/ai/client-headers";
import {
  customSplitError,
  equalAllocations,
  SplitAllocation,
} from "@/lib/transactions/splits";

interface CustomSplitEditorProps {
  members: { id: string; name: string }[];
  totalAmount: number;
  currency?: string;
  tripId?: string | null;
  existingAdjustments?: SplitAllocation[];
  onChange: (adjustments: SplitAllocation[]) => void;
}

export default function CustomSplitEditor({
  members,
  totalAmount,
  currency = "USD",
  tripId,
  existingAdjustments = [],
  onChange,
}: CustomSplitEditorProps) {
  const groupId = useId();
  const prefix = currency === "USD" ? "$" : `${currency} `;
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      members.map((m) => [
        m.id,
        String(
          existingAdjustments.find((a) => a.memberId === m.id)?.amount ?? 0,
        ),
      ]),
    ),
  );
  const [instructions, setInstructions] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const allocations = members.map((m) => ({
    memberId: m.id,
    amount: Number(amounts[m.id] || 0),
  }));
  const error = customSplitError(
    totalAmount,
    members.map((m) => m.id),
    allocations,
    currency,
  );
  const apply = (next: SplitAllocation[]) => {
    setAmounts(
      Object.fromEntries(
        members.map((m) => [
          m.id,
          String(next.find((a) => a.memberId === m.id)?.amount ?? 0),
        ]),
      ),
    );
    onChange(next);
  };
  const parseInstructions = async () => {
    if (!tripId || parsing || !instructions.trim()) return;
    setParsing(true);
    setParseError(null);
    try {
      const response = await fetch("/api/ai/parse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await aiRequestHeaders()),
        },
        body: JSON.stringify({
          text: `Split a total of ${currency} ${totalAmount.toFixed(2)}. All amounts are in ${currency}: ${instructions}`,
          tripId,
        }),
      });
      if (!response.ok)
        throw new Error(
          "Couldn’t interpret the split. Enter the amounts below instead.",
        );
      const { parsed } = await response.json();
      if (!Array.isArray(parsed?.adjustments) || !parsed.adjustments.length)
        throw new Error(
          "No custom shares found. Try more specific instructions or enter the amounts below.",
        );
      const next = members.map((m) => ({
        memberId: m.id,
        amount: Number(
          parsed.adjustments.find(
            (a: { user_name?: string }) =>
              a.user_name?.toLowerCase() === m.name.toLowerCase(),
          )?.amount ?? 0,
        ),
      }));
      const issue = customSplitError(
        totalAmount,
        members.map((m) => m.id),
        next,
        currency,
      );
      if (issue) throw new Error(`Check the suggested amounts: ${issue}`);
      apply(next);
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : "Couldn’t interpret the split.",
      );
    } finally {
      setParsing(false);
    }
  };
  return (
    <fieldset className="rounded-2xl border border-[#e1e5dc] bg-[#f8faf5] p-4">
      <legend className="px-1 text-sm font-semibold">Custom amounts</legend>
      <p className="muted mb-3 text-xs">
        Enter each person’s share in {currency}. Use {prefix}0 for anyone who
        didn’t take part.
      </p>
      <button
        type="button"
        onClick={() =>
          apply(
            equalAllocations(
              totalAmount,
              members.map((m) => m.id),
            ),
          )
        }
        className="mb-3 min-h-11 text-xs font-medium underline underline-offset-4"
      >
        Start from an equal split
      </button>
      <div className="space-y-3">
        {members.map((member, i) => (
          <div
            key={member.id}
            className="flex items-center justify-between gap-3"
          >
            <label
              htmlFor={`${groupId}-${i}`}
              className="min-w-0 break-words text-sm font-medium"
            >
              {member.name}
            </label>
            <div className="flex shrink-0 items-center gap-2">
              <span aria-hidden="true" className="text-sm text-[#5e6b5f]">
                {prefix}
              </span>
              <input
                id={`${groupId}-${i}`}
                aria-label={`${member.name} share`}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amounts[member.id] ?? "0"}
                onChange={(e) => {
                  const next = { ...amounts, [member.id]: e.target.value };
                  setAmounts(next);
                  onChange(
                    members.map((m) => ({
                      memberId: m.id,
                      amount: Number(next[m.id] || 0),
                    })),
                  );
                }}
                className="w-28 min-w-0 text-right tabular-nums"
              />
            </div>
          </div>
        ))}
      </div>
      <div
        role="status"
        aria-live="polite"
        className={`mt-4 border-t border-[#dce2d8] pt-4 text-sm ${error ? "text-[#994630]" : "text-[#355745]"}`}
      >
        {error || `All ${prefix}${totalAmount.toFixed(2)} assigned.`}
      </div>
      {tripId && (
        <div className="mt-4 border-t border-[#dce2d8] pt-3">
          <button
            type="button"
            onClick={() => setShowInstructions(!showInstructions)}
            aria-expanded={showInstructions}
            className="min-h-11 text-xs font-medium underline underline-offset-4"
          >
            Describe the split instead
          </button>
          {showInstructions && (
            <div className="space-y-3">
              <label
                htmlFor={`${groupId}-instructions`}
                className="block text-xs text-[#5e6b5f]"
              >
                For example: Alex owes {prefix}20, split the rest equally.
              </label>
              <textarea
                id={`${groupId}-instructions`}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="min-h-24 w-full rounded-xl border border-[#dce2d8] bg-white p-3"
              />
              <button
                type="button"
                onClick={parseInstructions}
                disabled={parsing || !instructions.trim()}
                className="btn-secondary w-full"
              >
                {parsing ? "Working out shares…" : "Apply suggested shares"}
              </button>
              {parseError && (
                <p role="alert" className="text-xs text-red-800">
                  {parseError}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </fieldset>
  );
}
