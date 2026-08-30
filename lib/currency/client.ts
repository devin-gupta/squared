import {
  convertExpense,
  normalizeCurrency,
  validateQuote,
  type CurrencyQuote,
} from "./convert";
import type { TransactionParsed } from "@/types/transaction";

export async function fetchUsdRate(
  currency: string,
  signal?: AbortSignal,
): Promise<CurrencyQuote> {
  const response = await fetch(
    `/api/currency?currency=${encodeURIComponent(normalizeCurrency(currency))}`,
    { signal: signal ?? AbortSignal.timeout(12000) },
  );
  const result = await response.json();
  if (!response.ok || !result.quote)
    throw new Error(
      result.error || "Couldn’t get an exchange rate. Please try again.",
    );
  return validateQuote(result.quote, currency);
}

export async function prepareUsdExpense(
  parsed: TransactionParsed,
): Promise<TransactionParsed> {
  const currency = normalizeCurrency(parsed.currency);
  if (currency === "USD")
    return { ...parsed, currency, currency_conversion: undefined };
  return convertExpense(parsed, await fetchUsdRate(currency));
}
