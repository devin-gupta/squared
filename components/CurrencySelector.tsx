"use client";

import { useEffect, useState } from "react";
import {
  CURRENCIES,
  currencyAmount,
  usdAmount,
  type CurrencyQuote,
} from "@/lib/currency/convert";
import { fetchUsdRate } from "@/lib/currency/client";

export default function CurrencySelector({
  currency,
  amount,
  onChange,
}: {
  currency: string;
  amount: number;
  onChange: (currency: string) => void;
}) {
  const [quote, setQuote] = useState<CurrencyQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const supported = CURRENCIES.some(([code]) => code === currency);
  useEffect(() => {
    setQuote(null);
    setError(null);
    if (currency === "USD" || !supported) return;
    const controller = new AbortController();
    fetchUsdRate(currency, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setQuote(result);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            "Couldn’t get an exchange rate. Your amount is still in the selected currency.",
          );
      });
    return () => controller.abort();
  }, [currency, supported, attempt]);
  return (
    <div>
      <label
        htmlFor="expense-currency"
        className="mb-2 block text-sm font-medium text-accent/70"
      >
        Currency
      </label>
      <select
        id="expense-currency"
        value={supported ? currency : ""}
        onChange={(event) => onChange(event.target.value)}
        className="w-full"
        required
      >
        <option value="" disabled>
          Choose currency
        </option>
        {CURRENCIES.map(([code, name]) => (
          <option key={code} value={code}>
            {code} — {name}
          </option>
        ))}
      </select>
      <div className="muted mt-2 text-xs" aria-live="polite">
        {currency === "USD" ? (
          "The ledger and settlements are kept in US dollars."
        ) : !supported ? (
          "Confirm the original currency before saving."
        ) : error ? (
          <>
            <p>{error}</p>
            <button
              type="button"
              className="min-h-11 underline"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Retry exchange rate
            </button>
          </>
        ) : quote?.currency === currency ? (
          <>
            <p className="font-semibold text-accent">
              {amount > 0 && Number.isFinite(amount)
                ? `Estimated ledger amount: ${currencyAmount(usdAmount(amount, quote.rate), "USD")}`
                : "Enter an amount to preview the USD total."}
            </p>
            <p className="mt-1">
              1 {currency} = {quote.rate} USD · {quote.date} · Frankfurter. The
              rate is checked and locked when saved; card fees aren’t included.
            </p>
          </>
        ) : (
          "Loading exchange rate…"
        )}
      </div>
    </div>
  );
}
