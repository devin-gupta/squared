"use client";

import { useState } from "react";
import { aiRequestHeaders } from "@/lib/ai/client-headers";
import { TransactionParsed } from "@/types/transaction";

// Bound the read phase only. Expense writes begin after parsing returns.
async function requestAI(url: string, options: RequestInit) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 55000);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        data.error || "AI entry is unavailable. Please try again.",
      );
    return data;
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error(
        "The AI took too long to respond. Try again or enter this expense manually.",
      );
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

interface UseAIParserOptions {
  tripId: string | null;
  onSuccess?: (
    parsed: TransactionParsed,
    receiptUrl?: string | null,
  ) => void | Promise<void>;
  onError?: (error: Error) => void;
}

export function useAIParser({
  tripId,
  onSuccess,
  onError,
}: UseAIParserOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const parseText = async (text: string) => {
    if (!text.trim()) {
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { parsed } = await requestAI("/api/ai/parse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await aiRequestHeaders()),
        },
        body: JSON.stringify({ text, tripId }),
      });

      await onSuccess?.(parsed);
      return parsed;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error");
      setError(error);
      onError?.(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const parseReceipt = async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (tripId) {
        formData.append("tripId", tripId);
      }

      const { parsed, receiptUrl } = await requestAI("/api/ai/ocr", {
        method: "POST",
        headers: await aiRequestHeaders(),
        body: formData,
      });

      await onSuccess?.(parsed, receiptUrl);
      return { parsed, receiptUrl };
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error");
      setError(error);
      onError?.(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    parseText,
    parseReceipt,
    isLoading,
    error,
  };
}
