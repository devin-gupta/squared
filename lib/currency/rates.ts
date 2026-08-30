import "server-only";
import {
  normalizeCurrency,
  validateQuote,
  type CurrencyQuote,
} from "./convert";

export async function getUsdRate(
  currencyInput: string,
): Promise<CurrencyQuote> {
  const currency = normalizeCurrency(currencyInput);
  if (currency === "USD")
    return {
      currency,
      rate: 1,
      date: new Date().toISOString().slice(0, 10),
      provider: "Frankfurter",
    };
  const response = await fetch(
    `https://api.frankfurter.dev/v2/rate/${currency}/USD`,
    {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok)
    throw new Error(
      "Exchange rates are temporarily unavailable. Your expense has not been saved.",
    );
  const data = await response.json();
  if (data.base !== currency || data.quote !== "USD")
    throw new Error(
      "The exchange rate response was invalid. Please try again.",
    );
  return validateQuote(
    { currency, rate: data.rate, date: data.date, provider: "Frankfurter" },
    currency,
  );
}
